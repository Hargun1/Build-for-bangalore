const router = require("express").Router();
const { z } = require("zod");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { aiLimiter } = require("../middleware/rateLimit");
const { asyncHandler, HttpError } = require("../middleware/errors");
const User = require("../models/User");
const LabReport = require("../models/LabReport");
const ai = require("../services/aiService");
const { dayKey } = require("../services/userContext");

router.use(auth);

const page = z
  .string()
  .min(100, "Please attach a photo of the report")
  .max(7_000_000, "A page is too large; please use one under 5 MB")
  .regex(/^(data:image\/(png|jpe?g|webp);base64,)?[A-Za-z0-9+/=\s]+$/, "Unsupported image format; use JPG, PNG, WebP or a PDF");

const row = z.object({
  name: z.string().trim().min(1).max(80),
  key: z.string().max(40).nullish(),
  value: z.string().trim().min(1).max(40),
  unit: z.string().trim().max(30).default(""),
  refRange: z.string().trim().max(80).default(""),
});

const saveSchema = z.object({
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date as YYYY-MM-DD"),
  labName: z.string().trim().max(80).default(""),
  tests: z.array(row).min(1).max(120),
  aiSource: z.string().max(80).optional(),
});

async function sexOf(req) {
  const user = await User.findById(req.user.id).select("gender").lean();
  return ["male", "female"].includes(user?.gender) ? user.gender : undefined;
}

// Reads the pages and returns checked results. Nothing is saved until the user confirms.
router.post(
  "/read",
  aiLimiter,
  validate(z.object({ images: z.array(page).min(1, "Please attach a photo of the report").max(4, "Up to 4 pages at a time") })),
  asyncHandler(async (req, res) => {
    res.json(await ai.readLabReport({ images: req.body.images, sex: await sexOf(req) }));
  })
);

// Saves the (possibly corrected) rows. They are re-checked by the AI service's rule code,
// so a status can never come from the browser.
router.post(
  "/",
  validate(saveSchema),
  asyncHandler(async (req, res) => {
    const { reportDate, labName, tests, aiSource } = req.body;
    if (reportDate > dayKey()) throw new HttpError(400, "The report date is in the future");
    const checked = await ai.evaluateLabs({ tests: tests.map((t) => ({ ...t, key: t.key || "other" })), sex: await sexOf(req) });
    const doc = await LabReport.create({ userId: req.user.id, reportDate, labName, tests: checked.tests, counts: checked.counts, summary: checked.summary, aiSource });
    res.status(201).json(doc);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await LabReport.find({ userId: req.user.id }).sort({ reportDate: -1, createdAt: -1 }).limit(50).lean());
  })
);

router.delete(
  "/:id",
  validate(z.object({ id: z.string().regex(/^[a-f0-9]{24}$/, "Invalid id") }), "params"),
  asyncHandler(async (req, res) => {
    const gone = await LabReport.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!gone) throw new HttpError(404, "Report not found");
    res.json({ ok: true });
  })
);

module.exports = router;
