jest.mock("../config/env", () => ({
  brevoApiKey: "test-api-key",
  brevoSenderEmail: "verified@example.com",
  emailProvider: "brevo",
  emailConfigured: true,
  isProduction: true,
  isTest: true,
}));

const env = require("../config/env");
const { sendVerificationOtp, sendPasswordResetOtp, sendAppointmentConfirmation } = require("../services/emailService");

beforeEach(() => {
  global.fetch = jest.fn(async () => ({ ok: true, status: 201 }));
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
  env.emailProvider = "brevo";
  env.emailConfigured = true;
});

test("verification codes use Brevo HTTPS and the verified sender", async () => {
  expect(await sendVerificationOtp("member@example.com", "123456")).toEqual({ ok: true });
  const [url, request] = global.fetch.mock.calls[0];
  const body = JSON.parse(request.body);
  expect(url).toBe("https://api.brevo.com/v3/smtp/email");
  expect(request.method).toBe("POST");
  expect(request.headers["api-key"]).toBe("test-api-key");
  expect(body.sender.email).toBe("verified@example.com");
  expect(body.to).toEqual([{ email: "member@example.com" }]);
  expect(body.subject).toMatch(/verification code/);
  expect(body.htmlContent).toContain("123456");
});

test("provider rejection and network failures never report success", async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, status: 401 });
  expect((await sendPasswordResetOtp("member@example.com", "654321")).ok).toBe(false);
  global.fetch.mockRejectedValueOnce(new Error("provider unavailable"));
  expect((await sendPasswordResetOtp("member@example.com", "654321")).ok).toBe(false);
  expect(console.error).toHaveBeenCalledTimes(2);
});

test("appointment calendar file is base64-encoded for the API", async () => {
  await sendAppointmentConfirmation({
    to: "member@example.com",
    userName: "Asha",
    appointment: { startsAt: new Date("2026-10-27T04:30:00Z"), place: { name: "Clinic" } },
    icsContent: "BEGIN:VCALENDAR\nEND:VCALENDAR",
  });
  const body = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(body.attachment).toEqual([{
    name: "appointment.ics",
    content: Buffer.from("BEGIN:VCALENDAR\nEND:VCALENDAR").toString("base64"),
  }]);
});

test("missing provider never pretends to send an email", async () => {
  env.emailConfigured = false;
  env.emailProvider = null;
  expect(await sendVerificationOtp("member@example.com", "123456")).toMatchObject({ ok: false, skipped: true });
  expect(global.fetch).not.toHaveBeenCalled();
});
