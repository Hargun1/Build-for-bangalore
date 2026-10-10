const router = require("express").Router();
const mongoose = require("mongoose");
const env = require("../config/env");
const ai = require("../services/aiService");
const { asyncHandler } = require("../middleware/errors");

// GET /api/system/status: what is configured and reachable. Shown on the
// in-app "System status" panel so a demo viewer can see which parts are live.
router.get(
  "/status",
  asyncHandler(async (req, res) => {
    let aiStatus = { reachable: false };
    try {
      const h = await ai.health();
      aiStatus = {
        reachable: true,
        aiReady: h.aiReady,
        providers: h.providers.map((p) => ({ provider: p.provider, configured: p.configured, healthy: p.configured && !p.disabledReason })),
      };
    } catch {
      /* AI service asleep or down */
    }
    res.json({
      api: "ok",
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      email: env.emailConfigured ? "configured" : "not configured",
      googleSignIn: env.googleClientId ? "configured" : "not configured",
      ai: aiStatus,
    });
  })
);

module.exports = router;
