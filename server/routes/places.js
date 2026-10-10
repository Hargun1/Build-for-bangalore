const router = require("express").Router();
const { z } = require("zod");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { asyncHandler } = require("../middleware/errors");
const { nearby } = require("../services/places");

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  kinds: z
    .string()
    .default("hospital,clinic")
    .transform((s) => s.split(",").map((k) => k.trim()))
    .pipe(z.array(z.enum(["hospital", "clinic", "dentist", "pharmacy"])).min(1)),
  radiusKm: z.coerce.number().min(0.5).max(15).default(5),
  specialty: z.string().regex(/^[a-z_]{3,30}$/).optional(),
});

// GET /api/places/nearby?lat=..&lon=..&kinds=hospital,clinic&specialty=cardiology
router.get(
  "/nearby",
  auth,
  validate(querySchema, "query"),
  asyncHandler(async (req, res) => {
    const places = await nearby(req.validatedQuery);
    res.json({ places, attribution: "© OpenStreetMap contributors (ODbL)" });
  })
);

module.exports = router;
