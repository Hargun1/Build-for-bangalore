const mongoose = require("mongoose");

// One browser/device that agreed to receive notifications. The endpoint is a URL at the
// browser vendor's push service (Google, Mozilla, Apple); the keys encrypt the message.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: { p256dh: { type: String, required: true }, auth: { type: String, required: true } },
    userAgent: String,
    lastSuccessAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
