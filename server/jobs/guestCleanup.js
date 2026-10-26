const User = require("../models/User");
const { deleteAccountData, deleteOrphanedAccountData } = require("../services/accountData");

const INTERVAL_MS = 10 * 60 * 1000;

// The old TTL index only removed User documents and silently orphaned health data.
async function removeLegacyTtlIndex() {
  await User.init();
  const indexes = await User.collection.indexes();
  const legacy = indexes.find((index) => index.key?.guestExpiresAt === 1 && index.expireAfterSeconds === 0);
  if (legacy) await User.collection.dropIndex(legacy.name);
}

async function cleanupExpiredGuests(now = new Date()) {
  let removed = 0;
  for (;;) {
    const users = await User.find({ isGuest: true, guestExpiresAt: { $lte: now } }).select("_id").limit(100).lean();
    if (!users.length) break;
    const deleted = await Promise.all(users.map((user) => User.findOneAndDelete({
      _id: user._id, isGuest: true, guestExpiresAt: { $lte: now },
    }).select("_id").lean()));
    const ids = deleted.filter(Boolean).map((user) => user._id);
    await deleteAccountData(ids);
    removed += ids.length;
  }
  return removed;
}

function start() {
  const run = async () => {
    try {
      const guests = await cleanupExpiredGuests();
      const records = await deleteOrphanedAccountData();
      if (guests || records) console.log(`[guest-cleanup] removed ${guests} expired guests and ${records} orphaned records`);
    } catch (err) {
      console.warn("[guest-cleanup] failed:", err.message);
    }
  };
  run();
  const timer = setInterval(run, INTERVAL_MS);
  timer.unref();
}

module.exports = { removeLegacyTtlIndex, cleanupExpiredGuests, start };
