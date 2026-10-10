const crypto = require("crypto");
require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

// JWT_SECRET is mandatory in production. In development we generate a
// throwaway secret so the app still boots, but every restart logs users out.
let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 16 || jwtSecret.startsWith("your_")) {
  if (isProduction) {
    throw new Error("JWT_SECRET must be set to a random string of at least 16 characters in production");
  }
  jwtSecret = crypto.randomBytes(32).toString("hex");
  if (!isTest) {
    console.warn("[config] JWT_SECRET missing or weak; using a temporary secret for this run.");
  }
}

const env = {
  isProduction,
  isTest,
  port: Number(process.env.PORT || 5001),
  mongoUri: process.env.MONGODB_URI || "",
  jwtSecret,
  jwtExpiresIn: "7d",
  guestJwtExpiresIn: "24h",
  clientUrl: (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/+$/, ""),
  aiServiceUrl: (process.env.AI_SERVICE_URL || "http://localhost:8000").replace(/\/+$/, ""),
  // Shared secret so the AI service only answers this backend, not the internet.
  aiInternalToken: process.env.AI_INTERNAL_TOKEN || "",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  gmailUser: process.env.GMAIL_USER || "",
  gmailPassword: process.env.GMAIL_PASSWORD || "",
  // Open Food Facts and OpenStreetMap ask every client to identify itself.
  userAgent: process.env.HTTP_USER_AGENT || "PranexusAI/2.0 (https://github.com/Hargun1/Build-for-bangalore)",
};

env.emailConfigured = Boolean(env.gmailUser && env.gmailPassword);

module.exports = env;
