const { assessRiskRules } = require("../services/riskRules");
const parityCases = require("./fixtures/risk-parity.json");

const full = {
  age: 55, sex: "male", heightCm: 175, weightKg: 79.6, waistCm: 95,
  activityLevel: "moderate", familyHistoryDiabetes: "one_parent", smoker: false,
  hasDiabetes: false, onBpMedication: false, systolic: 140, diastolic: 88,
  avgSleepHours: 7, avgSteps: 6000, avgStress: 4, daysLogged: 3,
};

test("offline risk uses the published score bands and deterministic inputs", () => {
  const result = assessRiskRules(full);
  const scores = Object.fromEntries(result.scores.map((s) => [s.key, s]));
  expect(scores.diabetes).toEqual(expect.objectContaining({ value: 60, level: "high", percent: 60 }));
  expect(scores.heart.level).toBe("moderate");
  expect(scores.heart.value).toBeGreaterThanOrEqual(10);
  expect(scores.heart.value).toBeLessThan(20);
  expect(scores.weight).toEqual(expect.objectContaining({ value: 26, level: "high" }));
  expect(scores.bloodPressure.level).toBe("high");
  expect(scores.activity.level).toBe("moderate");
  expect(result.aiSource).toBe("rules");
  expect(result.recommendations).toEqual([]);
});

test.each(parityCases)("offline scores match Python risk.py: $name", ({ inputs, wellnessScore, scores }) => {
  const result = assessRiskRules(inputs);
  expect(result.wellnessScore).toBe(wellnessScore);
  expect(result.scores.map((s) => [s.key, s.value, s.percent, s.level])).toEqual(scores);
});

test("missing or implausible inputs cannot become reassuring scores", () => {
  const result = assessRiskRules({ heightCm: 900, systolic: 999, avgSteps: -1 });
  expect(result.scores.every((s) => s.level === "unknown")).toBe(true);
  expect(result.wellnessScore).toBeNull();
  expect(result.summary).toMatch(/not enough information/i);
});

test("one low score cannot make an incomplete profile sound healthy", () => {
  const result = assessRiskRules({ avgSleepHours: 8 });
  expect(result.wellnessScore).toBe(100);
  expect(result.summary).toMatch(/some could not be calculated/i);
});

test("known diabetes and unvalidated Framingham age remain unknown", () => {
  const result = assessRiskRules({ ...full, age: 25, hasDiabetes: true });
  expect(result.scores[0]).toEqual(expect.objectContaining({ level: "unknown", note: expect.stringContaining("already have diabetes") }));
  expect(result.scores[1]).toEqual(expect.objectContaining({ level: "unknown", note: expect.stringContaining("30 to 74") }));
});

test("crisis-range blood pressure includes a visible action warning", () => {
  const bp = assessRiskRules({ systolic: 185, diastolic: 95 }).scores.find((s) => s.key === "bloodPressure");
  expect(bp.level).toBe("high");
  expect(bp.note).toMatch(/call 112 now/i);
});
