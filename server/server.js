const mongoose = require("mongoose");
const env = require("./config/env");
const app = require("./app");

async function connectDatabase() {
  if (env.mongoUri) {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log("MongoDB connected");
    return;
  }
  if (env.isProduction) {
    throw new Error("MONGODB_URI is required in production");
  }
  // Local development with no database configured: run an in-memory MongoDB.
  // Data is lost when the server stops.
  const { MongoMemoryServer } = require("mongodb-memory-server");
  const mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri());
  console.warn("No MONGODB_URI set: using a temporary in-memory database (data resets on restart).");
}

async function start() {
  try {
    await connectDatabase();
  } catch (err) {
    console.error("Could not connect to MongoDB:", err.message);
    process.exit(1);
  }
  app.listen(env.port, () => console.log(`PranexusAI API listening on port ${env.port}`));
}

start();
