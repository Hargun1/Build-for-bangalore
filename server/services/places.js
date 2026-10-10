const axios = require("axios");
const env = require("../config/env");
const { HttpError } = require("../middleware/errors");
const { cached } = require("./environment");

// OpenStreetMap Overpass API: free, keyless. Two public mirrors for resilience.
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

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

function buildQuery(lat, lon, radiusM, kinds) {
  const filters = kinds.flatMap((k) => KINDS[k]).map((f) => {
    const [key, value] = f.split("=");
    return `nwr(around:${radiusM},${lat},${lon})["${key}"="${value}"];`;
  });
  return `[out:json][timeout:20];(${filters.join("")});out center tags 120;`;
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

async function overpass(query) {
  let lastErr;
  for (const url of OVERPASS) {
    try {
      const { data } = await axios.post(url, new URLSearchParams({ data: query }).toString(), {
        headers: { "User-Agent": env.userAgent, "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 25000,
      });
      return data.elements || [];
    } catch (err) {
      lastErr = err;
    }
  }
  throw new HttpError(502, "OpenStreetMap is busy right now. Please try again in a minute.", { cause: lastErr?.message });
}

/**
 * Real healthcare places near a point, nearest first.
 * @param {string[]} kinds subset of hospital, clinic, dentist, pharmacy
 * @param {string} [specialty] OSM healthcare:speciality value; matches are listed first
 */
async function nearby({ lat, lon, kinds = ["hospital", "clinic"], radiusKm = 5, specialty, limit = 25 }) {
  const radiusM = Math.round(Math.min(radiusKm, 15) * 1000);
  const key = `places:${lat.toFixed(3)},${lon.toFixed(3)},${radiusM},${[...kinds].sort().join("+")}`;
  const elements = await cached(key, 60 * 60 * 1000, () => overpass(buildQuery(lat, lon, radiusM, kinds)));

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

  places.sort((a, b) => {
    if (specialty && a.matchesSpecialty !== b.matchesSpecialty) return a.matchesSpecialty ? -1 : 1;
    return a.distanceKm - b.distanceKm;
  });
  return places.slice(0, limit);
}

module.exports = { nearby, haversineKm, buildQuery };
