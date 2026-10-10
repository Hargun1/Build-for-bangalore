const HealthMetrics = require("../models/HealthMetrics");

// Calendar day in India, so "today" matches the user's day, not the server's UTC day.
const TIMEZONE = "Asia/Kolkata";
function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function daysAgoKey(n) {
  return dayKey(new Date(Date.now() - n * 24 * 3600 * 1000));
}

// What the AI service may know about a user: no name, email or exact birth date.
function aiContext(user) {
  const p = user.profile || {};
  return {
    age: user.age ?? undefined,
    sex: user.gender,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    activityLevel: p.activityLevel,
    hasDiabetes: p.hasDiabetes,
    onBpMedication: p.onBpMedication,
    smoker: p.smoker,
    conditions: p.conditions || [],
    medications: p.medications || [],
    allergies: p.allergies || [],
    diet: p.diet,
    city: "Bengaluru",
  };
}

const AVERAGED = ["steps", "sleepHours", "restingHeartRate", "systolic", "diastolic", "spo2", "weightKg", "waterLitres", "stressLevel", "hrvMs"];

// Averages over the last `days` days that have a value (unlogged days are skipped, not counted as zero).
async function recentAverages(userId, days = 7) {
  const rows = await HealthMetrics.find({ userId, day: { $gte: daysAgoKey(days - 1) } }).lean();
  const out = { daysLogged: rows.length };
  for (const key of AVERAGED) {
    const vals = rows.map((r) => r[key]).filter((v) => typeof v === "number");
    out[key] = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
  }
  return out;
}

function metricsSummary(avg) {
  const parts = [];
  if (avg.steps != null) parts.push(`${avg.steps} steps/day`);
  if (avg.sleepHours != null) parts.push(`${avg.sleepHours} h sleep`);
  if (avg.systolic != null) parts.push(`BP ${avg.systolic}/${avg.diastolic ?? "?"}`);
  if (avg.restingHeartRate != null) parts.push(`resting HR ${avg.restingHeartRate}`);
  if (avg.weightKg != null) parts.push(`weight ${avg.weightKg} kg`);
  if (avg.stressLevel != null) parts.push(`stress ${avg.stressLevel}/10`);
  return parts.length ? `7-day averages: ${parts.join(", ")}` : "";
}

module.exports = { dayKey, daysAgoKey, aiContext, recentAverages, metricsSummary, TIMEZONE };
