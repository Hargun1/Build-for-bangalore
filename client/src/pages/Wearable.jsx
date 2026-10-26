import { useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/Shared/AppShell";
import { HeartRateChart, VitalsControls, VitalsTiles } from "../components/Vitals/VitalsPanel";
import { useVitals } from "../context/VitalsContext";
import { errorMessage } from "../services/api";
import { logMetrics } from "../services/healthService";

export default function Wearable() {
  const { vitals, source, history } = useVitals();
  const [saved, setSaved] = useState({ text: "", ok: true });

  // Resting heart rate = the lowest steady reading of this session (sit still for 2-3 minutes first).
  const restingHr = history.length >= 20 ? Math.min(...history.slice(-60).map((h) => h.hr).filter((x) => x > 30)) : vitals.heartRate;

  const save = async () => {
    const payload = { source: source === "bluetooth" ? "bluetooth" : "manual" };
    if (restingHr) payload.restingHeartRate = restingHr;
    if (vitals.hrvMs) payload.hrvMs = vitals.hrvMs;
    if (vitals.spo2) payload.spo2 = vitals.spo2;
    if (vitals.bloodPressure) {
      payload.systolic = vitals.bloodPressure.systolic;
      payload.diastolic = vitals.bloodPressure.diastolic;
    }
    if (vitals.temperature) payload.temperatureC = vitals.temperature;
    try {
      await logMetrics(payload);
      setSaved({ text: "Saved to today's log. It now counts toward your risk scores and goals.", ok: true });
    } catch (err) {
      setSaved({ text: errorMessage(err), ok: false });
    }
  };

  return (
    <AppShell title="Vitals" subtitle="Your latest readings and connected devices.">
      <div className="ui-grid ui-grid-2" style={{ alignItems: "start" }}>
        <div className="ui-card">
          <h2>Source</h2>
          <VitalsControls />
        </div>
        <div className="ui-card ui-stack">
          <h2>Works with</h2>
          <ul className="ui-bullets ui-small">
            <li>Chest straps: Polar H9/H10, Garmin HRM, Decathlon, Wahoo TICKR, CooSpo and most other Bluetooth Smart straps</li>
            <li>Watches with heart-rate broadcast turned on (Garmin "Broadcast heart rate", some Amazfit and Coros models)</li>
            <li>Any device that offers the standard Bluetooth Heart Rate service</li>
          </ul>
          <p className="ui-faint">Apple Watch, Fitbit and most Indian fitness bands don't broadcast heart rate to browsers. For those, read the number off the device and use "Enter a reading".</p>
        </div>
      </div>

      <div style={{ height: "1rem" }} />

      <div className="ui-card ui-stack">
        <div className="ui-card-title"><h2 style={{ margin: 0 }}>Live readings</h2></div>
        {source === "none" ? (
          <div className="ui-empty"><strong>Nothing connected</strong>Connect a heart-rate monitor or enter a reading to see your vitals here.</div>
        ) : (
          <>
            <VitalsTiles />
            <HeartRateChart />
            <div className="ui-row">
              <button className="ui-btn ui-btn-primary" onClick={save} disabled={source === "simulator"} title={source === "simulator" ? "Simulated data can't be saved" : ""}>
                Save to today's log
              </button>
              {restingHr && source === "bluetooth" && <span className="ui-faint">Resting HR to save: {restingHr} bpm (lowest recent reading)</span>}
              {source === "simulator" && <span className="ui-faint">Simulated data is never saved to your health record.</span>}
            </div>
            {saved.text && <div className={`ui-alert ${saved.ok ? "ui-alert-info" : "ui-alert-error"}`}>{saved.text}</div>}
          </>
        )}
      </div>

      <div style={{ height: "1rem" }} />
      <div className="ui-alert ui-alert-info">
        Readings are also watched by the <Link to="/emergency" style={{ textDecoration: "underline" }}>Emergency page</Link>, which flags dangerous values and can alert your contacts.
      </div>
    </AppShell>
  );
}
