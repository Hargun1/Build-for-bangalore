// Minimal RFC 5545 calendar file: one event with a reminder 24 hours before.
const pad = (n) => String(n).padStart(2, "0");
const stamp = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
// Escape per RFC 5545 section 3.3.11 and fold nothing longer than needed.
const esc = (s = "") => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

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
    `DESCRIPTION:${esc([appt.specialty && `Specialty: ${appt.specialty}`, appt.reason && `Reason: ${appt.reason}`, appt.place.phone && `Phone: ${appt.place.phone}`, "Call the clinic to confirm this slot."].filter(Boolean).join("\n"))}`,
    ...(appt.place.lat != null ? [`GEO:${appt.place.lat};${appt.place.lon}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:Doctor visit tomorrow",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

module.exports = { appointmentIcs };
