const mongoose = require("mongoose");

// A repeating reminder at fixed India times, e.g. medicine at 08:00 and 20:00.
const reminderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["medicine", "water", "checkup", "custom"], default: "custom" },
    title: { type: String, required: true },
    note: String,
    times: { type: [String], index: true }, // "HH:MM" in Asia/Kolkata
    days: [Number], // 0 = Sunday ... 6 = Saturday; empty = every day
    enabled: { type: Boolean, default: true },
    // Slots already handled ("2026-10-11T08:00"). Claimed atomically, so a slot is sent once
    // even if two ticks or two server instances race.
    sentSlots: [String],
    lastSentAt: Date,
    lastResult: { delivered: Number, failed: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Reminder", reminderSchema);
