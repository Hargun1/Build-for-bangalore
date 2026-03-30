const axios = require("axios");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

const aiClient = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: 180000,
  maxBodyLength: Infinity,
  maxContentLength: Infinity,
  headers: { "Content-Type": "application/json" },
});

module.exports = {
  predictRisk: (data) => aiClient.post("/predict/risk", data),
  recommend: (data) => aiClient.post("/recommend", data),
  baselineCompare: (data) => aiClient.post("/baseline-compare", data),
  glycemicCurve: (data) => aiClient.post("/glycemic-curve", data),
  sleepDebt: (data) => aiClient.post("/sleep-debt", data),
  dopamineScore: (data) => aiClient.post("/dopamine-score", data),
  biologicalAge: (data) => aiClient.post("/age-biological", data),
  groceryAnalyze: (data) => aiClient.post("/grocery-analyze", data),
  groceryAnalyzeImage: (data) => aiClient.post("/grocery-analyze/image", data),
  foodPlateAnalyze: (data) => aiClient.post("/food-plate", data),
  healthQA: (data) => aiClient.post("/health-qa", data),
  exposomeRisk: (data) => aiClient.post("/exposome-risk", data),
  goalPlan: (data) => aiClient.post("/goal-plan", data),
  emergencyDetect: (data) => aiClient.post("/emergency-detect", data),
};
