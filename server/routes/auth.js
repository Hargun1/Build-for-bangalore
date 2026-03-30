const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendVerificationEmail } = require("../services/emailService");

function generateVerificationOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, gender, dob } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    // Generate 6-digit email verification OTP
    const verificationToken = generateVerificationOtp();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await User.create({
      name,
      email,
      password: hashed,
      gender,
      dob,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
      emailVerified: false,
    });

    // Send verification email
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (error) {
      console.error("Failed to send verification email:", error);
      // Continue anyway - user can still verify later
    }

    res.status(201).json({
      message: "Registration successful. Please check your email for the OTP code.",
      user: { id: user._id, name, email, gender, emailVerified: false },
      requiresEmailVerification: true,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/verify-email
router.post("/verify-email", async (req, res) => {
  try {
    const { token, email, otp } = req.body;

    // Backward compatibility: old token link verification
    if (token) {
      const tokenUser = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: Date.now() },
      });

      if (!tokenUser) {
        return res.status(400).json({ message: "Invalid or expired verification token" });
      }

      tokenUser.emailVerified = true;
      tokenUser.emailVerificationToken = null;
      tokenUser.emailVerificationExpires = null;
      await tokenUser.save();

      const jwtToken = jwt.sign(
        { id: tokenUser._id, gender: tokenUser.gender },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        message: "Email verified successfully!",
        token: jwtToken,
        user: {
          id: tokenUser._id,
          name: tokenUser.name,
          email: tokenUser.email,
          gender: tokenUser.gender,
          emailVerified: true,
        },
      });
    }

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const normalizedOtp = String(otp).trim();

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      emailVerificationToken: normalizedOtp,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    const jwtToken = jwt.sign(
      { id: user._id, gender: user.gender },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Email verified successfully!",
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        gender: user.gender,
        emailVerified: true,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in",
        emailVerified: false,
        userId: user._id,
      });
    }

    const jwtToken = jwt.sign(
      { id: user._id, gender: user.gender },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email,
        gender: user.gender,
        emailVerified: user.emailVerified,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/resend-verification
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    // Generate new 6-digit OTP
    const verificationToken = generateVerificationOtp();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    // Send verification email
    await sendVerificationEmail(email, verificationToken);

    res.json({ message: "Verification OTP sent. Please check your email." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
