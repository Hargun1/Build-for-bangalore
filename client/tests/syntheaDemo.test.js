import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../src/data/syntheaDemo.json", import.meta.url), "utf8"));
const day = /^\d{4}-\d{2}-\d{2}$/;

test("Synthea demo has linked, dated clinical records for 50 fictional adults", () => {
  assert.equal(data.profiles.length, 50);
  assert.equal(new Set(data.profiles.map((profile) => profile.id)).size, 50);
  for (const profile of data.profiles) {
    assert.match(profile.id, /^Sample \d{2}$/);
    assert.ok(profile.ageAtLastVisit >= 18 && profile.ageAtLastVisit <= 85);
    assert.match(profile.lastVisitDay, day);
    assert.ok(profile.vitals.bloodPressure.length > 0);
    assert.ok(profile.labs.length >= 2);
    assert.ok(profile.visits.length > 0);
    for (const bp of profile.vitals.bloodPressure) {
      assert.match(bp.day, day);
      assert.ok(bp.systolic > bp.diastolic);
    }
    for (const lab of profile.labs) {
      assert.match(lab.day, day);
      assert.ok(Number.isFinite(lab.value));
      assert.ok(lab.unit);
    }
    for (const visit of profile.visits) assert.match(visit.day, day);
  }
});

test("demo export omits source patient identifiers and identity fields", () => {
  const serialized = JSON.stringify(data);
  assert.doesNotMatch(serialized, /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
  assert.doesNotMatch(serialized, /"(?:FIRST|LAST|SSN|ADDRESS|ZIP|EMAIL)"/i);
  assert.equal(data.profiles[0].vitals.bloodPressure[0].systolic, 128);
  assert.equal(data.profiles[0].vitals.bloodPressure[0].diastolic, 74);
});
