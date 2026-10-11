const Reminder = require("../models/Reminder");
const push = require("../services/push");
const { TIMEZONE } = require("../services/userContext");

// A slot is still sent if the server was asleep or busy for up to this long
// (Render's free plan sleeps; a late reminder beats a missing one).
const GRACE_MINUTES = 30;
const ICON = { medicine: "💊", water: "💧", checkup: "🩺", custom: "⏰" };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

function indiaTime(date) {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hhmm: `${p.hour}:${p.minute}`, dow: WEEKDAYS.indexOf(p.weekday) };
}

/** India-time minutes from (now - grace) to now: the slots that may still be due. */
function candidateSlots(now) {
  const out = [];
  for (let m = GRACE_MINUTES; m >= 0; m--) out.push(indiaTime(new Date(now.getTime() - m * 60000)));
  return out;
}

function bodyFor(r, hhmm) {
  if (r.note) return r.note;
  if (r.kind === "water") return "Time for a glass of water.";
  if (r.kind === "medicine") return "Time to take your medicine.";
  return `Reminder for ${hhmm}`;
}

/** Sends every reminder that is due and not yet sent. Safe to run as often as you like. */
async function tick(now = new Date()) {
  const slots = candidateSlots(now);
  const due = await Reminder.find({ enabled: true, times: { $in: [...new Set(slots.map((s) => s.hhmm))] } }).lean();
  let sent = 0;
  for (const r of due) {
    for (const s of slots) {
      if (!r.times.includes(s.hhmm) || (r.days?.length && !r.days.includes(s.dow))) continue;
      const slot = `${s.day}T${s.hhmm}`;
      // Claim the slot atomically; only the winner sends, so nobody gets a reminder twice.
      const claim = await Reminder.updateOne(
        { _id: r._id, enabled: true, sentSlots: { $ne: slot } },
        { $push: { sentSlots: { $each: [slot], $slice: -30 } }, $set: { lastSentAt: now } }
      );
      if (!claim.modifiedCount) continue;
      const result = await push.sendToUser(r.userId, {
        title: `${ICON[r.kind] || "⏰"} ${r.title}`,
        body: bodyFor(r, s.hhmm),
        tag: `reminder-${r._id}`,
        url: "/reminders",
      });
      await Reminder.updateOne({ _id: r._id }, { lastResult: { delivered: result.delivered, failed: result.failed } });
      sent += 1;
    }
  }
  return sent;
}

let timer = null;
function start() {
  if (timer || !push.configured()) return;
  const run = () => tick().catch((err) => console.warn("[reminders] tick failed:", err.message));
  timer = setInterval(run, 60 * 1000);
  timer.unref();
  run();
}

module.exports = { tick, start, candidateSlots, GRACE_MINUTES };
