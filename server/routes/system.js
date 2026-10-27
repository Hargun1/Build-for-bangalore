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
      const providers = h.providers.map((p) => {
        const available = (p.availableTextModels || []).length > 0;
        const recentlyWorked = p.lastOkAt && Date.now() / 1000 - p.lastOkAt < 15 * 60;
        let state = "unavailable";
        if (!p.configured) state = "not-configured";
        else if (p.disabledReason) state = "rejected";
        else if (available) state = recentlyWorked ? "recently-working" : "available";
        else if (p.restingForSeconds > 0 || Object.keys(p.restingModels || {}).length > 0) state = "rate-limited";
        return { provider: p.provider, state };
      });
      aiStatus = {
        reachable: true,
        aiReady: h.aiReady,
        providers,
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
