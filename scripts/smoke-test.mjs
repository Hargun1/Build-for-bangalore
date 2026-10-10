// End-to-end smoke test against a running backend + AI service, using live free APIs.
// Usage: node scripts/smoke-test.mjs [http://localhost:5001/api]
const BASE = process.argv[2] || "http://localhost:5001/api";
let token = "";
const results = [];

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

async function step(name, fn) {
  const t = Date.now();
  try {
    const summary = await fn();
    results.push(["PASS", name, `${Date.now() - t}ms`, summary]);
  } catch (e) {
    results.push(["FAIL", name, `${Date.now() - t}ms`, e.message]);
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const yesterday = new Date(Date.now() + 5.5 * 3600e3 - 86400e3).toISOString().slice(0, 10);

await step("guest login", async () => {
  const r = await call("POST", "/auth/guest");
  expect(r.status === 201, `status ${r.status}`);
  token = r.data.token;
  return `user ${r.data.user.id.slice(-6)} isGuest=${r.data.user.isGuest}`;
});
await step("account + profile", async () => {
  await call("PUT", "/users/me", { name: "Demo User", gender: "male", dob: "1975-06-15" });
  const r = await call("PUT", "/users/me/profile", { heightCm: 172, weightKg: 82, waistCm: 96, activityLevel: "mild", familyHistoryDiabetes: "one_parent", smoker: false, onBpMedication: false, hasDiabetes: false, conditions: ["asthma"] });
  expect(r.status === 200, JSON.stringify(r.data));
  return `age ${r.data.age}, BMI inputs saved`;
});
await step("log 2 days of metrics", async () => {
  const a = await call("PUT", "/health/metrics", { day: yesterday, steps: 4200, sleepHours: 6, systolic: 138, diastolic: 88, restingHeartRate: 76, stressLevel: 6 });
  const b = await call("PUT", "/health/metrics", { steps: 5100, sleepHours: 6.5, systolic: 142, diastolic: 90, waterLitres: 1.5 });
  expect(a.status === 200 && b.status === 200, `${a.status}/${b.status} ${JSON.stringify(a.data)}`);
  const t = await call("GET", "/health/today");
  return `today steps ${t.data.metrics.steps}, 7d avg steps ${t.data.averages.steps}`;
});
await step("risk analysis (deterministic engine)", async () => {
  const r = await call("POST", "/health/analyze");
  expect(r.status === 200, JSON.stringify(r.data));
  const s = Object.fromEntries(r.data.scores.map((x) => [x.key, `${x.value ?? "-"}${x.unit === "%" ? "%" : ""}(${x.level})`]));
  return `diabetes ${s.diabetes}, heart ${s.heart}, BMI ${s.weight}, BP ${s.bloodPressure}, sleep ${s.sleep}, activity ${s.activity}; wellness ${r.data.wellnessScore}; text by ${r.data.aiSource}`;
});
await step("environment (live Open-Meteo, NAQI)", async () => {
  const r = await call("GET", "/exposome?lat=12.9716&lon=77.5946");
  expect(r.status === 200, JSON.stringify(r.data));
  return `${r.data.location.area}, ${r.data.location.city}: AQI ${r.data.airQuality?.aqi} ${r.data.airQuality?.name} (${r.data.airQuality?.dominant}), ${r.data.current.temp}°C, best window ${r.data.bestWindow?.start?.slice(11, 16)}, alerts ${r.data.alerts.length}, AI tips ${r.data.aiAdvice?.aiSource}`;
});
await step("nearby hospitals (live OpenStreetMap)", async () => {
  const r = await call("GET", "/places/nearby?lat=12.9716&lon=77.5946&kinds=hospital&radiusKm=3");
  expect(r.status === 200, JSON.stringify(r.data));
  return `${r.data.places.length} found; nearest: ${r.data.places[0]?.name} (${r.data.places[0]?.distanceKm} km)`;
});
await step("specialty clinics (dermatology)", async () => {
  const r = await call("GET", "/places/nearby?lat=12.9716&lon=77.5946&kinds=hospital,clinic&radiusKm=5&specialty=dermatology");
  expect(r.status === 200, JSON.stringify(r.data));
  return `${r.data.places.length} places, ${r.data.places.filter((p) => p.matchesSpecialty).length} tagged dermatology`;
});
await step("barcode lookup (live Open Food Facts)", async () => {
  const r = await call("GET", "/nutrition/product/8901058851298");
  expect(r.status === 200, JSON.stringify(r.data));
  return `${r.data.product.brand} ${r.data.product.name}: Nutri-Score ${r.data.product.nutriScore}, NOVA ${r.data.product.novaGroup}, allergens ${r.data.product.allergens.join("/")}; review ${r.data.review?.verdict} by ${r.data.review?.aiSource}`;
});
await step("unknown barcode gives a clear 404", async () => {
  const r = await call("GET", "/nutrition/product/0000000000017");
  expect(r.status === 404, `status ${r.status}`);
  return r.data.message;
});
await step("goal plan + save + progress", async () => {
  const p = await call("POST", "/goals/plan", { description: "walk 8000 steps every day", weeks: 4 });
  expect(p.status === 200, JSON.stringify(p.data));
  const plan = p.data.plan;
  const g = await call("POST", "/goals", { ...plan, planSource: p.data.planSource });
  expect(g.status === 201, JSON.stringify(g.data));
  await call("PUT", "/health/metrics", { steps: 9000 });
  const list = await call("GET", "/goals");
  const pr = list.data[0].progress;
  return `plan by ${p.data.planSource}: "${plan.title}" ${plan.metric}>=${plan.dailyTarget}; progress ${pr.percent}% (${pr.daysMet}/${pr.totalDays} days)`;
});
await step("symptom triage", async () => {
  const r = await call("POST", "/appointments/triage", { symptoms: "itchy red rash on my elbows for 3 weeks" });
  expect(r.status === 200, JSON.stringify(r.data));
  return `${r.data.specialty}, ${r.data.urgency} (by ${r.data.aiSource})`;
});
await step("triage catches emergencies without AI", async () => {
  const r = await call("POST", "/appointments/triage", { symptoms: "crushing chest pain spreading to my left arm" });
  expect(r.data.urgency === "emergency", JSON.stringify(r.data));
  return `${r.data.urgency} via ${r.data.aiSource}`;
});
await step("appointment + .ics", async () => {
  const when = new Date(Date.now() + 3 * 86400e3).toISOString();
  const r = await call("POST", "/appointments", { place: { name: "Test Skin Clinic", address: "Jayanagar" }, specialty: "Dermatologist", startsAt: when });
  expect(r.status === 201, JSON.stringify(r.data));
  const ics = await fetch(`${BASE}/appointments/${r.data._id}/ics`, { headers: { Authorization: `Bearer ${token}` } }).then((x) => x.text());
  expect(ics.includes("BEGIN:VEVENT"), "no VEVENT");
  return `saved; ics ${ics.length} bytes`;
});
await step("SOS with contacts", async () => {
  await call("PUT", "/users/me/emergency-contacts", { contacts: [{ name: "Sister", phone: "9845012345", email: "" }] });
  const r = await call("POST", "/emergency/sos", { lat: 12.9716, lon: 77.5946, detection: "test", vitalsSource: "simulator", vitals: { heartRate: 170 } });
  expect(r.status === 201, JSON.stringify(r.data));
  return `${r.data.hospitals.length} hospitals in alert; WhatsApp link ${r.data.shareLinks[0]?.whatsapp.slice(0, 40)}…`;
});
await step("chat emergency path (no AI needed)", async () => {
  const r = await call("POST", "/chat", { messages: [{ role: "user", content: "I can't breathe and my lips are blue" }] });
  expect(r.status === 200 && r.data.redFlag?.level === "emergency", JSON.stringify(r.data));
  return `${r.data.redFlag.title}`;
});
await step("chat normal question", async () => {
  const r = await call("POST", "/chat", { messages: [{ role: "user", content: "How much water should I drink in Bengaluru summer?" }] });
  return `status ${r.status}: ${r.data.reply ? `${r.data.aiSource}: ${r.data.reply.slice(0, 80)}…` : r.data.message}`;
});
await step("system status", async () => {
  const r = await call("GET", "/system/status");
  return `db ${r.data.database}, ai reachable ${r.data.ai.reachable}, aiReady ${r.data.ai.aiReady}, email ${r.data.email}`;
});

for (const [ok, name, ms, info] of results) console.log(`${ok}  ${name.padEnd(42)} ${ms.padStart(7)}  ${info}`);
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
