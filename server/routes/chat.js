const router = require("express").Router();
const { z } = require("zod");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { aiLimiter } = require("../middleware/rateLimit");
const { asyncHandler } = require("../middleware/errors");
const User = require("../models/User");
const ai = require("../services/aiService");
const { aiContext, recentAverages, metricsSummary } = require("../services/userContext");

const chatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(30)
    .refine((m) => m[m.length - 1].role === "user", "The last message must be from the user"),
  mode: z.enum(["general", "nutrition"]).default("general"),
});

// POST /api/chat: the conversation so far -> the assistant's next reply.
router.post(
  "/",
  auth,
  aiLimiter,
  validate(chatSchema),
  asyncHandler(async (req, res) => {
    const [user, avg] = await Promise.all([User.findById(req.user.id), recentAverages(req.user.id, 7)]);
    const result = await ai.chat({
      messages: req.body.messages.slice(-12),
      mode: req.body.mode,
      context: user ? aiContext(user) : undefined,
      metricsSummary: metricsSummary(avg) || undefined,
    });
    res.json(result);
  })
);

module.exports = router;
