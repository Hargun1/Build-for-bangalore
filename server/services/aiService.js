const axios = require("axios");
const env = require("../config/env");
const { HttpError } = require("../middleware/errors");

// The Python service sleeps on Render's free tier; the first call can take ~50 s to wake it.
const client = axios.create({
  baseURL: env.aiServiceUrl,
  timeout: 90000,
  headers: { "Content-Type": "application/json" },
  maxBodyLength: 10 * 1024 * 1024,
});

client.interceptors.request.use((config) => {
  if (env.aiInternalToken) config.headers["X-Internal-Token"] = env.aiInternalToken;
  return config;
});

async function call(path, payload) {
  try {
    const { data } = await client.post(path, payload);
    return data;
  } catch (err) {
    if (err.response) {
      const detail = err.response.data?.detail;
      const message = typeof detail === "string" ? detail : `AI service error (${err.response.status})`;
      // 503 means "AI temporarily unavailable" and is passed through; other 5xx become 502.
      const status = err.response.status === 503 ? 503 : err.response.status >= 500 ? 502 : err.response.status;
      throw new HttpError(status, message);
    }
    throw new HttpError(503, "The AI service is unreachable right now. Please try again in a minute.");
  }
}

// Returns the AI service's SSE response body as a Node stream (the caller pipes it on).
async function chatStream(payload, signal) {
  try {
    const res = await client.post("/chat/stream", payload, { responseType: "stream", signal, timeout: 0 });
    return res.data;
  } catch (err) {
    if (err.response) throw new HttpError(err.response.status >= 500 ? 502 : err.response.status, `AI service error (${err.response.status})`);
    throw new HttpError(503, "The AI service is unreachable right now. Please try again in a minute.");
  }
}

module.exports = {
  call,
  chatStream,
  health: () => client.get("/health", { timeout: 10000 }).then((r) => r.data),
  riskAssess: (p) => call("/risk/assess", p),
  chat: (p) => call("/chat", p),
  analyzeMeal: (p) => call("/vision/meal", p),
  analyzeGroceryPhoto: (p) => call("/vision/grocery", p),
  reviewProduct: (p) => call("/nutrition/product-review", p),
  goalPlan: (p) => call("/goals/plan", p),
  exposomeAdvice: (p) => call("/exposome/advice", p),
  triage: (p) => call("/triage", p),
};
