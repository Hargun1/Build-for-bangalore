import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import AppShell from "../components/Shared/AppShell";
import SOSButton from "../components/Emergency/SOSButton";
import AlarmSystem from "../components/Emergency/AlarmSystem";
import FirstAidGuide from "../components/Emergency/FirstAidGuide";
import { detectEmergency, FIRST_AID_GUIDES } from "../components/Emergency/EmergencyDetector";
import { VitalsControls, VitalsTiles } from "../components/Vitals/VitalsPanel";
import { useAuth } from "../context/AuthContext";
import { useVitals } from "../context/VitalsContext";
import { errorMessage } from "../services/api";
import { getNearbyPlaces, resolveSos, triggerSos } from "../services/healthService";
import { getLocation, mapsSearchUrl } from "../utils/geo";
import { hasRecentVitals, sosVitalPayload } from "../utils/vitals";
import "../components/Emergency/Emergency.css";

function Hospitals({ places, loading, error, onRetry }) {
  if (loading) return <div className="ui-loading"><span className="ui-spinner" /> Finding hospitals near you…</div>;
  if (error) {
    return (
      <div className="ui-alert ui-alert-warn ui-row">
        <span>{error}</span>
        <div className="ui-spacer" />
        <button className="ui-btn ui-btn-sm" onClick={onRetry}>Try again</button>
      </div>
    );
  }
  if (!places?.length) return <div className="ui-empty">No hospitals found within 8 km on OpenStreetMap.</div>;
  return (
    <ul className="ui-list">
      {places.map((h) => (
        <li key={h.osmId} className="ui-row">
          <div style={{ flex: 1, minWidth: 180 }}>
            <strong>{h.name}</strong>
            <div className="ui-faint">{h.distanceKm} km{h.address ? ` · ${h.address}` : ""}{h.emergency ? " · has emergency dept." : ""}</div>
          </div>
          {h.phone && <a className="ui-btn ui-btn-sm" href={`tel:${h.phone.replace(/\s/g, "")}`}>Call</a>}
          <a className="ui-btn ui-btn-sm" href={h.mapsUrl} target="_blank" rel="noreferrer">Directions</a>
        </li>
      ))}
    </ul>
  );
}

