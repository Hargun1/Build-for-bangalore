// India's National Air Quality Index (NAQI), Central Pollution Control Board, 2014.
// Each pollutant's concentration maps to a 0-500 sub-index by linear interpolation
// inside its breakpoint band; the AQI is the highest sub-index (the "dominant pollutant").
// PM, NO2, SO2 and NH3 use 24-hour averages; O3 and CO use 8-hour averages.

const AQI_BANDS = [
  [0, 50, "Good", "Minimal impact"],
  [51, 100, "Satisfactory", "Minor breathing discomfort for sensitive people"],
  [101, 200, "Moderate", "Breathing discomfort for people with lung or heart disease, children and older adults"],
  [201, 300, "Poor", "Breathing discomfort for most people on prolonged exposure"],
  [301, 400, "Very Poor", "Respiratory illness on prolonged exposure"],
  [401, 500, "Severe", "Affects healthy people; serious impact on those with existing disease"],
];

// Concentration breakpoints per band (µg/m³; CO in mg/m³).
const BREAKPOINTS = {
  pm10: [[0, 50], [51, 100], [101, 250], [251, 350], [351, 430], [431, 600]],
  pm25: [[0, 30], [31, 60], [61, 90], [91, 120], [121, 250], [251, 380]],
  no2: [[0, 40], [41, 80], [81, 180], [181, 280], [281, 400], [401, 600]],
  o3: [[0, 50], [51, 100], [101, 168], [169, 208], [209, 748], [749, 1000]],
  co: [[0, 1.0], [1.1, 2.0], [2.1, 10], [10.1, 17], [17.1, 34], [34.1, 50]],
  so2: [[0, 40], [41, 80], [81, 380], [381, 800], [801, 1600], [1601, 2400]],
  nh3: [[0, 200], [201, 400], [401, 800], [801, 1200], [1201, 1800], [1801, 2400]],
};

const LABELS = { pm10: "PM10", pm25: "PM2.5", no2: "NO₂", o3: "O₃", co: "CO", so2: "SO₂", nh3: "NH₃" };

function subIndex(pollutant, concentration) {
  if (typeof concentration !== "number" || Number.isNaN(concentration) || concentration < 0) return null;
  const bands = BREAKPOINTS[pollutant];
  for (let i = 0; i < bands.length; i += 1) {
    const [lo, hi] = bands[i];
    // Values in the gap between two bands' edges (e.g. 50.5 for PM10) are interpolated in the lower band.
    const nextLo = bands[i + 1]?.[0] ?? Infinity;
    if (concentration <= hi || concentration < nextLo) {
      const [ilo, ihi] = AQI_BANDS[i];
      const c = Math.max(concentration, lo);
      return Math.round(((ihi - ilo) / (hi - lo)) * (c - lo) + ilo);
    }
  }
  return 500;
}

function category(aqi) {
  const band = AQI_BANDS.find(([lo, hi]) => aqi >= lo && aqi <= hi) || AQI_BANDS[AQI_BANDS.length - 1];
  return { name: band[2], impact: band[3] };
}

/**
 * @param {Object} c concentrations: { pm25, pm10, no2, so2, nh3 } as 24-h averages in µg/m³,
 *                   { o3 } 8-h average in µg/m³, { co } 8-h average in mg/m³
 */
function computeNaqi(c) {
  const subs = {};
  for (const key of Object.keys(BREAKPOINTS)) {
    const v = subIndex(key, c[key]);
    if (v != null) subs[key] = v;
  }
  const keys = Object.keys(subs);
  // CPCB requires at least 3 pollutants, one of them PM2.5 or PM10.
  if (keys.length < 3 || !(subs.pm25 != null || subs.pm10 != null)) return null;
  const dominant = keys.reduce((a, b) => (subs[a] >= subs[b] ? a : b));
  const aqi = Math.min(500, subs[dominant]);
  return { aqi, ...category(aqi), dominant: LABELS[dominant], subIndices: subs };
}

module.exports = { computeNaqi, subIndex, category, AQI_BANDS };
