jest.mock("../services/emailService", () => ({
  sendVerificationOtp: jest.fn(async () => ({ ok: true })),
  sendSosAlert: jest.fn(async () => ({ ok: true })),
  sendAppointmentConfirmation: jest.fn(async () => ({ ok: true })),
}));
jest.mock("../services/aiService", () => ({
  riskAssess: jest.fn(),
  chat: jest.fn(),
  chatStream: jest.fn(),
  goalPlan: jest.fn(),
  triage: jest.fn(),
  analyzeMeal: jest.fn(),
  readLabReport: jest.fn(),
  evaluateLabs: jest.fn(),
  health: jest.fn(async () => ({ aiReady: false, providers: [] })),
}));
jest.mock("../services/places", () => ({ nearby: jest.fn(async () => [{ name: "City Hospital", distanceKm: 1.2, phone: "+91 80 1234 5678" }]) }));

const request = require("supertest");
const app = require("../app");
const db = require("./db");
const ai = require("../services/aiService");
const { sendSosAlert } = require("../services/emailService");
const User = require("../models/User");
const HealthMetrics = require("../models/HealthMetrics");
const { dayKey, daysAgoKey } = require("../services/userContext");

beforeAll(db.connect);
afterEach(async () => {
  await db.clear();
  jest.clearAllMocks();
});
afterAll(db.close);

async function signIn() {
  const res = await request(app).post("/api/auth/guest").expect(201);
  const agent = (method, url) => request(app)[method](url).set("Authorization", `Bearer ${res.body.token}`);
  return { agent, userId: res.body.user.id };
}

describe("profile and account safety", () => {
  test("users cannot set protected fields like emailVerified or isGuest", async () => {
    const { agent, userId } = await signIn();
    await agent("put", "/api/users/me").send({ name: "Ravi", isGuest: false, emailVerified: false, email: "x@y.com" }).expect(200);
    const u = await User.findById(userId);
    expect(u.name).toBe("Ravi");
    expect(u.isGuest).toBe(true);
    expect(u.email).toMatch(/guest-/);
  });

  test("profile fields are validated and can be cleared with null", async () => {
    const { agent } = await signIn();
    await agent("put", "/api/users/me/profile").send({ heightCm: 900 }).expect(400);
    await agent("put", "/api/users/me/profile").send({ heightCm: 172, waistCm: 88, smoker: false }).expect(200);
    const res = await agent("put", "/api/users/me/profile").send({ waistCm: null }).expect(200);
    expect(res.body.profile).toEqual(expect.objectContaining({ heightCm: 172, smoker: false }));
    expect(res.body.profile.waistCm).toBeUndefined();
  });

  test("emergency contacts need a phone or email", async () => {
    const { agent } = await signIn();
    await agent("put", "/api/users/me/emergency-contacts").send({ contacts: [{ name: "Mum" }] }).expect(400);
    const ok = await agent("put", "/api/users/me/emergency-contacts").send({ contacts: [{ name: "Mum", phone: "98450 12345", email: "mum@example.com" }] }).expect(200);
    expect(ok.body.emergencyContacts).toHaveLength(1);
  });

  test("deleting the account removes its data", async () => {
    const { agent, userId } = await signIn();
    await agent("put", "/api/health/metrics").send({ steps: 5000 }).expect(200);
    await agent("delete", "/api/users/me").expect(200);
    expect(await User.countDocuments({ _id: userId })).toBe(0);
    expect(await HealthMetrics.countDocuments({ userId })).toBe(0);
  });
});

describe("daily metrics", () => {
  test("one entry per day: logging again updates it", async () => {
    const { agent, userId } = await signIn();
    await agent("put", "/api/health/metrics").send({ steps: 4000 }).expect(200);
    await agent("put", "/api/health/metrics").send({ steps: 6500, sleepHours: 7 }).expect(200);
    const rows = await HealthMetrics.find({ userId });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(expect.objectContaining({ steps: 6500, sleepHours: 7, day: dayKey() }));
  });

  test("a request cannot write to another user's id", async () => {
    const { agent, userId } = await signIn();
    const other = await signIn();
    await agent("put", "/api/health/metrics").send({ steps: 100, userId: other.userId }).expect(200);
    expect(await HealthMetrics.countDocuments({ userId: other.userId })).toBe(0);
    expect(await HealthMetrics.countDocuments({ userId })).toBe(1);
  });

  test("impossible values and future days are rejected", async () => {
    const { agent } = await signIn();
    await agent("put", "/api/health/metrics").send({ systolic: 80, diastolic: 120 }).expect(400);
    await agent("put", "/api/health/metrics").send({ day: "2999-01-01", steps: 1 }).expect(400);
  });

  test("analyze sends 14-day averages to the risk engine and saves the result", async () => {
    const { agent, userId } = await signIn();
    await agent("put", "/api/users/me/profile").send({ heightCm: 170, weightKg: 80 });
    await HealthMetrics.create([
      { userId, day: daysAgoKey(1), steps: 3000, systolic: 130, diastolic: 85 },
      { userId, day: dayKey(), steps: 5000, systolic: 140, diastolic: 90 },
    ]);
    ai.riskAssess.mockResolvedValue({ scores: [{ key: "weight", level: "high" }], wellnessScore: 40, summary: "s", recommendations: [], aiSource: "rules" });
    const res = await agent("post", "/api/health/analyze").expect(200);
    const sent = ai.riskAssess.mock.calls[0][0];
    expect(sent.inputs).toEqual(expect.objectContaining({ avgSteps: 4000, systolic: 135, heightCm: 170, weightKg: 80, daysLogged: 2 }));
    expect(sent.context).not.toHaveProperty("email");
    expect(res.body.wellnessScore).toBe(40);
  });
});

