const router = require("express").Router();
const { z } = require("zod");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { aiLimiter } = require("../middleware/rateLimit");
const { asyncHandler, HttpError } = require("../middleware/errors");
const User = require("../models/User");
const HealthMetrics = require("../models/HealthMetrics");
const Prediction = require("../models/Prediction");
const FoodLog = require("../models/FoodLog");
const ai = require("../services/aiService");
const { assessRiskRules } = require("../services/riskRules");
const { dayKey, daysAgoKey, aiContext, recentAverages } = require("../services/userContext");

router.use(auth);

const num = (min, max) => z.number().min(min).max(max).nullable().optional();
const metricsSchema = z
  .object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    steps: num(0, 100000),
    sleepHours: num(0, 24),
    restingHeartRate: num(20, 250),
    systolic: num(50, 260),
    diastolic: num(30, 180),
    spo2: num(50, 100),
    temperatureC: num(30, 45),
    weightKg: num(10, 400),
    waterLitres: num(0, 15),
    stressLevel: num(0, 10),
    screenTimeHours: num(0, 24),
    hrvMs: num(0, 500),
    source: z.enum(["manual", "bluetooth"]).default("manual"),
  })
  .refine((m) => !m.day || m.day <= dayKey(), { message: "Cannot log a future day", path: ["day"] })
  .refine((m) => m.systolic == null || m.diastolic == null || m.systolic > m.diastolic, {
    message: "Systolic (top number) must be higher than diastolic",
    path: ["systolic"],
  });

const METRIC_FIELDS = ["steps", "sleepHours", "restingHeartRate", "systolic", "diastolic", "spo2", "temperatureC", "weightKg", "waterLitres", "stressLevel", "screenTimeHours", "hrvMs"];

// PUT /api/health/metrics: create or update one day's entry (only the fields sent change).
router.put(
  "/metrics",
  validate(metricsSchema),
  asyncHandler(async (req, res) => {
    const { day = dayKey(), source, ...values } = req.body;
    const set = { source };
    const unset = {};
    for (const key of METRIC_FIELDS) {
      if (values[key] === null) unset[key] = "";
      else if (values[key] !== undefined) set[key] = values[key];
    }
    // A legacy demo row must not carry simulated fields into a real entry.
    const demoUnset = Object.fromEntries(METRIC_FIELDS.filter((key) => !(key in set)).map((key) => [key, ""]));
    const replacedDemo = await HealthMetrics.findOneAndUpdate(
      { userId: req.user.id, day, source: "simulator" },
      { $set: set, $unset: demoUnset },
      { new: true }
    );
    const doc = replacedDemo || await HealthMetrics.findOneAndUpdate(
      { userId: req.user.id, day },
      { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    // Keep the profile weight current so risk scores use the latest value.
    if (typeof set.weightKg === "number" && day === dayKey()) {
      await User.updateOne({ _id: req.user.id }, { $set: { "profile.weightKg": set.weightKg } });
    }
    res.json(doc);
  })
);

// GET /api/health/metrics?days=30: one row per logged day, newest first.
router.get(
  "/metrics",
  validate(z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }), "query"),
  asyncHandler(async (req, res) => {
    const rows = await HealthMetrics.find({ userId: req.user.id, source: { $ne: "simulator" }, day: { $gte: daysAgoKey(req.validatedQuery.days - 1) } })
      .sort({ day: -1 })
      .lean();
    res.json(rows);
  })
);

// GET /api/health/today: today's log, food totals and 7-day averages for the dashboard.
router.get(
  "/today",
  asyncHandler(async (req, res) => {
    const today = dayKey();
    const [metrics, meals, averages] = await Promise.all([
      HealthMetrics.findOne({ userId: req.user.id, day: today, source: { $ne: "simulator" } }).lean(),
      FoodLog.find({ userId: req.user.id, day: today }).lean(),
      recentAverages(req.user.id, 7),
    ]);
    const calories = meals.reduce((sum, m) => sum + (m.totals?.calories || 0), 0);
    res.json({ day: today, metrics: metrics || null, meals: meals.length, caloriesEaten: Math.round(calories), averages });
  })
);

// POST /api/health/analyze: deterministic risk scores + AI explanation, saved to history.
router.post(
  "/analyze",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw new HttpError(404, "Account not found.");
    const avg = await recentAverages(req.user.id, 14);
    const p = user.profile || {};
    const inputs = {
      age: user.age ?? undefined,
      sex: user.gender,
      heightCm: p.heightCm,
      weightKg: avg.weightKg ?? p.weightKg,
      waistCm: p.waistCm,
      activityLevel: p.activityLevel,
      familyHistoryDiabetes: p.familyHistoryDiabetes,
      smoker: p.smoker,
      hasDiabetes: p.hasDiabetes,
      onBpMedication: p.onBpMedication,
      systolic: avg.systolic ?? undefined,
      diastolic: avg.diastolic ?? undefined,
      avgSleepHours: avg.sleepHours ?? undefined,
      avgSteps: avg.steps ?? undefined,
      avgStress: avg.stressLevel ?? undefined,
      restingHeartRate: avg.restingHeartRate ?? undefined,
      daysLogged: avg.daysLogged,
    };
    // Drop undefined so pydantic sees missing values as missing.
    Object.keys(inputs).forEach((k) => inputs[k] === undefined && delete inputs[k]);

    let result;
    try {
      result = await ai.riskAssess({ inputs, context: aiContext(user), explain: true });
    } catch (err) {
      if (![429, 502, 503, 504].includes(err.status)) throw err;
      result = assessRiskRules(inputs);
    }
    const prediction = await Prediction.create({
      userId: req.user.id,
      scores: result.scores,
      wellnessScore: result.wellnessScore,
      summary: result.summary,
      recommendations: result.recommendations,
      aiSource: result.aiSource,
      inputsSnapshot: inputs,
    });
    res.json(prediction);
  })
);

// GET /api/health/predictions?limit=10
router.get(
  "/predictions",
  validate(z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) }), "query"),
  asyncHandler(async (req, res) => {
    const rows = await Prediction.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(req.validatedQuery.limit).lean();
    res.json(rows);
  })
);

module.exports = router;
