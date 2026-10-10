const mongoose = require("mongoose");

// One document per user per day ("day" = YYYY-MM-DD in the user's timezone).
// Logging again on the same day updates that day's entry instead of adding duplicates.
const healthMetricsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    steps: { type: Number, min: 0, max: 100000 },
    sleepHours: { type: Number, min: 0, max: 24 },
    restingHeartRate: { type: Number, min: 20, max: 250 },
    systolic: { type: Number, min: 50, max: 260 },
    diastolic: { type: Number, min: 30, max: 180 },
    spo2: { type: Number, min: 50, max: 100 },
    temperatureC: { type: Number, min: 30, max: 45 },
    weightKg: { type: Number, min: 10, max: 400 },
    waterLitres: { type: Number, min: 0, max: 15 },
    stressLevel: { type: Number, min: 0, max: 10 },
    screenTimeHours: { type: Number, min: 0, max: 24 },
    hrvMs: { type: Number, min: 0, max: 500 },
    // Where the numbers came from, shown in the UI so simulated data is never mistaken for real.
    source: { type: String, enum: ["manual", "bluetooth", "simulator"], default: "manual" },
  },
  { timestamps: true }
);

healthMetricsSchema.index({ userId: 1, day: -1 }, { unique: true });

module.exports = mongoose.model("HealthMetrics", healthMetricsSchema);