describe("goals", () => {
  test("progress comes from logged data, not from button presses", async () => {
    const { agent, userId } = await signIn();
    const created = await agent("post", "/api/goals")
      .send({ title: "Walk 8k", metric: "steps", direction: "atLeast", dailyTarget: 8000, weeks: 1, habits: [{ title: "Evening walk" }] })
      .expect(201);
    expect(created.body.progress.percent).toBe(0);

    await HealthMetrics.create({ userId, day: dayKey(), steps: 9000 });
    const list = await agent("get", "/api/goals").expect(200);
    expect(list.body[0].progress).toEqual(expect.objectContaining({ daysMet: 1, totalDays: 7, percent: 14 }));

    const habitId = created.body.habits[0].id;
    const checked = await agent("put", `/api/goals/${created.body._id}/checkin`).send({ habitsDone: [habitId, "made-up-id"] }).expect(200);
    expect(checked.body.progress.todayHabits).toEqual([habitId]);
    expect(checked.body.progress.streak).toBe(1);
  });

  test("a metric goal needs a target", async () => {
    const { agent } = await signIn();
    await agent("post", "/api/goals").send({ title: "Sleep", metric: "sleepHours", weeks: 2 }).expect(400);
  });
});

describe("SOS", () => {
  test("emails contacts, prepares WhatsApp links and logs the event", async () => {
    const { agent } = await signIn();
    await agent("put", "/api/users/me/emergency-contacts").send({ contacts: [{ name: "Mum", phone: "9845012345", email: "mum@example.com" }] });
    const res = await agent("post", "/api/emergency/sos")
      .send({ lat: 12.97, lon: 77.59, detection: "Low SpO2", vitals: { spo2: 84 }, vitalsSource: "simulator" })
      .expect(201);
    expect(sendSosAlert).toHaveBeenCalledWith(expect.objectContaining({ to: "mum@example.com", vitalsText: expect.stringContaining("SIMULATED") }));
    expect(res.body.shareLinks[0].whatsapp).toMatch(/^https:\/\/wa\.me\/919845012345\?text=/);
    expect(res.body.hospitals[0].name).toBe("City Hospital");
  });
});

describe("appointments", () => {
  test("rejects past times and double bookings", async () => {
    const { agent } = await signIn();
    const place = { name: "Jayanagar Clinic", address: "4th Block" };
    await agent("post", "/api/appointments").send({ place, startsAt: "2020-01-01T10:00:00Z" }).expect(400);
    const when = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
    await agent("post", "/api/appointments").send({ place, startsAt: when }).expect(201);
    await agent("post", "/api/appointments").send({ place, startsAt: when }).expect(409);
    const list = await agent("get", "/api/appointments").expect(200);
    expect(list.body.upcoming).toHaveLength(1);
    const ics = await agent("get", `/api/appointments/${list.body.upcoming[0]._id}/ics`).expect(200);
    expect(ics.text).toContain("BEGIN:VCALENDAR");
    expect(ics.text).toContain("TRIGGER:-P1D");
  });
});

