const router = require("express").Router();
const { z } = require("zod");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { sosLimiter } = require("../middleware/rateLimit");
const { asyncHandler, HttpError } = require("../middleware/errors");
const User = require("../models/User");
const EmergencyEvent = require("../models/EmergencyEvent");
const { sendSosAlert } = require("../services/emailService");
const { nearby } = require("../services/places");

router.use(auth);

const sosSchema = z.object({
  trigger: z.enum(["manual", "auto"]).default("manual"),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  accuracyM: z.number().min(0).max(100000).optional(),
  detection: z.string().max(200).default(""),
  vitals: z
    .object({
      heartRate: z.number().min(0).max(300).optional(),
      spo2: z.number().min(0).max(100).optional(),
      systolic: z.number().min(0).max(300).optional(),
      diastolic: z.number().min(0).max(200).optional(),
      temperatureC: z.number().min(25).max(45).optional(),
    })
    .partial()
    .default({}),
  vitalsSource: z.enum(["bluetooth", "manual", "simulator", "none"]).default("none"),
});

function vitalsText(v, source) {
  const parts = [];
  if (v.heartRate != null) parts.push(`heart rate ${Math.round(v.heartRate)} bpm`);
  if (v.spo2 != null) parts.push(`SpO2 ${Math.round(v.spo2)}%`);
  if (v.systolic != null) parts.push(`BP ${Math.round(v.systolic)}/${Math.round(v.diastolic ?? 0)}`);
  if (v.temperatureC != null) parts.push(`temperature ${v.temperatureC.toFixed(1)}°C`);
  if (!parts.length) return "";
  // A simulated reading must never be mistaken for a real one by the person receiving it.
  return `${parts.join(", ")}${source === "simulator" ? " (SIMULATED demo data, not a real reading)" : ""}`;
}

const digits = (phone) => phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
// Indian mobile numbers without a country code get +91.
const intl = (phone) => {
  const d = digits(phone);
  return d.length === 10 ? `91${d}` : d;
};

// POST /api/emergency/sos
router.post(
  "/sos",
  sosLimiter,
  validate(sosSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw new HttpError(404, "Account not found.");
    const { lat, lon, accuracyM, trigger, detection, vitals, vitalsSource } = req.body;
    const hasLocation = lat != null && lon != null;
    const mapsUrl = hasLocation ? `https://www.google.com/maps?q=${lat},${lon}` : "";

    let hospitals = [];
    if (hasLocation) {
      try {
        hospitals = (await nearby({ lat, lon, kinds: ["hospital"], radiusKm: 8, limit: 5, timeoutMs: 12000 })).slice(0, 3);
      } catch {
        hospitals = []; // never block an SOS on the map lookup
      }
    }

    const vText = vitalsText(vitals, vitalsSource);
    const message =
      `SOS from ${user.name} via PranexusAI. ${detection ? `Detected: ${detection}. ` : ""}` +
      `${vText ? `Vitals: ${vText}. ` : ""}${mapsUrl ? `Location: ${mapsUrl}` : "Location unavailable."} Please call them now.`;

    const contacts = user.emergencyContacts || [];
    const notified = await Promise.all(
      contacts
        .filter((c) => c.email)
        .map(async (c) => {
          const r = await sendSosAlert({ to: c.email, contactName: c.name, userName: user.name, mapsUrl, detection, vitalsText: vText, hospitals });
          return { name: c.name, channel: "email", ok: r.ok, error: r.ok ? undefined : r.error };
        })
    );

    // Free WhatsApp/SMS sending needs paid gateways, so the app prepares the message
    // and the user taps once to send it from their own phone.
    const shareLinks = contacts
      .filter((c) => c.phone)
      .map((c) => ({
        name: c.name,
        tel: `tel:${c.phone.replace(/\s/g, "")}`,
        whatsapp: `https://wa.me/${intl(c.phone)}?text=${encodeURIComponent(message)}`,
        sms: `sms:${c.phone.replace(/\s/g, "")}?body=${encodeURIComponent(message)}`,
      }));

    const event = await EmergencyEvent.create({
      userId: user._id,
      trigger,
      detection,
      location: hasLocation ? { lat, lon, accuracyM } : undefined,
      vitals,
      vitalsSource,
      notified,
    });

    res.status(201).json({
      eventId: event._id,
      message,
      mapsUrl,
      hospitals,
      notified,
      shareLinks,
      contactsConfigured: contacts.length,
      emergencyNumbers: [
        { label: "Emergency (all services)", number: "112" },
        { label: "Ambulance", number: "108" },
      ],
    });
  })
);

router.post(
  "/:id/resolve",
  asyncHandler(async (req, res) => {
    const event = await EmergencyEvent.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { resolvedAt: new Date() }, { new: true });
    if (!event) throw new HttpError(404, "Event not found.");
    res.json(event);
  })
);

router.get(
  "/events",
  asyncHandler(async (req, res) => {
    res.json(await EmergencyEvent.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(10).lean());
  })
);

module.exports = router;
