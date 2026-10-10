const rateLimit = require("express-rate-limit");
const env = require("../config/env");

// Tests hit endpoints many times in a row; limits are exercised in their own test.
const skip = () => env.isTest && process.env.ENABLE_RATE_LIMIT_IN_TEST !== "1";

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip,
    // Key by user when signed in so one shared IP (a college network) does not block everyone.
    keyGenerator: (req) => req.user?.id || rateLimit.ipKeyGenerator(req.ip),
    message: { message },
  });

module.exports = {
  // Login, register, OTP: stops password guessing and OTP brute force.
  authLimiter: make(15 * 60 * 1000, 20, "Too many attempts. Please wait 15 minutes and try again."),
  // AI endpoints cost free-tier quota; keep any one user from draining it.
  aiLimiter: make(60 * 60 * 1000, 60, "You've reached the hourly AI limit. Please try again later."),
  // SOS emails real people, so cap it hard.
  sosLimiter: make(10 * 60 * 1000, 5, "SOS was sent recently. Call 112 directly if you need help now."),
  apiLimiter: make(60 * 1000, 300, "Too many requests. Please slow down."),
};
