const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mem;

async function connect() {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri());
}

async function clear() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

async function close() {
  await mongoose.disconnect();
  if (mem) await mem.stop();
}

module.exports = { connect, clear, close };
