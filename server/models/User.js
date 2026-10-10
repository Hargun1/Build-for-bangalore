const mongoose = require("mongoose");

// Health profile: the inputs the published risk scores need (IDRS, Framingham).
const profileSchema = new mongoose.Schema(
  {
    heightCm: { type: Number, min: 50, max: 250 },
    weightKg: { type: Number, min: 10, max: 400 },
    waistCm: { type: Number, min: 30, max: 250 },
    activityLevel: { type: String, enum: ["sedentary", "mild", "moderate", "vigorous"] },
    familyHistoryDiabetes: { type: String, enum: ["none", "one_parent", "both_parents"] },
    smoker: { type: Boolean },
    hasDiabetes: { type: Boolean },
    onBpMedication: { type: Boolean },
    conditions: [{ type: String, maxlength: 80 }],
    medications: [{ type: String, maxlength: 80 }],
    allergies: [{ type: String, maxlength: 80 }],
    diet: { type: String, enum: ["vegetarian", "vegan", "eggetarian", "non_vegetarian", "jain"] },
  },
  { _id: false }
);

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
    phone: { type: String, maxlength: 20, default: "" },
    email: { type: String, maxlength: 120, default: "" },
    relation: { type: String, maxlength: 40, default: "" },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    googleId: { type: String, default: null },
    avatar: { type: String, default: "" },
    gender: { type: String, enum: ["male", "female", "other"], default: "other" },
    dob: { type: Date },
    emailVerified: { type: Boolean, default: false },
    // OTP is stored hashed; attempts are counted so 6 digits cannot be brute-forced.
    emailOtpHash: { type: String, default: null, select: false },
    emailOtpExpires: { type: Date, default: null, select: false },
    emailOtpAttempts: { type: Number, default: 0, select: false },
    isGuest: { type: Boolean, default: false },
    // MongoDB deletes guest accounts automatically once this date passes (TTL index below).
    guestExpiresAt: { type: Date, default: undefined },
    profile: { type: profileSchema, default: () => ({}) },
    emergencyContacts: { type: [contactSchema], default: [] },
  },
  { timestamps: true }
);

userSchema.index({ guestExpiresAt: 1 }, { expireAfterSeconds: 0 });

userSchema.virtual("age").get(function age() {
  if (!this.dob) return null;
  const diff = Date.now() - this.dob.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
});

// The only shape of a user the API ever sends to a client.
userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.isGuest ? "" : this.email,
    gender: this.gender,
    dob: this.dob ? this.dob.toISOString().slice(0, 10) : null,
    age: this.age,
    avatar: this.avatar || "",
    emailVerified: this.emailVerified,
    isGuest: this.isGuest,
    profile: this.profile || {},
    emergencyContacts: (this.emergencyContacts || []).map((c) => ({
      id: c._id.toString(),
      name: c.name,
      phone: c.phone,
      email: c.email,
      relation: c.relation,
    })),
  };
};

module.exports = mongoose.model("User", userSchema);
