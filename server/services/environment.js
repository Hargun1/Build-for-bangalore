const axios = require("axios");
const env = require("../config/env");
const { HttpError } = require("../middleware/errors");
const { computeNaqi } = require("./airQuality");

// Open-Meteo (weather + CAMS air-quality model): free, no API key.
// Nominatim (OpenStreetMap): free reverse geocoding, max 1 request/second, User-Agent required.
const WEATHER = "https://api.open-meteo.com/v1/forecast";
const AIR = "https://air-quality-api.open-meteo.com/v1/air-quality";
const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";

const WMO = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Freezing fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
  80: "Rain showers", 81: "Heavy showers", 82: "Violent showers", 95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm",
};

const cache = new Map();
function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.promise;
  const promise = fn().catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

const avg = (arr) => {
  const v = arr.filter((x) => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

// NAQI at hour index i, from the trailing 24 h (8 h for O3 and CO) of hourly data.
function naqiAt(h, i) {
  const win = (arr, n) => arr.slice(Math.max(0, i - n + 1), i + 1);
  const co = avg(win(h.carbon_monoxide, 8));
  return computeNaqi({
    pm25: avg(win(h.pm2_5, 24)),
    pm10: avg(win(h.pm10, 24)),
    no2: avg(win(h.nitrogen_dioxide, 24)),
    so2: avg(win(h.sulphur_dioxide, 24)),
    nh3: avg(win(h.ammonia, 24)),
    o3: avg(win(h.ozone, 8)),
    co: co == null ? null : co / 1000, // Open-Meteo gives µg/m³; NAQI uses mg/m³
  });
}

async function reverseGeocode(lat, lon) {
  const key = `geo:${lat.toFixed(2)},${lon.toFixed(2)}`;
  return cached(key, 7 * 24 * 3600 * 1000, async () => {
    try {
      const { data } = await axios.get(NOMINATIM, {
        params: { lat, lon, format: "jsonv2", zoom: 14 },
        headers: { "User-Agent": env.userAgent },
        timeout: 6000,
      });
      const a = data.address || {};
      return { area: a.suburb || a.neighbourhood || a.village || a.town || "", city: a.city || a.state_district || a.county || a.state || "" };
    } catch {
      return { area: "", city: "" };
    }
  });
}

// A 0-100 "good to be outside" score per hour: air quality, heat, UV and rain.
function outdoorScore({ aqi, feelsLike, uv, rainChance }) {
  let s = 100;
  if (aqi != null) s -= aqi <= 50 ? 0 : aqi <= 100 ? 10 : aqi <= 200 ? 30 : 55;
  if (feelsLike != null) s -= feelsLike > 39 ? 40 : feelsLike > 34 ? 20 : feelsLike > 31 ? 8 : feelsLike < 12 ? 10 : 0;
  if (uv != null) s -= uv >= 8 ? 25 : uv >= 6 ? 12 : uv >= 3 ? 4 : 0;
  if (rainChance != null) s -= rainChance >= 70 ? 30 : rainChance >= 40 ? 12 : 0;
  return Math.max(0, s);
}

function buildAlerts({ naqi, current, uvMax, hourly }, conditions = []) {
  const alerts = [];
  const lungs = conditions.some((c) => /asthma|copd|bronch|lung/i.test(c));
  const heart = conditions.some((c) => /heart|cardiac|hypertension|bp/i.test(c));
  if (naqi && (naqi.aqi > 200 || ((lungs || heart) && naqi.aqi > 100))) {
    alerts.push({
      type: "air",
      severity: naqi.aqi > 300 ? "severe" : naqi.aqi > 200 ? "high" : "moderate",
      title: `${naqi.name} air quality (AQI ${naqi.aqi})`,
      message: `${naqi.impact}. Main pollutant: ${naqi.dominant}.${lungs ? " Keep your inhaler handy." : ""}`,
      recommendations: ["Avoid outdoor exercise", "Wear an N95 mask outdoors", "Keep windows shut during peak traffic hours"],
    });
  }
  if (current.feelsLike >= 35) {
    alerts.push({
      type: "heat",
      severity: current.feelsLike >= 40 ? "high" : "moderate",
      title: `Heat stress: feels like ${Math.round(current.feelsLike)}°C`,
      message: "Risk of dehydration and heat exhaustion during long outdoor activity.",
      recommendations: ["Drink water every 20-30 minutes outdoors", "Avoid 12-4 pm sun", "Wear light, loose cotton clothes"],
    });
  }
  if (uvMax >= 8) {
    alerts.push({
      type: "uv",
      severity: uvMax >= 11 ? "high" : "moderate",
      title: `Very high UV today (max ${Math.round(uvMax)})`,
      message: "Unprotected skin can burn in under 20 minutes around midday.",
      recommendations: ["SPF 30+ sunscreen", "Cap and sunglasses", "Seek shade 11 am-3 pm"],
    });
  }
  const rainSoon = hourly.slice(0, 6).find((h) => h.rainChance >= 70);
  if (rainSoon) {
    alerts.push({
      type: "rain",
      severity: "low",
      title: `Rain likely around ${rainSoon.time.slice(11, 16)}`,
      message: "Waterlogging and slower traffic are common in heavy Bengaluru showers.",
      recommendations: ["Carry an umbrella", "Allow extra travel time"],
    });
  }
  return alerts;
}

async function fetchEnvironment(lat, lon, conditions = []) {
  const key = `env:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const raw = await cached(key, 15 * 60 * 1000, async () => {
    try {
      const [weather, air, place] = await Promise.all([
        axios.get(WEATHER, {
          params: {
            latitude: lat, longitude: lon, timezone: "auto", forecast_days: 2,
            current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,uv_index,is_day",
            hourly: "temperature_2m,apparent_temperature,uv_index,precipitation_probability",
            daily: "sunrise,sunset,uv_index_max",
          },
          timeout: 10000,
        }),
        axios.get(AIR, {
          params: { latitude: lat, longitude: lon, timezone: "auto", past_days: 1, forecast_days: 2, hourly: "pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,ammonia" },
          timeout: 10000,
        }),
        reverseGeocode(lat, lon),
      ]);
      return { weather: weather.data, air: air.data, place };
    } catch {
      throw new HttpError(502, "Live weather and air-quality data are unavailable right now. Please try again in a few minutes.");
    }
  });

  const { weather: w, air: a, place } = raw;
  const nowLocal = w.current.time.slice(0, 13); // "YYYY-MM-DDTHH"
  const ah = a.hourly;
  const nowIdx = Math.max(0, ah.time.findIndex((t) => t.startsWith(nowLocal)));
  const naqi = naqiAt(ah, nowIdx);
  const p = (arr) => (typeof arr[nowIdx] === "number" ? Math.round(arr[nowIdx] * 10) / 10 : null);

  const current = {
    temp: Math.round(w.current.temperature_2m),
    feelsLike: Math.round(w.current.apparent_temperature),
    humidity: w.current.relative_humidity_2m,
    windKmh: w.current.wind_speed_10m,
    uvIndex: w.current.uv_index,
    isDay: Boolean(w.current.is_day),
    description: WMO[w.current.weather_code] || "Unknown",
    weatherCode: w.current.weather_code,
  };

  // Next 24 hours, hour by hour.
  const wStart = Math.max(0, w.hourly.time.findIndex((t) => t.startsWith(nowLocal)));
  const hourly = [];
  for (let k = 0; k < 24; k += 1) {
    const wi = wStart + k;
    const ai = nowIdx + k;
    if (wi >= w.hourly.time.length) break;
    const hourNaqi = ai < ah.time.length ? naqiAt(ah, ai) : null;
    const row = {
      time: w.hourly.time[wi],
      temp: w.hourly.temperature_2m[wi],
      feelsLike: w.hourly.apparent_temperature[wi],
      uv: w.hourly.uv_index[wi],
      rainChance: w.hourly.precipitation_probability[wi],
      aqi: hourNaqi?.aqi ?? null,
    };
    row.outdoorScore = outdoorScore(row);
    hourly.push(row);
  }

  // Best 2-hour window between 05:00 and 21:00.
  let best = null;
  for (let k = 0; k < hourly.length - 1; k += 1) {
    const hour = Number(hourly[k].time.slice(11, 13));
    if (hour < 5 || hour > 20) continue;
    const score = (hourly[k].outdoorScore + hourly[k + 1].outdoorScore) / 2;
    if (!best || score > best.score) best = { start: hourly[k].time, end: hourly[k + 1].time, score: Math.round(score) };
  }

  const uvMax = w.daily.uv_index_max?.[0] ?? current.uvIndex ?? 0;
  return {
    location: { lat, lon, area: place.area, city: place.city, timezone: w.timezone },
    current,
    airQuality: naqi
      ? { ...naqi, scale: "India NAQI (CPCB)", pollutants: { pm25: p(ah.pm2_5), pm10: p(ah.pm10), no2: p(ah.nitrogen_dioxide), o3: p(ah.ozone), so2: p(ah.sulphur_dioxide), co: p(ah.carbon_monoxide) } }
      : null,
    sun: { sunrise: w.daily.sunrise?.[0], sunset: w.daily.sunset?.[0], uvMax },
    hourly,
    bestWindow: best,
    alerts: buildAlerts({ naqi, current, uvMax, hourly }, conditions),
    sources: [
      { name: "Open-Meteo weather", url: "https://open-meteo.com/" },
      { name: "Open-Meteo air quality (CAMS)", url: "https://open-meteo.com/en/docs/air-quality-api" },
      { name: "OpenStreetMap Nominatim", url: "https://nominatim.org/" },
    ],
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = { fetchEnvironment, outdoorScore, reverseGeocode, cached };
