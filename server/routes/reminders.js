const router = require("express").Router();
const { z } = require("zod");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { asyncHandler, HttpError } = require("../middleware/errors");
const Reminder = require("../models/Reminder");
const PushSubscription = require("../models/PushSubscription");
const push = require("../services/push");

router.use(auth);

const idParam = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/, "Invalid id") });
const reminderSchema = z.object({
  kind: z.enum(["medicine", "water", "checkup", "custom"]).default("custom"),
  title: z.string().trim().min(1, "Give the reminder a name").max(80),
  note: z.string().trim().max(160).default(""),
  times: z
    .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM times"))
    .min(1, "Add at least one time")
    .max(12, "Up to 12 times a day")
    .transform((t) => [...new Set(t)].sort()),
  // All 7 days is stored as [] ("every day").
  days: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .default([])
    .transform((d) => {
      const u = [...new Set(d)].sort();
      return u.length === 7 ? [] : u;
    }),
  enabled: z.boolean().default(true),
});
const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(1000)
    .refine((u) => u.startsWith("https://"), "Push endpoints must be HTTPS"),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});

const view = (r) => ({
  _id: r._id,
  kind: r.kind,
  title: r.title,
  note: r.note,
  times: r.times,
  days: r.days,
  enabled: r.enabled,
  lastSentAt: r.lastSentAt,
  lastResult: r.lastResult,
});

router.get(
  "/push/status",
  asyncHandler(async (req, res) => {
    res.json({ configured: push.configured(), publicKey: push.publicKey(), devices: await PushSubscription.countDocuments({ userId: req.user.id }) });
  })
);

router.post(
  "/push/subscribe",
  validate(subscriptionSchema),
  asyncHandler(async (req, res) => {
    if (!push.configured()) throw new HttpError(503, "Notifications aren't set up on this server yet");
    const { endpoint, keys } = req.body;
    // The same browser re-subscribing (or a different account on it) replaces the old record.
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { userId: req.user.id, endpoint, keys, userAgent: String(req.get("user-agent") || "").slice(0, 200) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ ok: true });
  })
);

router.post(
  "/push/unsubscribe",
  validate(z.object({ endpoint: z.string().max(1000) })),
  asyncHandler(async (req, res) => {
    await PushSubscription.deleteOne({ endpoint: req.body.endpoint, userId: req.user.id });
    res.json({ ok: true });
  })
);

router.post(
  "/push/test",
  asyncHandler(async (req, res) => {
    const result = await push.sendToUser(req.user.id, { title: "🔔 Notifications are working", body: "This is how your reminders will look.", tag: "test", url: "/reminders" });
    if (!result.devices) throw new HttpError(400, "Turn on notifications on this device first");
    res.json(result);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await Reminder.find({ userId: req.user.id }).sort({ createdAt: 1 }).lean();
    res.json(rows.map(view));
  })
);

router.post(
  "/",
  validate(reminderSchema),
  asyncHandler(async (req, res) => {
    if ((await Reminder.countDocuments({ userId: req.user.id })) >= 30) throw new HttpError(400, "You can have up to 30 reminders");
    const r = await Reminder.create({ ...req.body, userId: req.user.id });
    res.status(201).json(view(r));
  })
);

router.put(
  "/:id",
  validate(idParam, "params"),
  validate(reminderSchema),
  asyncHandler(async (req, res) => {
    const r = await Reminder.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, req.body, { new: true });
    if (!r) throw new HttpError(404, "Reminder not found");
    res.json(view(r));
  })
);

router.delete(
  "/:id",
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const gone = await Reminder.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!gone) throw new HttpError(404, "Reminder not found");
    res.json({ ok: true });
  })
);

module.exports = router;
