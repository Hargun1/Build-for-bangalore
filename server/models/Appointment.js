const mongoose = require("mongoose");

// An appointment the user plans with a real clinic or hospital found on OpenStreetMap
// (or one they type in). The app does not book with the clinic; it keeps the
// details, emails a confirmation and offers a calendar file with a reminder.
const appointmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    place: {
      osmId: String,
      name: { type: String, required: true, maxlength: 160 },
      kind: String, // hospital, clinic, doctors, dentist...
      address: String,
      phone: String,
      website: String,
      lat: Number,
      lon: Number,
    },
    specialty: { type: String, maxlength: 80, default: "" },
    reason: { type: String, maxlength: 600, default: "" },
    triage: {
      specialty: String,
      urgency: String,
      summary: String,
    },
    startsAt: { type: Date, required: true },
    status: { type: String, enum: ["planned", "completed", "cancelled"], default: "planned" },
    confirmationEmailSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
