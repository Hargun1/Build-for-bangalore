const router = require("express").Router();
const { z } = require("zod");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { aiLimiter } = require("../middleware/rateLimit");
const { asyncHandler, HttpError } = require("../middleware/errors");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const ai = require("../services/aiService");
const { aiContext } = require("../services/userContext");
const { appointmentIcs } = require("../services/ics");
const { sendAppointmentConfirmation } = require("../services/emailService");

router.use(auth);

const YEAR_MS = 365 * 24 * 3600 * 1000;

const createSchema = z.object({
  place: z.object({
    osmId: z.string().max(40).optional(),
    name: z.string().trim().min(2).max(160),
    kind: z.string().max(30).optional(),
    address: z.string().max(300).default(""),
    phone: z.string().max(40).default(""),
    website: z.string().max(300).default(""),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
  }),
  specialty: z.string().max(80).default(""),
  reason: z.string().trim().max(600).default(""),
  triage: z.object({ specialty: z.string().max(40), urgency: z.string().max(20), summary: z.string().max(800) }).partial().optional(),
  startsAt: z.coerce
    .date()
    .refine((d) => d.getTime() > Date.now() - 5 * 60000, "Pick a time in the future")
    .refine((d) => d.getTime() < Date.now() + YEAR_MS, "Pick a date within the next year"),
});

async function findOwn(req) {
  const appt = await Appointment.findOne({ _id: req.params.id, userId: req.user.id });
  if (!appt) throw new HttpError(404, "Appointment not found.");
  return appt;
}

// POST /api/appointments/triage: which doctor, how soon.
router.post(
  "/triage",
  aiLimiter,
  validate(z.object({ symptoms: z.string().trim().min(3, "Describe your symptoms").max(1500) })),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    res.json(await ai.triage({ symptoms: req.body.symptoms, context: user ? aiContext(user) : undefined }));
  })
);

router.post(
  "/",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    const clash = await Appointment.findOne({
      userId: req.user.id,
      status: "planned",
      startsAt: { $gt: new Date(req.body.startsAt.getTime() - 30 * 60000), $lt: new Date(req.body.startsAt.getTime() + 30 * 60000) },
    });
    if (clash) throw new HttpError(409, `You already have a visit at ${clash.place.name} within 30 minutes of this time.`);

    const appt = await Appointment.create({ ...req.body, userId: req.user.id });
    if (user && !user.isGuest) {
      const sent = await sendAppointmentConfirmation({ to: user.email, userName: user.name, appointment: appt, icsContent: appointmentIcs(appt) });
      appt.confirmationEmailSent = sent.ok;
      await appt.save();
    }
    res.status(201).json(appt);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await Appointment.find({ userId: req.user.id }).sort({ startsAt: 1 }).lean();
    const now = Date.now();
    res.json({
      upcoming: rows.filter((a) => a.status === "planned" && new Date(a.startsAt).getTime() >= now - 3600000),
      past: rows.filter((a) => a.status !== "planned" || new Date(a.startsAt).getTime() < now - 3600000).reverse(),
    });
  })
);

router.get(
  "/:id/ics",
  asyncHandler(async (req, res) => {
    const appt = await findOwn(req);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="appointment-${appt._id}.ics"`);
    res.send(appointmentIcs(appt));
  })
);

router.patch(
  "/:id",
  validate(z.object({ status: z.enum(["planned", "completed", "cancelled"]) })),
  asyncHandler(async (req, res) => {
    const appt = await findOwn(req);
    appt.status = req.body.status;
    await appt.save();
    res.json(appt);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const appt = await findOwn(req);
    await appt.deleteOne();
    res.json({ deleted: true });
  })
);

module.exports = router;
