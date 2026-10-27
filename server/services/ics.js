// RFC 5545 calendar files for appointments and recurring reminders.
const pad = (n) => String(n).padStart(2, "0");
const stamp = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
// Escape per RFC 5545 section 3.3.11.
const esc = (s = "") => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");

// iCalendar lines are limited to 75 octets; continuation lines begin with a space.
function fold(line) {
  let out = "";
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, "utf8");
    if (bytes + size > 75) {
      out += "\r\n ";
      bytes = 1;
    }
    out += char;
    bytes += size;
  }
  return out;
}

function appointmentIcs(appt, durationMinutes = 30) {
  const start = new Date(appt.startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PranexusAI//Appointments//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${appt._id}@pranexus.app`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`Doctor visit: ${appt.place.name}`)}`,
    `LOCATION:${esc([appt.place.name, appt.place.address].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${esc([appt.place.phone && `Phone: ${appt.place.phone}`, "Call the clinic to confirm this slot."].filter(Boolean).join("\n"))}`,
    ...(appt.place.lat != null ? [`GEO:${appt.place.lat};${appt.place.lon}`] : []),
    "CLASS:PRIVATE",
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:Doctor visit tomorrow",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

const IST_OFFSET_MS = 330 * 60000;
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function nextReminderStart(now, hhmm, days) {
  const local = new Date(now.getTime() + IST_OFFSET_MS);
  const [hour, minute] = hhmm.split(":").map(Number);
  for (let offset = 0; offset <= 7; offset++) {
    const dow = (local.getUTCDay() + offset) % 7;
    if (days.length && !days.includes(dow)) continue;
    const utc = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + offset, hour, minute) - IST_OFFSET_MS);
    if (utc >= now) return utc;
  }
  throw new Error("Reminder has no upcoming day");
}

function remindersIcs(reminders, now = new Date()) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PranexusAI//Reminders//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const reminder of reminders.filter((r) => r.enabled)) {
    const days = [...new Set(reminder.days || [])].sort();
    const recurrence = days.length ? `RRULE:FREQ=WEEKLY;BYDAY=${days.map((d) => BYDAY[d]).join(",")}` : "RRULE:FREQ=DAILY";
    for (const time of reminder.times) {
      const start = nextReminderStart(now, time, days);
      lines.push(
        "BEGIN:VEVENT",
        `UID:reminder-${reminder._id}-${time.replace(":", "")}@pranexus.app`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART:${stamp(start)}`,
        `DTEND:${stamp(new Date(start.getTime() + 5 * 60000))}`,
        recurrence,
        `SUMMARY:${esc(reminder.title)}`,
        `DESCRIPTION:${esc(reminder.note || "PranexusAI reminder")}`,
        "CLASS:PRIVATE",
        "TRANSP:TRANSPARENT",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "TRIGGER:PT0S",
        `DESCRIPTION:${esc(reminder.title)}`,
        "END:VALARM",
        "END:VEVENT"
      );
    }
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

module.exports = { appointmentIcs, remindersIcs };