describe("streaming chat", () => {
  const { Readable } = require("stream");

  test("relays the AI service's events to the browser as they arrive", async () => {
    const { agent } = await signIn();
    ai.chatStream.mockResolvedValue(
      Readable.from(['event: delta\ndata: {"text":"Drink "}\n\n', 'event: delta\ndata: {"text":"ORS."}\n\n', 'event: done\ndata: {"reply":"Drink ORS.","sources":[]}\n\n'])
    );
    const res = await agent("post", "/api/chat/stream").send({ messages: [{ role: "user", content: "loose motions" }] }).expect(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
    expect(res.text).toContain('"text":"Drink "');
    expect(res.text).toContain("event: done");
    const payload = ai.chatStream.mock.calls[0][0];
    expect(payload.messages).toHaveLength(1);
    expect(payload.context).not.toHaveProperty("email");
  });

  test("turns an AI-service failure into an error event", async () => {
    const { agent } = await signIn();
    ai.chatStream.mockRejectedValue(new Error("The AI service is unreachable right now."));
    const res = await agent("post", "/api/chat/stream").send({ messages: [{ role: "user", content: "hi" }] }).expect(200);
    expect(res.text).toContain(": connected\n\n");
    expect(res.text).toMatch(/event: error\ndata: .*unreachable/);
  });

  test("keeps an idle stream alive without exposing answer text and clears the timer", async () => {
    const { agent } = await signIn();
    const intervals = jest.spyOn(global, "setInterval");
    const clear = jest.spyOn(global, "clearInterval");
    let timer;
    try {
      ai.chatStream.mockImplementationOnce(() => new Promise((resolve) => {
        const index = intervals.mock.calls.findIndex((call) => call[1] === 10000);
        timer = intervals.mock.results[index].value;
        intervals.mock.calls[index][0]();
        resolve(Readable.from(['event: done\ndata: {"reply":"Checked answer","aiSource":"test"}\n\n']));
      }));
      const res = await agent("post", "/api/chat/stream")
        .send({ messages: [{ role: "user", content: "sleep routine" }] }).expect(200);
      expect(res.text).toMatch(/^: connected\n\n: keep-alive\n\nevent: done/);
      expect(res.text).not.toContain("event: delta");
      expect(clear).toHaveBeenCalledWith(timer);
    } finally {
      intervals.mockRestore();
      clear.mockRestore();
    }
  });

  test("still validates and requires login", async () => {
    const request = require("supertest");
    await request(app).post("/api/chat/stream").send({ messages: [{ role: "user", content: "hi" }] }).expect(401);
    const { agent } = await signIn();
    await agent("post", "/api/chat/stream").send({ messages: [{ role: "assistant", content: "hi" }] }).expect(400);
  });
});

describe("lab reports", () => {
  const IMG = "data:image/jpeg;base64," + "A".repeat(200);
  const checked = {
    tests: [{ name: "HbA1c", key: "hba1c", display: "HbA1c", valueText: "6.8", value: 6.8, unit: "%", status: "high", standardValue: 6.8, organs: ["eyes"] }],
    counts: { normal: 0, high: 1, low: 0, check: 0, unknown: 0 },
    summary: "1 of 1 checked results are outside the range: HbA1c.",
  };

  test("reading passes the pages and the user's sex, and saves nothing", async () => {
    const { agent } = await signIn();
    ai.readLabReport.mockResolvedValue({ isLabReport: true, ...checked });
    await agent("put", "/api/users/me").send({ gender: "female" });
    const res = await agent("post", "/api/labs/read").send({ images: [IMG] }).expect(200);
    expect(res.body.tests[0].status).toBe("high");
    expect(ai.readLabReport.mock.calls[0][0].images).toHaveLength(1);
    expect((await agent("get", "/api/labs").expect(200)).body).toHaveLength(0);
  });

  test("saving re-checks the rows on the AI service; statuses never come from the browser", async () => {
    const { agent } = await signIn();
    ai.evaluateLabs.mockResolvedValue(checked);
    const sent = { reportDate: "2026-09-30", labName: "City Lab", tests: [{ name: "HbA1c", key: "hba1c", value: "6.8", unit: "%", refRange: "4-5.6", status: "normal" }] };
    const saved = (await agent("post", "/api/labs").send(sent).expect(201)).body;
    expect(saved.tests[0].status).toBe("high");
    expect(ai.evaluateLabs.mock.calls[0][0].tests[0]).not.toHaveProperty("status");
    const list = (await agent("get", "/api/labs").expect(200)).body;
    expect(list).toHaveLength(1);
    await agent("delete", `/api/labs/${saved._id}`).expect(200);
    expect((await agent("get", "/api/labs").expect(200)).body).toHaveLength(0);
  });

  test("validates input and keeps reports private", async () => {
    const { agent } = await signIn();
    await agent("post", "/api/labs/read").send({ images: [] }).expect(400);
    await agent("post", "/api/labs").send({ reportDate: "2999-01-01", tests: [{ name: "Hb", value: "13" }] }).expect(400);
    ai.evaluateLabs.mockResolvedValue(checked);
    const saved = (await agent("post", "/api/labs").send({ reportDate: "2026-09-30", tests: [{ name: "HbA1c", value: "6.8" }] }).expect(201)).body;
    const other = await signIn();
    await other.agent("delete", `/api/labs/${saved._id}`).expect(404);
    expect((await other.agent("get", "/api/labs").expect(200)).body).toHaveLength(0);
  });
});
