const router = require("express").Router();
const { z } = require("zod");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { asyncHandler, HttpError } = require("../middleware/errors");
const User = require("../models/User");
const HealthMetrics = require("../models/HealthMetrics");
const Prediction = require("../models/Prediction");
const FoodLog = require("../models/FoodLog");
const Appointment = require("../models/Appointment");
const EmergencyEvent = require("../models/EmergencyEvent");
const GroceryScan = require("../models/GroceryScan");
const LabReport = require("../models/LabReport");
const Reminder = require("../models/Reminder");
const PushSubscription = require("../models/PushSubscription");
const ExposomeData = require("../models/ExposomeData");
const { Goal, GoalCheckin } = require("../models/Goal");

router.use(auth);

const shortList = z.array(z.string().trim().min(1).max(80)).max(20);

// Only these fields can ever be changed by the user. Anything else in the body
// (emailVerified, email, googleId, isGuest...) is dropped by zod.
const accountSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    gender: z.enum(["male", "female", "other"]),
    dob: z.coerce.date().max(new Date()).nullable(),
  })
  .partial();

const profileSchema = z
  .object({
    heightCm: z.number().min(50).max(250).nullable(),
    weightKg: z.number().min(10).max(400).nullable(),
    waistCm: z.number().min(30).max(250).nullable(),
    activityLevel: z.enum(["sedentary", "mild", "moderate", "vigorous"]).nullable(),
    familyHistoryDiabetes: z.enum(["none", "one_parent", "both_parents"]).nullable(),
    smoker: z.boolean().nullable(),
    hasDiabetes: z.boolean().nullable(),
    onBpMedication: z.boolean().nullable(),
    conditions: shortList,
    medications: shortList,
    allergies: shortList,
    diet: z.enum(["vegetarian", "vegan", "eggetarian", "non_vegetarian", "jain"]).nullable(),
  })
  .partial();

const contactsSchema = z.object({
  contacts: z
    .array(
      z
        .object({
          name: z.string().trim().min(1).max(80),
          phone: z.string().trim().regex(/^[+\d][\d\s-]{5,18}$/, "Enter a valid phone number").or(z.literal("")).default(""),
          email: z.string().trim().toLowerCase().email().max(120).or(z.literal("")).default(""),
          relation: z.string().trim().max(40).default(""),
        })
        .refine((c) => c.phone || c.email, "Each contact needs a phone number or an email")
    )
    .max(5, "You can save up to 5 emergency contacts"),
});

async function loadUser(id) {
  const user = await User.findById(id);
  if (!user) throw new HttpError(404, "Account not found.");
  return user;
}

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await loadUser(req.user.id);
    res.json(user.toPublic());
  })
);

router.put(
  "/me",
  validate(accountSchema),
  asyncHandler(async (req, res) => {
    const user = await loadUser(req.user.id);
    Object.assign(user, req.body);
    await user.save();
    res.json(user.toPublic());
  })
);

router.put(
  "/me/profile",
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    const user = await loadUser(req.user.id);
    const profile = user.profile?.toObject ? user.profile.toObject() : { ...(user.profile || {}) };
    for (const [key, value] of Object.entries(req.body)) {
      if (value === null) delete profile[key];
      else profile[key] = value;
    }
    user.profile = profile;
    await user.save();
    res.json(user.toPublic());
  })
);

router.put(
  "/me/emergency-contacts",
  validate(contactsSchema),
  asyncHandler(async (req, res) => {
    const user = await loadUser(req.user.id);
    user.emergencyContacts = req.body.contacts;
    await user.save();
    res.json(user.toPublic());
  })
);

// Deletes the account and every record linked to it.
router.delete(
  "/me",
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    await Promise.all(
      [HealthMetrics, Prediction, FoodLog, Appointment, EmergencyEvent, GroceryScan, LabReport, Reminder, PushSubscription, ExposomeData, Goal, GoalCheckin].map((M) =>
        M.deleteMany({ userId })
      )
    );
    await User.deleteOne({ _id: userId });
    res.json({ message: "Your account and all of its data were deleted." });
  })
);

module.exports = router;
