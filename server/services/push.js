const webpush = require("web-push");
const env = require("../config/env");
const PushSubscription = require("../models/PushSubscription");

let keys = { publicKey: env.vapidPublicKey, privateKey: env.vapidPrivateKey };
if (!keys.publicKey || !keys.privateKey) {
  if (env.isProduction) {
    console.warn("[push] VAPID keys not set: reminders can't be delivered. Run `npx web-push generate-vapid-keys`.");
    keys = null;
  } else {
    // Development: a throwaway pair. Browsers must re-subscribe after each restart.
    keys = webpush.generateVAPIDKeys();
    if (!env.isTest) console.warn("[push] VAPID keys not set; using temporary keys for this run.");
  }
}
if (keys) webpush.setVapidDetails(env.vapidSubject, keys.publicKey, keys.privateKey);

const configured = () => Boolean(keys);
const publicKey = () => keys?.publicKey || null;

/**
 * Sends one notification to every device of a user. Subscriptions the push service
 * reports as gone (404/410: permission revoked or browser data cleared) are deleted.
 */
async function sendToUser(userId, payload) {
  if (!keys) return { delivered: 0, failed: 0, devices: 0 };
  const subs = await PushSubscription.find({ userId }).lean();
  let delivered = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 3600, urgency: "high" });
        delivered += 1;
        await PushSubscription.updateOne({ _id: s._id }, { lastSuccessAt: new Date() });
      } catch (err) {
        failed += 1;
        if (err.statusCode === 404 || err.statusCode === 410) await PushSubscription.deleteOne({ _id: s._id });
        else console.warn(`[push] send failed (${err.statusCode || err.code || "error"})`);
      }
    })
  );
  return { delivered, failed, devices: subs.length };
}

module.exports = { configured, publicKey, sendToUser };