export default function Emergency() {
  const { user } = useAuth();
  const { vitals, source, isSimulated, hasData } = useVitals();
  const [alarm, setAlarm] = useState(false);
  const [autoArm, setAutoArm] = useState(false);
  const [sos, setSos] = useState({ sending: false, result: null, error: "" });
  const [hospitals, setHospitals] = useState({ loading: true, places: [], error: "", loc: null });
  const [guideType, setGuideType] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const detection = useMemo(() => (hasData && hasRecentVitals(vitals, source, now) ? detectEmergency(vitals) : null), [hasData, vitals, source, now]);
  const contacts = user?.emergencyContacts || [];

  // Loading this early also warms the server's cache, so an SOS can include hospitals quickly.
  const loadHospitals = useCallback(async () => {
    setHospitals((current) => ({ ...current, loading: true, error: "" }));
    const loc = await getLocation();
    try {
      const { data } = await getNearbyPlaces({ lat: loc.lat, lon: loc.lon, kinds: "hospital", radiusKm: 8 });
      setHospitals({ loading: false, places: data.places.slice(0, 6), error: "", loc });
    } catch (err) {
      setHospitals({ loading: false, places: [], error: errorMessage(err), loc });
    }
  }, []);

  useEffect(() => {
    loadHospitals();
  }, [loadHospitals]);

  // A critical reading sounds the alarm. For real data it also arms an automatic SOS
  // with a 5-second countdown the user can cancel; simulated data never sends one.
  // Fires once per new condition, so muting or cancelling isn't undone by the next reading.
  const alertKey = detection ? `${detection.type}|${detection.severity}` : "";
  const lastAlertKey = useRef("");
  useEffect(() => {
    if (alertKey === lastAlertKey.current) return;
    lastAlertKey.current = alertKey;
    if (!detection) return;
    setGuideType(detection.type);
    if (detection.severity === "emergency" && !sos.result) {
      setAlarm(true);
      if (!isSimulated) setAutoArm(true);
    }
  }, [alertKey, detection, isSimulated, sos.result]);

  const sendSos = useCallback(async () => {
    setAutoArm(false);
    setSos({ sending: true, result: null, error: "" });
    const loc = await getLocation({ highAccuracy: true, timeoutMs: 10000 });
    try {
      const currentVitals = sosVitalPayload(vitals, source);
      const { data } = await triggerSos({
        trigger: detection?.severity === "emergency" ? "auto" : "manual",
        ...(loc.isDefault ? {} : { lat: loc.lat, lon: loc.lon, accuracyM: loc.accuracyM }),
        detection: detection ? `${detection.type} (${detection.details})` : "",
        ...(currentVitals ? { vitals: currentVitals, vitalsSource: source } : {}),
      });
      setSos({ sending: false, result: data, error: "" });
    } catch (err) {
      setSos({ sending: false, result: null, error: `${errorMessage(err)} Call 112 directly.` });
    }
  }, [detection, vitals, source]);

  const imSafe = async () => {
    setAlarm(false);
    setAutoArm(false);
    if (sos.result?.eventId) await resolveSos(sos.result.eventId).catch(() => {});
    setSos({ sending: false, result: null, error: "" });
  };

  return (
    <AppShell title="Emergency" subtitle="Emergency contacts and nearby care.">
      <AlarmSystem active={alarm} onMute={() => setAlarm(false)} />

      <div className="ui-grid ui-grid-2" style={{ marginBottom: "1rem" }}>
        <a href="tel:112" className="ui-btn ui-btn-danger ui-btn-lg">Call 112 · Emergency</a>
        <a href="tel:108" className="ui-btn ui-btn-danger ui-btn-lg">Call 108 · Ambulance</a>
      </div>

      {detection && (
        <div className={`ui-alert ${detection.severity === "emergency" ? "ui-alert-emergency" : "ui-alert-warn"}`} role="alert" style={{ marginBottom: "1rem" }}>
          <strong>{detection.icon} {detection.type}{isSimulated ? " (SIMULATED)" : ""}</strong>
          {detection.details}. Triggered because: {detection.rule}.
          {detection.severity === "emergency" && !isSimulated && " An SOS will be sent automatically unless you cancel."}
        </div>
      )}

      <div className="ui-grid ui-grid-2" style={{ alignItems: "start" }}>
        <section className="ui-card ui-stack">
          <h2>SOS</h2>
          {contacts.length === 0 ? (
            <div className="ui-alert ui-alert-warn">
              <strong>No emergency contacts yet</strong>
              SOS can only alert people you've added. <Link to="/profile" style={{ textDecoration: "underline" }}>Add contacts in your profile</Link>.
            </div>
          ) : (
            <p className="ui-muted ui-small">Will alert: {contacts.map((c) => c.name).join(", ")}. <Link to="/profile" style={{ textDecoration: "underline" }}>Edit</Link></p>
          )}
          <SOSButton onTrigger={sendSos} onCancel={() => { setAutoArm(false); setAlarm(false); }} isActive={autoArm} emergencyType={detection?.type || ""} />
          {sos.sending && <div className="ui-loading"><span className="ui-spinner" /> Getting your location and alerting contacts…</div>}
          {sos.error && <div className="ui-alert ui-alert-error" role="alert">{sos.error}</div>}
          {sos.result && (
            <div className="ui-stack">
              <div className={`ui-alert ${sos.result.notified.some((n) => n.ok) ? "ui-alert-info" : "ui-alert-warn"}`}>
                <strong>SOS saved</strong>
                {sos.result.notified.length
                  ? sos.result.notified.map((n) => `${n.name}: ${n.ok ? "email accepted for delivery" : `email failed (${n.error})`}`).join(" · ")
                  : "No contact has an email address, so nothing was emailed."}
                {sos.result.mapsUrl ? "" : " Your location could not be read."}
                {" Call or message your contacts directly if help is urgent."}
              </div>
              {sos.result.shareLinks.length > 0 && (
                <div>
                  <strong className="ui-small">Tap to message or call (sends from your phone)</strong>
                  <ul className="ui-list" style={{ marginTop: "0.4rem" }}>
                    {sos.result.shareLinks.map((l) => (
                      <li key={l.name} className="ui-row">
                        <span style={{ flex: 1 }}>{l.name}</span>
                        <a className="ui-btn ui-btn-sm" href={l.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
                        <a className="ui-btn ui-btn-sm" href={l.sms}>SMS</a>
                        <a className="ui-btn ui-btn-sm ui-btn-danger" href={l.tel}>Call</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button className="ui-btn" onClick={imSafe}>I'm safe now</button>
            </div>
          )}
          <details>
            <summary className="ui-small ui-muted" style={{ cursor: "pointer" }}>What SOS does</summary>
            <ul className="ui-bullets ui-small" style={{ marginTop: "0.4rem" }}>
              <li>Reads your location from the browser (with your permission).</li>
              <li>Attempts to email each contact who has an email address. Includes your location, latest vitals and up to 3 hospitals when the lookup works.</li>
              <li>Prepares a WhatsApp/SMS message for contacts with a phone number; you tap once to send it.</li>
              <li>It does not call 112 for you. Use the red buttons above for that.</li>
            </ul>
          </details>
        </section>

        <section className="ui-card ui-stack">
          <h2>Live vitals</h2>
          <VitalsControls />
          {source !== "none" && <VitalsTiles />}
        </section>
      </div>

      <div style={{ height: "1rem" }} />

      <div className="ui-grid ui-grid-2" style={{ alignItems: "start" }}>
        <div className="ui-card">
          <div className="ui-card-title">
            <h2 style={{ margin: 0 }}>First aid</h2>
            <select className="ui-select" style={{ width: "auto" }} value={guideType} onChange={(e) => setGuideType(e.target.value)} aria-label="Choose a first-aid guide">
              <option value="">Choose a situation…</option>
              {Object.keys(FIRST_AID_GUIDES).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <FirstAidGuide emergencyType={guideType} steps={FIRST_AID_GUIDES[guideType] || []} />
        </div>
        <div className="ui-card">
          <h2>Nearest hospitals</h2>
          <Hospitals {...hospitals} onRetry={loadHospitals} />
          <a className="ui-btn ui-btn-sm" href={mapsSearchUrl("hospitals", hospitals.loc)} target="_blank" rel="noreferrer" style={{ alignSelf: "flex-start" }}><MapPin size={15} /> Search hospitals in Maps</a>
          {hospitals.loc?.isDefault && <p className="ui-faint">Location is off, so this searches around central Bengaluru.</p>}
          <p className="ui-faint" style={{ marginTop: "0.6rem" }}>From OpenStreetMap. Call ahead if you can; not every listing has an emergency department.</p>
        </div>
      </div>
    </AppShell>
  );
}
