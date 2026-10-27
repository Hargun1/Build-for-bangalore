import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { participantSummary } from "../src/utils/fitbitDemo.js";

const data = JSON.parse(readFileSync(new URL("../src/data/fitbitDemo.json", import.meta.url), "utf8"));

test("Fitbit demo contains distinct anonymous profiles and valid historical records", () => {
  assert.equal(data.profiles.length, 35);
  assert.equal(new Set(data.profiles.map((profile) => profile.id)).size, 35);
  assert.equal(data.profiles.reduce((sum, profile) => sum + profile.days.length, 0), 457);
  for (const profile of data.profiles) {
    assert.match(profile.id, /^Profile \d{2}$/);
    assert.ok(profile.days.length >= 8);
    assert.equal(new Set(profile.days.map((row) => row.day)).size, profile.days.length);
    for (const row of profile.days) {
      assert.match(row.day, /^2016-0[34]-\d{2}$/);
      assert.ok(Number.isInteger(row.steps) && row.steps >= 0 && row.steps <= 100000);
      assert.ok(Number.isFinite(row.distanceKm) && row.distanceKm >= 0);
      assert.ok(Number.isInteger(row.activeMinutes) && row.activeMinutes >= 0 && row.activeMinutes <= 1440);
    }
  }
});

test("profile summary uses recorded days and never fills gaps with zero", () => {
  const summary = participantSummary({ id: "Profile 99", days: [
    { day: "2016-03-15", steps: 9000, distanceKm: 6.1, activeMinutes: 80 },
    { day: "2016-03-12", steps: 3000, distanceKm: 2.1, activeMinutes: 40 },
  ] });
  assert.equal(summary.days, 2);
  assert.equal(summary.averageSteps, 6000);
  assert.equal(summary.averageDistanceKm, 4.1);
  assert.equal(summary.firstDay, "2016-03-12");
  assert.equal(summary.lastDay, "2016-03-15");
  assert.deepEqual(summary.chart.map((row) => row.day), ["2016-03-12", "2016-03-15"]);
});
