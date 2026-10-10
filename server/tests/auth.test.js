jest.mock("../services/emailService", () => ({
  sendVerificationOtp: jest.fn(async () => ({ ok: true })),
  sendSosAlert: jest.fn(async () => ({ ok: true })),
  sendAppointmentConfirmation: jest.fn(async () => ({ ok: true })),
}));
jest.mock("axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
  create: jest.fn(() => ({ get: jest.fn(), post: jest.fn(), interceptors: { request: { use: jest.fn() } } })),
}));

const request = require("supertest");
const axios = require("axios");
const app = require("../app");
const db = require("./db");
const User = require("../models/User");
const { sendVerificationOtp } = require("../services/emailService");

beforeAll(db.connect);
afterEach(async () => {
  await db.clear();
  jest.clearAllMocks();
});
afterAll(db.close);

const newUser = { name: "Asha Rao", email: "Asha@Example.com", password: "walk2024daily", gender: "female", dob: "1990-05-01" };

async function registerAndGetOtp(body = newUser) {
  await request(app).post("/api/auth/register").send(body).expect(201);
  return sendVerificationOtp.mock.calls.at(-1)[1];
}

describe("email + password sign-up", () => {
  test("register, verify with OTP, then log in", async () => {
    const otp = await registerAndGetOtp();
    expect(otp).toMatch(/^\d{6}$/);

    const stored = await User.findOne({ email: "asha@example.com" }).select("+emailOtpHash");
    expect(stored.emailOtpHash).not.toBe(otp); // only a hash is stored

    const verified = await request(app).post("/api/auth/verify-email").send({ email: "asha@example.com", otp }).expect(200);
    expect(verified.body.token).toBeTruthy();
    expect(verified.body.user).not.toHaveProperty("password");

    const login = await request(app).post("/api/auth/login").send({ email: "ASHA@example.com", password: newUser.password }).expect(200);
    expect(login.body.user.email).toBe("asha@example.com");
  });

  test("weak passwords are rejected", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...newUser, password: "short" }).expect(400);
    expect(res.body.message).toMatch(/at least 8/);
  });

  test("unverified accounts cannot log in", async () => {
    await registerAndGetOtp();
    const res = await request(app).post("/api/auth/login").send({ email: newUser.email, password: newUser.password }).expect(403);
    expect(res.body.requiresEmailVerification).toBe(true);
  });

  test("OTP locks after 5 wrong attempts, even if the 6th is correct", async () => {
    const otp = await registerAndGetOtp();
    const wrong = otp === "111111" ? "222222" : "111111";
    for (let i = 0; i < 5; i += 1) {
      await request(app).post("/api/auth/verify-email").send({ email: newUser.email, otp: wrong }).expect(400);
    }
    await request(app).post("/api/auth/verify-email").send({ email: newUser.email, otp }).expect(429);
  });

  test("resend gives the same answer for unknown emails (no account probing)", async () => {
    const a = await request(app).post("/api/auth/resend-verification").send({ email: "nobody@example.com" }).expect(200);
    await registerAndGetOtp();
    const b = await request(app).post("/api/auth/resend-verification").send({ email: newUser.email }).expect(200);
    expect(a.body.message).toBe(b.body.message);
  });

  test("password login on a Google-only account fails cleanly instead of crashing", async () => {
    await User.create({ name: "G", email: "g@example.com", googleId: "123", emailVerified: true });
    const res = await request(app).post("/api/auth/login").send({ email: "g@example.com", password: "anything1" }).expect(401);
    expect(res.body.message).toMatch(/Google/);
  });
});

describe("Google sign-in", () => {
  const victim = { name: "Victim", email: "victim@example.com", password: "x", emailVerified: true };

  test("the old userProfile shortcut no longer logs anyone in", async () => {
    await User.create(victim);
    const res = await request(app).post("/api/auth/google").send({ userProfile: { email: victim.email } }).expect(400);
    expect(res.body.token).toBeUndefined();
    expect(axios.get).not.toHaveBeenCalled();
  });

  test("a token issued to a different Google app is rejected", async () => {
    axios.get.mockResolvedValueOnce({ data: { aud: "someone-elses-app", sub: "1", email: victim.email, email_verified: "true" } });
    await request(app).post("/api/auth/google").send({ credential: "ya29.a-real-looking-access-token" }).expect(401);
  });

  test("an unverified Google email is rejected", async () => {
    axios.get.mockResolvedValueOnce({ data: { aud: process.env.GOOGLE_CLIENT_ID, sub: "1", email: "x@example.com", email_verified: "false" } });
    await request(app).post("/api/auth/google").send({ credential: "ya29.a-real-looking-access-token" }).expect(401);
  });

  test("a valid token signs in and links to the existing account", async () => {
    await User.create(victim);
    axios.get
      .mockResolvedValueOnce({ data: { aud: process.env.GOOGLE_CLIENT_ID, sub: "g-42", email: victim.email, email_verified: "true" } })
      .mockResolvedValueOnce({ data: { name: "Victim", picture: "https://example.com/p.png" } });
    const res = await request(app).post("/api/auth/google").send({ credential: "ya29.a-real-looking-access-token" }).expect(200);
    expect(res.body.user.email).toBe(victim.email);
    expect((await User.findOne({ email: victim.email })).googleId).toBe("g-42");
  });
});

describe("guest access and tokens", () => {
  test("guest login creates an isolated account that expires", async () => {
    const res = await request(app).post("/api/auth/guest").expect(201);
    expect(res.body.user.isGuest).toBe(true);
    const guest = await User.findById(res.body.user.id);
    expect(guest.guestExpiresAt.getTime()).toBeGreaterThan(Date.now());
    await request(app).get("/api/users/me").set("Authorization", `Bearer ${res.body.token}`).expect(200);
  });

  test("protected routes need a valid token", async () => {
    await request(app).get("/api/users/me").expect(401);
    await request(app).get("/api/users/me").set("Authorization", "Bearer not-a-token").expect(401);
  });
});
