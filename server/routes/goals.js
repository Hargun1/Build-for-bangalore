const router = require("express").Router();
const crypto = require("crypto");
const { z } = require("zod");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { aiLimiter } = require("../middleware/rateLimit");
const { asyncHandler, HttpError } = require("../middleware/errors");
const User = require("../models/User");
const { Goal, GoalCheckin, TRACKED_METRICS } = require("../models/Goal");
const ai = require("../services/aiService");
const { aiContext, recentAverages, dayKey } = require("../services/userContext");
const { computeProgress, addDays } = require("../services/goalProgress");

router.use(auth);

const MAX_ACTIVE_GOALS = 6;

const planRequestSchema = z.object({
  description: z.string().trim().min(3, "Describe your goal in a few words").max(400),
  weeks: z.number().int().min(1).max(26).optional(),
});

const goalSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600).default(""),
  category: z.enum(["fitness", "sleep", "weight", "nutrition", "heart", "stress", "hydration", "other"]).default("other"),
  metric: z.enum(TRACKED_METRICS).default("habit"),
  direction: z.enum(["atLeast", "atMost", "reach"]).default("atLeast"),
  dailyTarget: z.number().nullable().optional(),
  startValue: z.number().nullable().optional(),
  targetValue: z.number().nullable().optional(),
  unit: z.string().max(20).default(""),
  weeks: z.number().int().min(1).max(26),
  milestones: z.array(z.object({ week: z.number().int().min(1).max(26), title: z.string().max(120), target: z.string().max(120).default("") })).max(26).default([]),
  habits: z.array(z.object({ title: z.string().trim().min(1).max(100), timeOfDay: z.string().max(20).default("any") })).max(5).default([]),
  tips: z.array(z.string().max(300)).max(5).default([]),
  planSource: z.string().max(80).default("manual"),
}).refine((g) => g.metric === "habit" || g.direction === "reach" || g.dailyTarget != null, {
  message: "A daily target is needed for this metric",
  path: ["dailyTarget"],
}).refine((g) => g.direction !== "reach" || (g.startValue != null && g.targetValue != null), {
  message: "Start and target values are needed",
  path: ["targetValue"],
});

const checkinSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  habitsDone: z.array(z.string().max(40)).max(5),
});

async function findGoal(req) {
  const goal = await Goal.findOne({ _id: req.params.id, userId: req.user.id });
  if (!goal) throw new HttpError(404, "Goal not found.");
  return goal;
}

// POST /api/goals/plan: AI turns a sentence into a measurable plan (preview only, not saved).
router.post(
  "/plan",
  aiLimiter,
  validate(planRequestSchema),
  asyncHandler(async (req, res) => {
    const [user, avg] = await Promise.all([User.findById(req.user.id), recentAverages(req.user.id, 7)]);
    const recent = Object.fromEntries(
      ["steps", "sleepHours", "weightKg", "systolic", "waterLitres", "restingHeartRate"].map((k) => [k, avg[k]])
    );
    res.json(await ai.goalPlan({ ...req.body, context: user ? aiContext(user) : undefined, recent }));
  })
);

router.post(
  "/",
  validate(goalSchema),
  asyncHandler(async (req, res) => {
    const active = await Goal.countDocuments({ userId: req.user.id, status: "active" });
    if (active >= MAX_ACTIVE_GOALS) throw new HttpError(400, `You can have up to ${MAX_ACTIVE_GOALS} active goals. Finish or remove one first.`);
    const { weeks, habits, ...rest } = req.body;
    const startDate = dayKey();
    const goal = await Goal.create({
      ...rest,
      userId: req.user.id,
      startDate,
      endDate: addDays(startDate, weeks * 7 - 1),
      habits: habits.map((h) => ({ ...h, id: crypto.randomBytes(4).toString("hex") })),
    });
    res.status(201).json({ ...goal.toObject(), progress: await computeProgress(goal) });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const goals = await Goal.find({ userId: req.user.id, status: { $ne: "abandoned" } }).sort({ createdAt: -1 });
    const withProgress = await Promise.all(
      goals.map(async (g) => {
        const progress = await computeProgress(g);
        // A goal reaching 100% is marked completed automatically.
        if (g.status === "active" && progress.percent >= 100) {
          g.status = "completed";
          await g.save();
        }
        return { ...g.toObject(), progress };
      })
    );
    res.json(withProgress);
  })
);

router.put(
  "/:id/checkin",
  validate(checkinSchema),
  asyncHandler(async (req, res) => {
    const goal = await findGoal(req);
    const day = req.body.day || dayKey();
    if (day < goal.startDate || day > goal.endDate || day > dayKey()) throw new HttpError(400, "That day is outside this goal.");
    const valid = new Set(goal.habits.map((h) => h.id));
    const habitsDone = [...new Set(req.body.habitsDone.filter((h) => valid.has(h)))];
    await GoalCheckin.findOneAndUpdate({ goalId: goal._id, day }, { $set: { habitsDone, userId: req.user.id } }, { upsert: true });
    res.json({ ...goal.toObject(), progress: await computeProgress(goal) });
  })
);

router.patch(
  "/:id",
  validate(z.object({ status: z.enum(["active", "completed", "abandoned"]) })),
  asyncHandler(async (req, res) => {
    const goal = await findGoal(req);
    goal.status = req.body.status;
    await goal.save();
    res.json({ ...goal.toObject(), progress: await computeProgress(goal) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const goal = await findGoal(req);
    await Promise.all([GoalCheckin.deleteMany({ goalId: goal._id }), goal.deleteOne()]);
    res.json({ deleted: true });
  })
);

module.exports = router;
