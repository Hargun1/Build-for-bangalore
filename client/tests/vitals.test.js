import { test } from "node:test";
import assert from "node:assert/strict";
import { hasRecentVitals, sosVitalPayload, vitalLogPayload } from "../src/utils/vitals.js";

const now = 1_000_000;

test("a live pulse alone is not saved as resting heart rate", () => {
  const vitals = { heartRate: 72, timestamp: now };
  assert.equal(vitalLogPayload(vitals, "bluetooth", null, now), null);
  assert.deepEqual(vitalLogPayload(vitals, "bluetooth", { heartRate: 72, timestamp: now, source: "bluetooth" }, now), {
    source: "bluetooth",
    restingHeartRate: 72,
  });
});

test("other measured vitals can be saved without claiming the pulse is resting", () => {
  const vitals = { heartRate: 89, spo2: 97, bloodPressure: { systolic: 125, diastolic: 80 }, timestamp: now };
  assert.deepEqual(vitalLogPayload(vitals, "manual", null, now), {
    source: "manual",
    spo2: 97,
    systolic: 125,
    diastolic: 80,
  });
});

test("a resting confirmation cannot be reused for a new manual reading", () => {
  const vitals = { heartRate: 80, timestamp: now };
  const oldSample = { heartRate: 70, timestamp: now - 1000, source: "manual" };
  assert.equal(vitalLogPayload(vitals, "manual", oldSample, now), null);
  assert.equal(vitalLogPayload(vitals, "manual", { heartRate: 0, timestamp: now, source: "manual" }, now), null);
});

test("stale and disconnected measurements are excluded from the health log and SOS", () => {
  const vitals = { heartRate: 68, timestamp: now - 300001 };
  assert.equal(hasRecentVitals(vitals, "manual", now), false);
  assert.equal(vitalLogPayload(vitals, "manual", null, now), null);
  assert.equal(sosVitalPayload(vitals, "manual", now), null);
  assert.equal(sosVitalPayload({ heartRate: 68, timestamp: now }, "none", now), null);
  assert.equal(sosVitalPayload({ heartRate: 68, timestamp: now - 120001 }, "bluetooth", now), null);
});

test("simulated readings remain available for demo alerts but cannot be logged", () => {
  const vitals = { heartRate: 170, timestamp: now };
  assert.equal(vitalLogPayload(vitals, "simulator", null, now), null);
  assert.deepEqual(sosVitalPayload(vitals, "simulator", now), { heartRate: 170 });
});
