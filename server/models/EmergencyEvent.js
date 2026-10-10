const mongoose = require("mongoose");

// Audit log of every SOS: who was notified, where, and with which vitals.
const emergencyEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    trigger: { type: String, enum: ["manual", "auto"], default: "manual" },
    detection: { type: String, default: "" },
    location: { lat: Number, lon: Number, accuracyM: Number },
    vitals: { type: mongoose.Schema.Types.Mixed },
    vitalsSource: String,
    notified: [{ name: String, channel: String, ok: Boolean, error: String }],
    resolvedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmergencyEvent", emergencyEventSchema);
