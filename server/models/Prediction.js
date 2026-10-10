const mongoose = require("mongoose");

// A saved risk assessment. Scores come from the deterministic risk engine in the
// AI service; only the plain-language explanation is written by the language model.
const scoreSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: String,
    method: String, // e.g. "Indian Diabetes Risk Score (Mohan et al., 2005)"
    value: Number, // the score in the method's own units
    unit: String,
    percent: Number, // 0-100 normalised for the UI
    level: { type: String, enum: ["low", "moderate", "high", "unknown"] },
    factors: [{ name: String, points: Number, detail: String }],
    missing: [String], // inputs the user has not provided yet
  },
  { _id: false }
);

const predictionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    scores: [scoreSchema],
    wellnessScore: Number,
    summary: String,
    recommendations: [{ title: String, detail: String, priority: String, relatedTo: String }],
    aiSource: { type: String, default: "fallback" }, // which provider wrote the text, or "fallback"
    inputsSnapshot: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Prediction", predictionSchema);
