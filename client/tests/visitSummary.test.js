import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVisitSummary } from "../src/utils/visitSummary.js";

test("visit summary uses dated real readings and checked lab flags", () => {
  const summary = buildVisitSummary({
    todayDay: "2026-10-27",
    user: { name: "Ananya", age: 35, profile: { medications: ["Medicine A"], allergies: ["Peanuts"] } },
    metrics: [
      { day: "2026-10-27", steps: 6000, systolic: 122, diastolic: 78 },
      { day: "2026-10-26", steps: 80000, source: "simulator" },
      { day: "2026-10-25", steps: 7000 },
    ],
    reports: [{ reportDate: "2026-10-20", labName: "City Lab", tests: [
      { display: "HbA1c", valueText: "6.1", unit: "%", refRange: "4-5.6", status: "high" },
      { display: "Hemoglobin", valueText: "13", status: "normal" },
    ] }],
    prediction: { createdAt: "2026-10-21T10:00:00Z", scores: [{ label: "Diabetes", level: "moderate", value: 52 }, { label: "Heart", level: "unknown" }] },
  });
  assert.deepEqual(summary.recentReadings.map((row) => row.day), ["2026-10-27", "2026-10-25"]);
  assert.equal(summary.flags.length, 1);
  assert.deepEqual(summary.reportList, [{ date: "2026-10-20", lab: "City Lab", testCount: 2, unknownCount: 0 }]);
  assert.deepEqual(summary.flags[0], { date: "2026-10-20", lab: "City Lab", name: "HbA1c", value: "6.1", unit: "%", range: "4-5.6", status: "high" });
  assert.equal(summary.scores.length, 1);
  assert.deepEqual(summary.medications, ["Medicine A"]);
});

test("visit summary remains honest when records are missing", () => {
  const summary = buildVisitSummary({ user: { name: "Guest" }, todayDay: "2026-10-27" });
  assert.equal(summary.reportCount, 0);
  assert.equal(summary.recentReadings.length, 0);
  assert.equal(summary.scores.length, 0);
  assert.equal(summary.recap.metrics[0].current, null);
});
