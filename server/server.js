const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();

// CORS — allow the configured CLIENT_URL in production
const allowedOrigin = process.env.CLIENT_URL || "*";
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: "50mb" }));

// API Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/health", require("./routes/health"));
app.use("/api/appointments", require("./routes/appointments"));
app.use("/api/grocery", require("./routes/grocery"));
app.use("/api/food-plate", require("./routes/food-plate"));
app.use("/api/health-qa", require("./routes/health-qa"));
app.use("/api/exposome", require("./routes/exposome"));
app.use("/api/doctors", require("./routes/doctors"));

// Favicon: return no content to avoid 404 noise in dev
app.get("/favicon.ico", (req, res) => res.status(204).end());

// Health check
app.get("/api/ping", (req, res) => res.json({ status: "ok" }));

// Serve React frontend in production (single Render service)
if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../client/dist");
  const clientIndex = path.join(clientDist, "index.html");
  const hasFrontendBuild = fs.existsSync(clientIndex);

  if (hasFrontendBuild) {
    app.use(express.static(clientDist));
    // All non-API routes return the React app
    app.get("*", (req, res) => {
      res.sendFile(clientIndex);
    });
  } else {
    console.warn(`Frontend build not found at ${clientIndex}. Serving API-only mode.`);
    const configuredClientUrl = process.env.CLIENT_URL;

    app.get("/", (req, res) => {
      res.status(200).json({
        service: "PranexusAI backend",
        status: "running",
        mode: "api-only",
        note: "Frontend build is missing. Deploy client separately or ensure client/dist is built during deploy.",
      });
    });

    // If a browser hits backend non-API routes (e.g. /login, /register),
    // send users to the deployed client app instead of returning 404.
    app.get("*", (req, res) => {
      if (configuredClientUrl) {
        return res.redirect(302, configuredClientUrl);
      }

      return res.status(404).json({ message: "Route not found. Use /api/* endpoints on backend." });
    });
  }
} else {
  app.get("/", (req, res) => {
    res.status(200).json({
      service: "PranexusAI backend",
      status: "running",
      note: "Use the frontend at http://localhost:3000 and API routes under /api/*",
    });
  });
}

// Start server — Render assigns PORT dynamically, fallback for local dev
const DEFAULT_PORT = Number(process.env.PORT || 5001);
const MAX_PORT_RETRIES = 10;

function startServerWithFallback(preferredPort, retries = 0) {
  const currentPort = preferredPort + retries;
  const server = app.listen(currentPort, () => {
    if (retries > 0) {
      console.warn(`Preferred port ${preferredPort} was busy. Server running on fallback port ${currentPort}`);
    } else {
      console.log(`Server running on port ${currentPort}`);
    }
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && retries < MAX_PORT_RETRIES) {
      console.warn(`Port ${currentPort} is in use. Trying port ${currentPort + 1}...`);
      startServerWithFallback(preferredPort, retries + 1);
      return;
    }
    console.error("Failed to start server:", err.message);
    process.exit(1);
  });
}

startServerWithFallback(DEFAULT_PORT);

// MongoDB connection
const mongoUri = process.env.MONGODB_URI;
if (mongoUri && typeof mongoUri === "string" && mongoUri.length > 0) {
  mongoose
    .connect(mongoUri)
    .then(() => console.log("MongoDB connected successfully"))
    .catch((err) => {
      console.warn("MongoDB connection warning:", err.message);
      console.warn("Server running but database features may not work.");
    });
} else {
  console.warn("No MONGODB_URI set. Server running without database.");
}
