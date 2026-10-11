const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");
const env = require("./config/env");
const { apiLimiter } = require("./middleware/rateLimit");
const { notFound, errorHandler } = require("./middleware/errors");

const app = express();

// Render (and most hosts) put a proxy in front; needed for correct client IPs in rate limiting.
app.set("trust proxy", 1);

app.use(
  helmet({
    // The SPA loads 3D models, Google sign-in and map tiles; CSP is set for the static
    // build below rather than for JSON API responses.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

const allowedOrigins = new Set([env.clientUrl, "http://localhost:3000", "http://localhost:5173"]);
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin.replace(/\/+$/, ""))),
    credentials: true,
  })
);

// Photos are sent as base64 JSON; 8 MB covers a phone photo after client-side resizing.
app.use(express.json({ limit: "8mb" }));

app.get("/api/ping", (req, res) => res.json({ status: "ok" }));

app.use("/api", apiLimiter);
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/health", require("./routes/health"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/nutrition", require("./routes/nutrition"));
app.use("/api/goals", require("./routes/goals"));
app.use("/api/exposome", require("./routes/exposome"));
app.use("/api/emergency", require("./routes/emergency"));
app.use("/api/places", require("./routes/places"));
app.use("/api/appointments", require("./routes/appointments"));
app.use("/api/labs", require("./routes/labs"));
app.use("/api/system", require("./routes/system"));
app.use("/api", notFound);

// Single-service deploy: serve the built React app for every non-API path.
const clientDist = path.join(__dirname, "../client/dist");
if (env.isProduction && fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(express.static(clientDist, { maxAge: "7d", index: false }));
  app.get("*", (req, res) => res.sendFile(path.join(clientDist, "index.html")));
} else {
  app.get("/", (req, res) =>
    res.json({ service: "PranexusAI API", status: "running", docs: "Routes live under /api/*" })
  );
}

app.use(errorHandler);

module.exports = app;
