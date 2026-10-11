jest.mock("web-push", () => ({
  generateVAPIDKeys: () => ({ publicKey: "BPublicKeyForTests", privateKey: "privateKeyForTests" }),
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(async () => ({ statusCode: 201 })),
}));

const request = require("supertest");
const webpush = require("web-push");
const app = require("../app");
const db = require("./db");
const Reminder = require("../models/Reminder");
const PushSubscription = require("../models/PushSubscription");
const { tick } = require("../jobs/reminders");

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

const SUB = { endpoint: "https://fcm.googleapis.com/fcm/send/abc123", keys: { p256dh: "B".repeat(40), auth: "a".repeat(16) } };
// Saturday 10 Oct 2026, 08:05 in India = 02:35 UTC.
const SAT_0805_IST = new Date("2026-10-10T02:35:00Z");

describe("reminder API", () => {
  test("creates, normalises, lists, updates and deletes reminders", async () => {
    const { agent } = await signIn();
    const created = (await agent("post", "/api/reminders").send({ kind: "medicine", title: "Metformin 500 mg", times: ["20:00", "08:00", "08:00"], days: [0, 1, 2, 3, 4, 5, 6] }).expect(201)).body;
    expect(created.times).toEqual(["08:00", "20:00"]);
    expect(created.days).toEqual([]); // every day
    await agent("put", `/api/reminders/${created._id}`).send({ title: "Metformin", times: ["09:00"], enabled: false }).expect(200);
    const list = (await agent("get", "/api/reminders").expect(200)).body;
    expect(list[0]).toMatchObject({ title: "Metformin", times: ["09:00"], enabled: false });
    expect(list[0]).not.toHaveProperty("sentSlots");
    await agent("delete", `/api/reminders/${created._id}`).expect(200);
  });

  test("validates times and keeps reminders private", async () => {
    const { agent } = await signIn();
    await agent("post", "/api/reminders").send({ title: "x", times: ["25:00"] }).expect(400);
    await agent("post", "/api/reminders").send({ title: "x", times: [] }).expect(400);
    const r = (await agent("post", "/api/reminders").send({ title: "Water", times: ["10:00"] }).expect(201)).body;
    const other = await signIn();
    await other.agent("delete", `/api/reminders/${r._id}`).expect(404);
    await other.agent("put", `/api/reminders/${r._id}`).send({ title: "hack", times: ["10:00"] }).expect(404);
  });

  test("subscribes a device (HTTPS endpoints only) and sends a test", async () => {
    const { agent } = await signIn();
    const status = (await agent("get", "/api/reminders/push/status").expect(200)).body;
    expect(status).toMatchObject({ configured: true, publicKey: expect.any(String), devices: 0 });
    await agent("post", "/api/reminders/push/test").expect(400);
    await agent("post", "/api/reminders/push/subscribe").send({ ...SUB, endpoint: "http://evil.test/x" }).expect(400);
    await agent("post", "/api/reminders/push/subscribe").send(SUB).expect(201);
    await agent("post", "/api/reminders/push/subscribe").send(SUB).expect(201); // idempotent
    expect(await PushSubscription.countDocuments()).toBe(1);
    const sent = (await agent("post", "/api/reminders/push/test").expect(200)).body;
    expect(sent).toMatchObject({ delivered: 1, devices: 1 });
    await agent("post", "/api/reminders/push/unsubscribe").send({ endpoint: SUB.endpoint }).expect(200);
    expect(await PushSubscription.countDocuments()).toBe(0);
  });
});

describe("reminder scheduler", () => {
  async function setup(reminder) {
    const { agent, userId } = await signIn();
    await agent("post", "/api/reminders/push/subscribe").send(SUB).expect(201);
    await agent("post", "/api/reminders").send(reminder).expect(201);
    return userId;
  }

  test("sends a due reminder once, even if ticks repeat", async () => {
    await setup({ kind: "medicine", title: "Metformin", times: ["08:00", "20:00"] });
    expect(await tick(SAT_0805_IST)).toBe(1);
    expect(await tick(SAT_0805_IST)).toBe(0);
    expect(await tick(new Date(SAT_0805_IST.getTime() + 60000))).toBe(0);
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(webpush.sendNotification.mock.calls[0][1]);
    expect(payload).toMatchObject({ title: "💊 Metformin", body: "Time to take your medicine.", url: "/reminders" });
    const r = await Reminder.findOne().lean();
    expect(r.sentSlots).toEqual(["2026-10-10T08:00"]);
    expect(r.lastResult).toMatchObject({ delivered: 1, failed: 0 });
  });

  test("catches up within 30 minutes after a sleep, but not later", async () => {
    await setup({ title: "Walk", times: ["07:40"] });
    expect(await tick(new Date("2026-10-10T02:45:00Z"))).toBe(0); // 08:15 IST: 35 min late
    await Reminder.updateOne({}, { times: ["07:50"] });
    expect(await tick(new Date("2026-10-10T02:45:00Z"))).toBe(1); // 25 min late
  });

  test("respects days of the week and the enabled switch", async () => {
    await setup({ title: "Weekday pill", times: ["08:00"], days: [1, 2, 3, 4, 5] });
    expect(await tick(SAT_0805_IST)).toBe(0); // Saturday
    expect(await tick(new Date("2026-10-12T02:35:00Z"))).toBe(1); // Monday
    await Reminder.updateOne({}, { enabled: false });
    expect(await tick(new Date("2026-10-13T02:35:00Z"))).toBe(0);
  });

  test("removes devices the push service says are gone", async () => {
    await setup({ title: "Water", kind: "water", times: ["08:00"] });
    webpush.sendNotification.mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }));
    expect(await tick(SAT_0805_IST)).toBe(1);
    expect(await PushSubscription.countDocuments()).toBe(0);
    expect((await Reminder.findOne().lean()).lastResult).toMatchObject({ delivered: 0, failed: 1 });
  });

  test("deleting the account removes reminders and devices", async () => {
    const { agent } = await signIn();
    await agent("post", "/api/reminders/push/subscribe").send(SUB).expect(201);
    await agent("post", "/api/reminders").send({ title: "x", times: ["08:00"] }).expect(201);
    await agent("delete", "/api/users/me").expect(200);
    expect(await Reminder.countDocuments()).toBe(0);
    expect(await PushSubscription.countDocuments()).toBe(0);
  });
});
