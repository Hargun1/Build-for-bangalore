const { appointmentIcs } = require("../services/ics");

test("appointment export folds UTF-8 lines and omits the private visit reason", () => {
  const ics = appointmentIcs({
    _id: "appt-1",
    startsAt: new Date("2026-11-01T04:30:00Z"),
    place: { name: `Clinic ${"हृदय".repeat(25)}\r\nBEGIN:VTODO`, address: "Jayanagar, Bengaluru", phone: "+91 80 1234 5678" },
    specialty: "Psychiatry",
    reason: "Private health details",
  });

  expect(ics).toContain("CLASS:PRIVATE\r\n");
  expect(ics).toContain("DTSTART:20261101T043000Z\r\n");
  expect(ics).toContain("TRIGGER:-P1D\r\n");
  expect(ics).not.toContain("Private health details");
  expect(ics).not.toContain("Psychiatry");
  expect(ics).not.toContain("\r\nBEGIN:VTODO\r\n");
  expect(ics.replace(/\r\n /g, "")).toContain("\\nBEGIN:VTODO");
  expect(ics.split("\r\n").every((line) => Buffer.byteLength(line, "utf8") <= 75)).toBe(true);
});
