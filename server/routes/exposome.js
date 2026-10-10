const router = require("express").Router();
const { z } = require("zod");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { asyncHandler } = require("../middleware/errors");
const User = require("../models/User");
const ExposomeData = require("../models/ExposomeData");
const ai = require("../services/aiService");
const { fetchEnvironment } = require("../services/environment");
const { aiContext } = require("../services/userContext");

router.use(auth);

// Default: central Bengaluru, used only when the browser does not share a location.
const coords = z.object({
  lat: z.coerce.number().min(-90).max(90).default(12.9716),
  lon: z.coerce.number().min(-180).max(180).default(77.5946),
  advice: z.enum(["0", "1"]).default("1"),
});

// GET /api/exposome?lat=..&lon=..
router.get(
  "/",
  validate(coords, "query"),
  asyncHandler(async (req, res) => {
    const { lat, lon, advice } = req.validatedQuery;
    const user = await User.findById(req.user.id);
    const data = await fetchEnvironment(lat, lon, user?.profile?.conditions || []);

    let aiAdvice = null;
    if (advice === "1") {
      try {
        aiAdvice = await ai.exposomeAdvice({
          aqi: data.airQuality?.aqi,
          aqiCategory: data.airQuality?.name || "",
          dominantPollutant: data.airQuality?.dominant || "",
          temperatureC: data.current.temp,
          feelsLikeC: data.current.feelsLike,
          humidity: data.current.humidity,
          uvIndex: data.sun.uvMax,
          bestWindow: data.bestWindow ? `${data.bestWindow.start.slice(11, 16)}-${data.bestWindow.end.slice(11, 16)}` : null,
          alerts: data.alerts.map((a) => a.title),
          context: user ? aiContext(user) : undefined,
        });
      } catch {
        aiAdvice = null; // the live data is still shown without the AI tips
      }
    }

    // One snapshot per user per hour for the history chart (best effort).
    const hour = data.hourly[0]?.time?.slice(0, 13);
    if (hour) {
      ExposomeData.updateOne(
        { userId: req.user.id, hour },
        {
          $set: {
            aqi: data.airQuality?.aqi,
            aqiCategory: data.airQuality?.name,
            dominantPollutant: data.airQuality?.dominant,
            pm25: data.airQuality?.pollutants?.pm25,
            temp: data.current.temp,
            feelsLike: data.current.feelsLike,
            uvIndex: data.current.uvIndex,
            area: data.location.area,
            city: data.location.city,
          },
        },
        { upsert: true }
      ).catch(() => {});
    }

    res.json({ ...data, aiAdvice });
  })
);

router.get(
  "/history",
  asyncHandler(async (req, res) => {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const rows = await ExposomeData.find({ userId: req.user.id, createdAt: { $gte: since } }).sort({ hour: 1 }).lean();
    res.json(rows);
  })
);

module.exports = router;
