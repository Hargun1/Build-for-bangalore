import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWeeklyRecap, shiftDay } from "../src/utils/weeklyRecap.js";

test("weekly recap never treats missing days as zero", () => {
  const recap = buildWeeklyRecap([], "2026-10-27");
  assert.equal(recap.recentDays, 0);
  assert.equal(recap.metrics[0].current, null);
  assert.equal(recap.metrics[0].change, null);
  assert.equal(recap.action.kind, "checkin");
});

test("weekly recap compares only measured days in two rolling weeks", () => {
  const day = "2026-11-02";
  const rows = [
    { day, steps: 6000, sleepHours: 7, systolic: 124 },
    { day: shiftDay(day, -2), steps: 8000, sleepHours: 8, systolic: 128 },
    { day: shiftDay(day, -4), steps: 7000 },
    { day: shiftDay(day, -8), steps: 5000, sleepHours: 6, systolic: 120 },
    { day: shiftDay(day, -10), steps: 6000, sleepHours: 7, systolic: 122 },
    { day: shiftDay(day, -1), steps: 100000, source: "simulator" },
  ];
  const recap = buildWeeklyRecap(rows, day);
  assert.equal(recap.recentDays, 3);
  assert.equal(recap.previousDays, 2);
  assert.equal(recap.metrics[0].current, 7000);
  assert.equal(recap.metrics[0].change, 1500);
  assert.equal(recap.metrics[1].current, 7.5);
  assert.equal(recap.metrics[2].change, 5);
  assert.equal(recap.action.kind, "summary");
});

test("one reading in each week is shown but not compared", () => {
  const rows = [{ day: "2026-10-27", steps: 7000 }, { day: "2026-10-20", steps: 5000 }];
  const recap = buildWeeklyRecap(rows, "2026-10-27");
  assert.equal(recap.metrics[0].current, 7000);
  assert.equal(recap.metrics[0].change, null);
  assert.ok(recap.unknowns.some((item) => item.includes("Fewer than three")));
});
