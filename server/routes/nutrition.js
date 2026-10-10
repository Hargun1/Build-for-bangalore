const router = require("express").Router();
const { z } = require("zod");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { aiLimiter } = require("../middleware/rateLimit");
const { asyncHandler, HttpError } = require("../middleware/errors");
const User = require("../models/User");
const FoodLog = require("../models/FoodLog");
const GroceryScan = require("../models/GroceryScan");
const ai = require("../services/aiService");
const off = require("../services/openFoodFacts");
const { aiContext, dayKey, daysAgoKey } = require("../services/userContext");

router.use(auth);

// Base64 image, optionally as a data URI. ~7 MB of text = ~5 MB image.
const imageSchema = z.object({
  image: z
    .string()
    .min(100, "Please attach a photo")
    .max(7_000_000, "Photo is too large; please use one under 5 MB")
    .regex(/^(data:image\/(png|jpe?g|webp);base64,)?[A-Za-z0-9+/=\s]+$/, "Unsupported image format; use JPG, PNG or WebP"),
});

const n = z.number().min(0).max(100000).default(0);
const mealSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  title: z.string().trim().max(120).default("Meal"),
  items: z
    .array(z.object({ name: z.string().max(80), portion: z.string().max(60).default(""), grams: n, calories: n, proteinG: n, carbsG: n, fatG: n, fiberG: n, sugarG: n, sodiumMg: n }))
    .min(1)
    .max(30),
  healthScore: z.number().min(0).max(10).optional(),
  source: z.enum(["photo", "barcode", "manual"]).default("photo"),
});

async function contextFor(req) {
  const user = await User.findById(req.user.id);
  return user ? aiContext(user) : undefined;
}

router.post(
  "/meal/analyze",
  aiLimiter,
  validate(imageSchema),
  asyncHandler(async (req, res) => {
    res.json(await ai.analyzeMeal({ image: req.body.image, context: await contextFor(req) }));
  })
);

router.post(
  "/meals",
  validate(mealSchema),
  asyncHandler(async (req, res) => {
    const keys = ["calories", "proteinG", "carbsG", "fatG", "fiberG", "sugarG", "sodiumMg"];
    // Totals are recomputed here; the client's numbers are never trusted for sums.
    const totals = Object.fromEntries(keys.map((k) => [k, Math.round(req.body.items.reduce((s, i) => s + (i[k] || 0), 0) * 10) / 10]));
    const log = await FoodLog.create({ userId: req.user.id, day: dayKey(), ...req.body, totals });
    res.status(201).json(log);
  })
);

router.get(
  "/meals",
  validate(z.object({ days: z.coerce.number().int().min(1).max(90).default(7) }), "query"),
  asyncHandler(async (req, res) => {
    const rows = await FoodLog.find({ userId: req.user.id, day: { $gte: daysAgoKey(req.validatedQuery.days - 1) } })
      .sort({ createdAt: -1 })
      .lean();
    res.json(rows);
  })
);

router.delete(
  "/meals/:id",
  asyncHandler(async (req, res) => {
    const out = await FoodLog.deleteOne({ _id: req.params.id, userId: req.user.id });
    if (!out.deletedCount) throw new HttpError(404, "Meal not found.");
    res.json({ deleted: true });
  })
);

router.post(
  "/grocery/analyze",
  aiLimiter,
  validate(imageSchema),
  asyncHandler(async (req, res) => {
    const result = await ai.analyzeGroceryPhoto({ image: req.body.image, context: await contextFor(req) });
    if (result.isGrocery) {
      await GroceryScan.create({ userId: req.user.id, source: "photo", items: result.items, score: result.score, summary: result.summary, aiSource: result.aiSource });
    }
    res.json(result);
  })
);

// GET /api/nutrition/product/:barcode: real label data + a review for this user.
router.get(
  "/product/:barcode",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const product = await off.getProduct(req.params.barcode);
    let review;
    try {
      review = await ai.reviewProduct({
        product: {
          name: product.name,
          brand: product.brand,
          nutriScore: product.nutriScore,
          novaGroup: product.novaGroup,
          per100g: product.per100g,
          ingredients: product.ingredients,
          allergens: product.allergens,
          additives: product.additives,
          categories: product.categories,
        },
        context: await contextFor(req),
      });
    } catch {
      review = null; // label data is still useful on its own
    }
    const verdictToVerdict = { good: "good", okay: "moderate", limit: "limit" };
    await GroceryScan.create({
      userId: req.user.id,
      source: "barcode",
      items: [{ name: product.name, barcode: product.barcode, nutriScore: product.nutriScore, novaGroup: product.novaGroup, verdict: verdictToVerdict[review?.verdict] || "moderate", reason: review?.headline || "" }],
      summary: review?.headline,
      aiSource: review?.aiSource,
    });
    res.json({ product, review });
  })
);

router.get(
  "/grocery/history",
  asyncHandler(async (req, res) => {
    res.json(await GroceryScan.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(20).lean());
  })
);

module.exports = router;
