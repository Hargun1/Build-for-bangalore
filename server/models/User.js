const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false },
    googleId: { type: String, default: null },
    avatar: { type: String, default: "" },
    gender: { type: String, enum: ["male", "female", "other"], required: false, default: "other" },
    dob: { type: Date, required: false },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, default: null },
    emailVerificationExpires: { type: Date, default: null },
    emergencyContacts: [
      {
        name: String,
        phone: String,
        relation: String,
      },
    ],
    linkedProfiles: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    insuranceId: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
