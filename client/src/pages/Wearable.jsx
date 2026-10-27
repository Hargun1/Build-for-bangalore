import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/Shared/AppShell";
import { HeartRateChart, VitalsControls, VitalsTiles } from "../components/Vitals/VitalsPanel";
import { useVitals } from "../context/VitalsContext";
import { errorMessage } from "../services/api";
import { logMetrics } from "../services/healthService";
import { hasRecentVitals, vitalLogPayload } from "../utils/vitals";

export default function Wearable() {
  const { vitals, source } = useVitals();
  const [saved, setSaved] = useState({ text: "", ok: true });
  const [restingSample, setRestingSample] = useState(null);

  useEffect(() => setRestingSample(null), [source]);

  const current = hasRecentVitals(vitals, source);
  const selectedResting = restingSample?.source === source && Date.now() - restingSample.timestamp <= 300000 && (source !== "manual" || restingSample.timestamp === vitals.timestamp);
  const payload = vitalLogPayload(vitals, source, selectedResting ? restingSample : null);

  const save = async () => {
    const latestPayload = vitalLogPayload(vitals, source, selectedResting ? restingSample : null);
    if (!latestPayload) {
      setSaved({ text: "No recent confirmed readings to save. Take a new reading first.", ok: false });
      return;
    }
    try {
      await logMetrics(latestPayload);
      setSaved({ text: "Saved these readings to today's log.", ok: true });
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
            {vitals.heartRate != null && source !== "simulator" && (
              <label className="ui-row ui-small" style={{ alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={Boolean(selectedResting)}
                  disabled={!current}
                  onChange={(event) => setRestingSample(event.target.checked ? { heartRate: vitals.heartRate, timestamp: vitals.timestamp, source } : null)}
                />
                <span>Save {selectedResting ? `${restingSample.heartRate} bpm` : "this pulse"} as resting heart rate. I was seated and calm for at least 5 minutes when it was measured.</span>
              </label>
            )}
            <div className="ui-row">
              <button className="ui-btn ui-btn-primary" onClick={save} disabled={source === "simulator" || !payload} title={source === "simulator" ? "Simulated data can't be saved" : ""}>
                Save to today's log
              </button>
              {!payload && source !== "simulator" && <span className="ui-faint">Enter a recent reading, or confirm a resting pulse above.</span>}
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
