const router = require("express").Router();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const User = require("../models/User");
const { signToken } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimit");
const { asyncHandler, HttpError } = require("../middleware/errors");
const { sendVerificationOtp } = require("../services/emailService");
const { verifyGoogleCredential } = require("../services/googleAuth");

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const GUEST_TTL_MS = 24 * 60 * 60 * 1000;
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser-not-a-password", 12);

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(120);
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/\d/, "Password must contain a number");

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email,
  password,
  gender: z.enum(["male", "female", "other"]).default("other"),
  dob: z.coerce.date().max(new Date(), "Date of birth must be in the past").optional(),
});
const loginSchema = z.object({ email, password: z.string().min(1, "Password is required").max(128) });
const verifySchema = z.object({ email, otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") });
const resendSchema = z.object({ email });
const googleSchema = z.object({ credential: z.string().min(20).max(4096) });

// 6-digit code from a cryptographically secure generator; only its hash is stored.
const newOtp = () => crypto.randomInt(100000, 1000000).toString();
const hashOtp = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

async function issueOtp(user) {
  const otp = newOtp();
  user.emailOtpHash = hashOtp(otp);
  user.emailOtpExpires = new Date(Date.now() + OTP_TTL_MS);
  user.emailOtpAttempts = 0;
  await user.save();
  return sendVerificationOtp(user.email, otp);
}

const session = (user) => ({ token: signToken(user), user: user.toPublic() });

router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email: mail, password: pw, gender, dob } = req.body;
    const existing = await User.findOne({ email: mail });
    if (existing && existing.emailVerified) {
      throw new HttpError(409, "An account with this email already exists. Please sign in.");
    }
    const hashed = await bcrypt.hash(pw, 12);
    // An unverified account with the same email is replaced (someone may have mistyped earlier).
    const user = existing || new User({ email: mail });
    Object.assign(user, { name, password: hashed, gender, dob, emailVerified: false });
    const sent = await issueOtp(user);
    res.status(201).json({
      message: sent.ok ?"Check your email for a 6-digit verification code." : "Account created, but we could not send the code. Use 'Resend code'.",
      requiresEmailVerification: true,
      email: mail,
    });
  })
);

router.post(
  "/verify-email",
  authLimiter,
  validate(verifySchema),
  asyncHandler(async (req, res) => {
    const { email: mail, otp } = req.body;
    const user = await User.findOne({ email: mail }).select("+emailOtpHash +emailOtpExpires +emailOtpAttempts");
    const invalid = new HttpError(400, "That code is invalid or has expired. Request a new one.");
    if (!user || !user.emailOtpHash || !user.emailOtpExpires || user.emailOtpExpires < new Date()) throw invalid;
    if (user.emailOtpAttempts >= OTP_MAX_ATTEMPTS) {
      throw new HttpError(429, "Too many wrong codes. Request a new code.");
    }
    const given = Buffer.from(hashOtp(otp));
    const stored = Buffer.from(user.emailOtpHash);
    if (given.length !== stored.length || !crypto.timingSafeEqual(given, stored)) {
      user.emailOtpAttempts += 1;
      await user.save();
      throw invalid;
    }
    user.emailVerified = true;
    user.emailOtpHash = null;
    user.emailOtpExpires = null;
    user.emailOtpAttempts = 0;
    await user.save();
    res.json({ message: "Email verified.", ...session(user) });
  })
);

router.post(
  "/resend-verification",
  authLimiter,
  validate(resendSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    // Same answer whether or not the account exists, so this cannot be used to probe emails.
    if (user && !user.emailVerified) await issueOtp(user);
    res.json({ message: "If that account is waiting for verification, a new code is on its way." });
  })
);

router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email, isGuest: false }).select("+password");
    // Google-only accounts have no password; compare against a dummy hash to keep timing constant.
    const hash = user?.password || DUMMY_HASH;
    const ok = await bcrypt.compare(req.body.password, hash);
    if (!user || !ok || !user.password) {
      throw new HttpError(401, user && !user.password ? "This account uses Google sign-in." : "Incorrect email or password.");
    }
    if (!user.emailVerified) {
      throw new HttpError(403, "Please verify your email first.", { requiresEmailVerification: true, email: user.email });
    }
    res.json(session(user));
  })
);

router.post(
  "/google",
  authLimiter,
  validate(googleSchema),
  asyncHandler(async (req, res) => {
    const g = await verifyGoogleCredential(req.body.credential);
    let user = await User.findOne({ $or: [{ googleId: g.googleId }, { email: g.email }] });
    if (!user) {
      user = new User({ name: g.name, email: g.email, gender: "other" });
    }
    // Linking is safe: Google has verified ownership of this email address.
    user.googleId = g.googleId;
    user.emailVerified = true;
    if (g.picture && !user.avatar) user.avatar = g.picture;
    await user.save();
    res.json(session(user));
  })
);

// One-tap demo access: a real, isolated account that MongoDB deletes after 24 hours.
router.post(
  "/guest",
  authLimiter,
  asyncHandler(async (req, res) => {
    const id = crypto.randomBytes(6).toString("hex");
    const user = await User.create({
      name: "Guest",
      email: `guest-${id}@guest.pranexus.invalid`,
      emailVerified: true,
      isGuest: true,
      guestExpiresAt: new Date(Date.now() + GUEST_TTL_MS),
    });
    res.status(201).json(session(user));
  })
);

module.exports = router;
