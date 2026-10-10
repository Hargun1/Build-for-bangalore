const nodemailer = require("nodemailer");
const env = require("../config/env");

let transporter = null;
function getTransporter() {
  if (!env.emailConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.gmailUser, pass: env.gmailPassword },
    });
  }
  return transporter;
}

const escapeHtml = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const layout = (title, body) => `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
    <h2 style="color:#0f766e; margin-bottom: 4px;">${escapeHtml(title)}</h2>
    ${body}
    <p style="color:#64748b; font-size:12px; margin-top:24px;">Sent by PranexusAI. This app gives general wellness information, not medical diagnosis.</p>
  </div>`;

// Returns { ok, skipped?, error? } and never throws, so a mail failure cannot break a request.
async function send({ to, subject, html, attachments }) {
  const t = getTransporter();
  if (!t) return { ok: false, skipped: true, error: "Email is not configured on the server" };
  try {
    await t.sendMail({ from: `PranexusAI <${env.gmailUser}>`, to, subject, html, attachments });
    return { ok: true };
  } catch (err) {
    console.error(`Email to ${to} failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

async function sendOtp(email, otp, purpose = "verify") {
  if (!env.emailConfigured && !env.isProduction) {
    // Local development without Gmail credentials: print the code instead.
    if (!env.isTest) console.log(`[dev] ${purpose} code for ${email}: ${otp}`);
    return { ok: true, devLogged: true };
  }
  const reset = purpose === "reset";
  return send({
    to: email,
    subject: reset ? "Your PranexusAI password reset code" : "Your PranexusAI verification code",
    html: layout(
      reset ? "Reset your password" : "Verify your email",
      `<p>Use this one-time code to ${reset ? "set a new password" : "verify your email"}:</p>
       <div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:18px 0;">${escapeHtml(otp)}</div>
       <p>The code expires in 10 minutes. If you didn't ask for this, you can ignore this email.</p>`
    ),
  });
}

const sendVerificationOtp = (email, otp) => sendOtp(email, otp, "verify");
const sendPasswordResetOtp = (email, otp) => sendOtp(email, otp, "reset");

async function sendSosAlert({ to, contactName, userName, mapsUrl, detection, vitalsText, hospitals }) {
  const hospitalList = (hospitals || [])
    .slice(0, 3)
    .map((h) => `<li>${escapeHtml(h.name)}${h.distanceKm != null ? ` (${h.distanceKm} km)` : ""}${h.phone ? ` · ${escapeHtml(h.phone)}` : ""}</li>`)
    .join("");
  return send({
    to,
    subject: `SOS: ${userName} needs help`,
    html: layout(
      `${userName} triggered an SOS`,
      `<p>Hi ${escapeHtml(contactName)}, ${escapeHtml(userName)} pressed the emergency button in PranexusAI and listed you as an emergency contact.</p>
       ${detection ? `<p><strong>What the app detected:</strong> ${escapeHtml(detection)}</p>` : ""}
       ${vitalsText ? `<p><strong>Latest vitals:</strong> ${escapeHtml(vitalsText)}</p>` : ""}
       ${mapsUrl ? `<p><a href="${mapsUrl}" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;border-radius:6px;text-decoration:none;">Open their location in Maps</a></p>` : "<p>Location was not available.</p>"}
       ${hospitalList ? `<p><strong>Nearest hospitals:</strong></p><ul>${hospitalList}</ul>` : ""}
       <p>Please call them now. If you cannot reach them, call <strong>112</strong> (India emergency) or <strong>108</strong> (ambulance).</p>`
    ),
  });
}

async function sendAppointmentConfirmation({ to, userName, appointment, icsContent }) {
  const when = appointment.startsAt.toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kolkata" });
  return send({
    to,
    subject: `Appointment planned: ${appointment.place.name}`,
    html: layout(
      "Your appointment is in your calendar",
      `<p>Hi ${escapeHtml(userName)}, here are the details you saved:</p>
       <ul>
         <li><strong>Where:</strong> ${escapeHtml(appointment.place.name)}${appointment.place.address ? `, ${escapeHtml(appointment.place.address)}` : ""}</li>
         <li><strong>When:</strong> ${escapeHtml(when)} (IST)</li>
         ${appointment.specialty ? `<li><strong>Specialty:</strong> ${escapeHtml(appointment.specialty)}</li>` : ""}
         ${appointment.place.phone ? `<li><strong>Phone:</strong> ${escapeHtml(appointment.place.phone)}</li>` : ""}
       </ul>
       <p>PranexusAI does not book with the clinic for you. Please call them to confirm the slot. The attached calendar file adds a reminder one day before.</p>`
    ),
    attachments: icsContent ? [{ filename: "appointment.ics", content: icsContent, contentType: "text/calendar" }] : undefined,
  });
}

module.exports = { sendVerificationOtp, sendPasswordResetOtp, sendSosAlert, sendAppointmentConfirmation, escapeHtml };
