const axios = require("axios");
const env = require("../config/env");
const { HttpError } = require("../middleware/errors");
const { cached } = require("./environment");
const PlaceCache = require("../models/PlaceCache");

const FRESH_MS = 7 * 24 * 3600 * 1000;

// OpenStreetMap Overpass API: free and keyless, but public servers are often busy.
// Both mirrors are queried at once and the first good answer wins (checked 2026-10-10:
// overpass-api.de ~10 s, maps.mail.ru ~18 s; kumi.systems and private.coffee were failing).
const OVERPASS = (process.env.OVERPASS_URLS || "https://overpass-api.de/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

const KINDS = {
  hospital: ["amenity=hospital", "healthcare=hospital"],
  clinic: ["amenity=clinic", "healthcare=clinic", "amenity=doctors", "healthcare=doctor"],
  dentist: ["amenity=dentist", "healthcare=dentist"],
  pharmacy: ["amenity=pharmacy", "healthcare=pharmacy"],
};

function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// One regex filter per tag key keeps the query light; Overpass is much faster with
// two statements than with one statement per tag value.
function buildQuery(lat, lon, radiusM, kinds) {
  const byKey = {};
  for (const f of kinds.flatMap((k) => KINDS[k])) {
    const [key, value] = f.split("=");
    (byKey[key] = byKey[key] || []).push(value);
  }
  const statements = Object.entries(byKey).map(([key, values]) => `nwr(around:${radiusM},${lat},${lon})["${key}"~"^(${values.join("|")})$"];`);
  return `[out:json][timeout:25];(${statements.join("")});out center tags 400;`;
}

function addressOf(t) {
  if (t["addr:full"]) return t["addr:full"];
  const parts = [t["addr:housenumber"], t["addr:street"], t["addr:suburb"], t["addr:city"], t["addr:postcode"]].filter(Boolean);
  return parts.join(", ");
}

function kindOf(t) {
  const v = t.amenity || t.healthcare || "";
  if (v === "doctors" || v === "doctor") return "clinic";
  return v;
}

async function overpass(query, timeoutMs = 25000) {
  const controllers = OVERPASS.map(() => new AbortController());
  const attempts = OVERPASS.map((url, i) =>
    axios
      .get(url, { params: { data: query }, headers: { "User-Agent": env.userAgent }, timeout: timeoutMs, signal: controllers[i].signal })
      .then(({ data }) => {
        if (!Array.isArray(data?.elements)) throw new Error("unexpected response");
        controllers.forEach((c, j) => j !== i && c.abort()); // stop the slower mirror
        return data.elements;
      })
  );
  try {
    return await Promise.any(attempts);
  } catch {
    throw new HttpError(502, "OpenStreetMap is busy right now. Please try again in a minute.");
  }
}

// Memory cache -> MongoDB (fresh for 7 days) -> live Overpass -> stale MongoDB copy.
async function fetchElements(key, query, timeoutMs) {
  const stored = await PlaceCache.findOne({ key }).lean().catch(() => null);
  if (stored && Date.now() - new Date(stored.fetchedAt).getTime() < FRESH_MS) return stored.elements;
  try {
    const elements = await overpass(query, timeoutMs);
    PlaceCache.updateOne({ key }, { $set: { elements, fetchedAt: new Date() } }, { upsert: true }).catch(() => {});
    return elements;
  } catch (err) {
    if (stored) return stored.elements; // older than a week, but far better than nothing
    throw err;
  }
}

/**
 * Real healthcare places near a point, nearest first.
 * @param {string[]} kinds subset of hospital, clinic, dentist, pharmacy
 * @param {string} [specialty] OSM healthcare:speciality value; matches are listed first
 */
async function nearby({ lat, lon, kinds = ["hospital", "clinic"], radiusKm = 5, specialty, limit = 25, timeoutMs }) {
  const radiusM = Math.round(Math.min(radiusKm, 15) * 1000);
  // Query around a ~1 km grid point (padded by 1.2 km) so nearby users share the cache,
  // then measure distances from the user's exact position.
  const gLat = Math.round(lat * 100) / 100;
  const gLon = Math.round(lon * 100) / 100;
  const key = `places:${gLat},${gLon},${radiusM},${[...kinds].sort().join("+")}`;
  const elements = await cached(key, 6 * 60 * 60 * 1000, () => fetchElements(key, buildQuery(gLat, gLon, radiusM + 1200, kinds), timeoutMs));

  const seen = new Set();
  const places = [];
  for (const el of elements) {
    const t = el.tags || {};
    const name = t.name || t["name:en"];
    if (!name) continue;
    const pLat = el.lat ?? el.center?.lat;
    const pLon = el.lon ?? el.center?.lon;
    if (pLat == null || pLon == null) continue;
    const dedupe = `${name.toLowerCase()}|${pLat.toFixed(3)}|${pLon.toFixed(3)}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const specialities = (t["healthcare:speciality"] || "").split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    places.push({
      osmId: `${el.type}/${el.id}`,
      name,
      kind: kindOf(t),
      specialities,
      matchesSpecialty: specialty ? specialities.includes(specialty) : null,
      address: addressOf(t),
      phone: t.phone || t["contact:phone"] || "",
      website: t.website || t["contact:website"] || "",
      openingHours: t.opening_hours || "",
      emergency: t.emergency === "yes",
      lat: pLat,
      lon: pLon,
      distanceKm: Math.round(haversineKm({ lat, lon }, { lat: pLat, lon: pLon }) * 10) / 10,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${pLat},${pLon}`,
      osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    });
  }

  const within = places.filter((p) => p.distanceKm <= radiusKm);
  within.sort((a, b) => {
    if (specialty && a.matchesSpecialty !== b.matchesSpecialty) return a.matchesSpecialty ? -1 : 1;
    return a.distanceKm - b.distanceKm;
  });
  return within.slice(0, limit);
}

module.exports = { nearby, haversineKm, buildQuery };
