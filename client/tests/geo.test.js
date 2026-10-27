import { test } from "node:test";
import assert from "node:assert/strict";
import { mapsSearchUrl } from "../src/utils/geo.js";

test("map fallback searches near the user's coordinates", () => {
  const url = new URL(mapsSearchUrl("hospitals", { lat: 12.9716, lon: 77.5946 }));
  assert.equal(url.hostname, "www.google.com");
  assert.equal(url.searchParams.get("api"), "1");
  assert.equal(url.searchParams.get("query"), "hospitals near 12.97160,77.59460");
});

test("map fallback uses Bengaluru when the location is unavailable", () => {
  const url = new URL(mapsSearchUrl("clinics", { lat: NaN, lon: null }));
  assert.equal(url.searchParams.get("query"), "clinics near Bengaluru");
});
