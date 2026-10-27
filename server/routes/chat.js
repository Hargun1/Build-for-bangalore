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

async function buildPayload(req) {
  const [user, avg] = await Promise.all([User.findById(req.user.id), recentAverages(req.user.id, 7)]);
  return {
    messages: req.body.messages.slice(-12),
    mode: req.body.mode,
    context: user ? aiContext(user) : undefined,
    metricsSummary: metricsSummary(avg) || undefined,
  };
}

// POST /api/chat: the conversation so far -> the assistant's next reply.
router.post(
  "/",
  auth,
  aiLimiter,
  validate(chatSchema),
  asyncHandler(async (req, res) => {
    try {
      res.json(await ai.chat(await buildPayload(req)));
    } catch (err) {
      if (![429, 502, 503, 504].includes(err.status)) throw err;
      res.status(503).json({ message: "The assistant cannot check your message right now. If this could be an emergency, call 112 or seek in-person care now." });
    }
  })
);

const sseEvent = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

// POST /api/chat/stream: same reply as server-sent events (delta ... done | error),
// relayed from the AI service as it is generated.
router.post(
  "/stream",
  auth,
  aiLimiter,
  validate(chatSchema),
  asyncHandler(async (req, res) => {
    const payload = await buildPayload(req);
    const controller = new AbortController();

    res.status(200).set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // stop proxies (Render, nginx) from buffering the stream
    });
    res.flushHeaders();
    // Free providers can be silent during startup or fallback; keep proxy idle timers alive.
    res.write(": connected\n\n");
    const heartbeat = setInterval(() => {
      if (!res.destroyed && !res.writableEnded) res.write(": keep-alive\n\n");
    }, 10000);
    // If the user closes the tab or presses Stop, stop the AI call too (saves free quota).
    res.on("close", () => {
      clearInterval(heartbeat);
      if (!res.writableEnded) controller.abort();
    });

    let upstream;
    try {
      upstream = await ai.chatStream(payload, controller.signal);
    } catch (err) {
      if (!controller.signal.aborted) {
        res.write(sseEvent("error", { message: `${err.message || "The AI assistant is unavailable right now."} If this could be an emergency, call 112 or seek in-person care now.` }));
      }
      res.end();
      return;
    }
    upstream.on("error", () => {
      if (!res.writableEnded) {
        res.write(sseEvent("error", { message: "The answer was cut off. Please ask again.", partial: true }));
        res.end();
      }
    });
    upstream.pipe(res);
  })
);

module.exports = router;
