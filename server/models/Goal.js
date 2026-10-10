const mongoose = require("mongoose");

// Metrics a goal can be tracked against automatically from logged HealthMetrics.
const TRACKED_METRICS = ["steps", "sleepHours", "weightKg", "systolic", "waterLitres", "restingHeartRate", "habit"];

const goalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    description: { type: String, maxlength: 600 },
    category: { type: String, enum: ["fitness", "sleep", "weight", "nutrition", "heart", "stress", "hydration", "other"], default: "other" },
    // How progress is measured.
    metric: { type: String, enum: TRACKED_METRICS, default: "habit" },
    // "atLeast": a day counts when value >= dailyTarget (steps, sleep, water).
    // "atMost": a day counts when value <= dailyTarget (blood pressure, resting HR).
    // "reach": progress is the move from startValue toward targetValue (weight).
    direction: { type: String, enum: ["atLeast", "atMost", "reach"], default: "atLeast" },
    dailyTarget: Number,
    startValue: Number,
    targetValue: Number,
    unit: String,
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    milestones: [{ week: Number, title: String, target: String }],
    habits: [{ id: String, title: String, timeOfDay: String }],
    tips: [String],
    status: { type: String, enum: ["active", "completed", "abandoned"], default: "active" },
    planSource: { type: String, default: "template" }, // AI provider name, or "template"
  },
  { timestamps: true }
);

// One row per goal per day for the habit checklist.
const checkinSchema = new mongoose.Schema(
  {
    goalId: { type: mongoose.Schema.Types.ObjectId, ref: "Goal", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    day: { type: String, required: true },
    habitsDone: [String],
  },
  { timestamps: true }
);
checkinSchema.index({ goalId: 1, day: 1 }, { unique: true });

module.exports = {
  Goal: mongoose.model("Goal", goalSchema),
  GoalCheckin: mongoose.model("GoalCheckin", checkinSchema),
  TRACKED_METRICS,
};
