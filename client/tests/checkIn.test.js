import { test } from "node:test";
import assert from "node:assert/strict";
import { makeCheckInPayload } from "../src/utils/checkIn.js";

test("quick check-in sends only edited readings", () => {
  const result = makeCheckInPayload({ steps: "6200", sleepHours: "7", weightKg: "78" }, new Set(["steps"]));
  assert.deepEqual(result.payload, { source: "manual", steps: 6200 });
});

test("blood pressure is always sent or cleared as a pair", () => {
  assert.deepEqual(makeCheckInPayload({ systolic: "124", diastolic: "78" }, new Set(["systolic"])).payload,
    { source: "manual", systolic: 124, diastolic: 78 });
  assert.deepEqual(makeCheckInPayload({ systolic: "", diastolic: "" }, new Set(["systolic", "diastolic"])).payload,
    { source: "manual", systolic: null, diastolic: null });
  assert.match(makeCheckInPayload({ systolic: "124", diastolic: "" }, new Set(["systolic"])).error, /both/);
  assert.match(makeCheckInPayload({ systolic: "70", diastolic: "120" }, new Set(["systolic"])).error, /higher/);
});

test("an unchanged form does not create an empty daily record", () => {
  assert.ok(makeCheckInPayload({}, new Set()).error);
});
