import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useVitals } from "../../context/VitalsContext";
import Modal from "../Shared/Modal";
import { CHART, axisProps, tooltipStyle } from "../../utils/chartTheme";

const SCENARIO_LABELS = {
  normal: "Normal",
  "high-hr": "Very high heart rate",
  "low-spo2": "Low oxygen",
  "cardiac-arrest": "Cardiac arrest",
  fainting: "Fainting",
  "heat-stroke": "Heat stroke",
  hypotension: "Very low BP",
};

export function VitalsSourceBadge() {
  const { source, device } = useVitals();
  if (source === "bluetooth") return <span className="ui-badge ui-badge-good">● LIVE · {device?.name}</span>;
  if (source === "manual") return <span className="ui-badge ui-badge-info">Entered manually</span>;
  if (source === "simulator") return <span className="ui-badge ui-badge-warn">SIMULATED demo data</span>;
  return <span className="ui-badge">No device</span>;
}

function ManualVitalsModal({ open, onClose }) {
  const { setManualVitals } = useVitals();
  const [v, setV] = useState({ heartRate: "", spo2: "", systolic: "", diastolic: "", temperature: "" });
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    const n = (x) => (x === "" ? null : Number(x));
    setManualVitals({
      heartRate: n(v.heartRate),
      spo2: n(v.spo2),
      bloodPressure: v.systolic ? { systolic: n(v.systolic), diastolic: n(v.diastolic) } : null,
      temperature: n(v.temperature),
    });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Enter a reading">
      <form className="ui-stack" onSubmit={submit}>
        <p className="ui-faint">From a BP cuff, pulse oximeter, thermometer or by counting your pulse for 30 s × 2.</p>
        <div className="ui-form-grid">
          <label className="ui-field"><span>Heart rate (bpm)</span><input className="ui-input" type="number" min="20" max="250" value={v.heartRate} onChange={set("heartRate")} /></label>
          <label className="ui-field"><span>SpO₂ (%)</span><input className="ui-input" type="number" min="50" max="100" value={v.spo2} onChange={set("spo2")} /></label>
          <label className="ui-field"><span>BP systolic</span><input className="ui-input" type="number" min="50" max="260" value={v.systolic} onChange={set("systolic")} /></label>
          <label className="ui-field"><span>BP diastolic</span><input className="ui-input" type="number" min="30" max="180" value={v.diastolic} onChange={set("diastolic")} required={Boolean(v.systolic)} /></label>
          <label className="ui-field"><span>Temperature (°C)</span><input className="ui-input" type="number" step="0.1" min="30" max="45" value={v.temperature} onChange={set("temperature")} /></label>
        </div>
        <div className="ui-row"><div className="ui-spacer" /><button type="button" className="ui-btn ui-btn-ghost" onClick={onClose}>Cancel</button><button className="ui-btn ui-btn-primary">Use reading</button></div>
      </form>
    </Modal>
  );
}

/** Connect / enter / simulate controls. `allowSimulator` shows the demo scenarios. */
export function VitalsControls({ allowSimulator = true }) {
  const { source, status, bluetoothSupported, connectBluetooth, startSimulator, disconnect, scenario, scenarios } = useVitals();
  const [manualOpen, setManualOpen] = useState(false);
  return (
    <div className="ui-stack">
      <div className="ui-row">
        <VitalsSourceBadge />
        <div className="ui-spacer" />
        {source !== "none" && <button className="ui-btn ui-btn-sm ui-btn-ghost" onClick={disconnect}>Disconnect</button>}
      </div>
      <div className="ui-row">
        <button className="ui-btn ui-btn-primary" onClick={connectBluetooth} disabled={status.connecting || !bluetoothSupported} title={bluetoothSupported ? "" : "Web Bluetooth needs Chrome or Edge"}>
          {status.connecting ? "Connecting…" : "Connect Bluetooth heart-rate monitor"}
        </button>
        <button className="ui-btn" onClick={() => setManualOpen(true)}>Enter a reading</button>
      </div>
      {!bluetoothSupported && <p className="ui-faint">Bluetooth needs Chrome or Edge on Android, Windows or macOS (not available on iPhone browsers).</p>}
      {status.error && <div className="ui-alert ui-alert-warn">{status.error}</div>}
      {allowSimulator && (
        <details open={source === "simulator"}>
          <summary className="ui-small ui-muted" style={{ cursor: "pointer" }}>Demo simulator (for presentations)</summary>
          <div className="ui-row" style={{ marginTop: "0.5rem" }}>
            {scenarios.map((s) => (
              <button key={s} className={`ui-btn ui-btn-sm ${source === "simulator" && scenario === s ? "ui-btn-primary" : ""}`} onClick={() => startSimulator(s)}>
                {SCENARIO_LABELS[s] || s}
              </button>
            ))}
          </div>
          <p className="ui-faint" style={{ marginTop: "0.4rem" }}>Simulated numbers are labelled everywhere, including in SOS messages.</p>
        </details>
      )}
      {manualOpen && <ManualVitalsModal open onClose={() => setManualOpen(false)} />}
    </div>
  );
}

const STATUS = {
  hr: (v) => (v == null ? null : v > 150 || v < 40 ? "bad" : v > 110 || v < 50 ? "warn" : "good"),
  spo2: (v) => (v == null ? null : v < 90 ? "bad" : v < 94 ? "warn" : "good"),
  sys: (v) => (v == null ? null : v > 180 || v < 80 ? "bad" : v >= 140 || v < 90 ? "warn" : "good"),
  temp: (v) => (v == null ? null : v >= 40 || v < 35 ? "bad" : v >= 38 ? "warn" : "good"),
};
const BADGE = { good: "ui-badge-good", warn: "ui-badge-warn", bad: "ui-badge-bad" };
const WORD = { good: "normal", warn: "check", bad: "alert" };

function Age({ ts }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 5000);
    return () => clearInterval(id);
  }, []);
  if (!ts) return null;
  const s = Math.round((Date.now() - ts) / 1000);
  return <span className="ui-faint">{s < 5 ? "just now" : s < 120 ? `${s}s ago` : `${Math.round(s / 60)} min ago`}</span>;
}

export function VitalsTiles() {
  const { vitals } = useVitals();
  const tiles = [
    { label: "Heart rate", value: vitals.heartRate, unit: "bpm", status: STATUS.hr(vitals.heartRate) },
    { label: "HRV (RMSSD)", value: vitals.hrvMs, unit: "ms", status: null, hint: "Needs a strap that sends beat intervals" },
    { label: "SpO₂", value: vitals.spo2, unit: "%", status: STATUS.spo2(vitals.spo2) },
    { label: "Blood pressure", value: vitals.bloodPressure ? `${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic}` : null, unit: "mmHg", status: STATUS.sys(vitals.bloodPressure?.systolic) },
    { label: "Temperature", value: vitals.temperature, unit: "°C", status: STATUS.temp(vitals.temperature) },
  ];
  return (
    <div>
      <div className="ui-grid ui-grid-4">
        {tiles.map((t) => (
          <div key={t.label} className="ui-stat">
            <div className="ui-row"><span className="ui-stat-label">{t.label}</span><div className="ui-spacer" />{t.status && <span className={`ui-badge ${BADGE[t.status]}`}>{WORD[t.status]}</span>}</div>
            <div className="ui-stat-value">{t.value ?? "–"}{t.value != null && <small>{t.unit}</small>}</div>
            {t.value == null && t.hint && <div className="ui-stat-sub">{t.hint}</div>}
          </div>
        ))}
      </div>
      <div style={{ marginTop: "0.4rem" }}><Age ts={vitals.timestamp} /></div>
    </div>
  );
}

export function HeartRateChart() {
  const { history } = useVitals();
  if (history.length < 3) return <div className="ui-empty">The heart-rate trace appears once readings arrive.</div>;
  const start = history[0].t;
  const data = history.map((p) => ({ s: Math.round((p.t - start) / 1000), hr: p.hr }));
  return (
    <ResponsiveContainer width="100%" height={170}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="s" {...axisProps} tickFormatter={(s) => `${s}s`} />
        <YAxis {...axisProps} width={44} domain={["dataMin - 5", "dataMax + 5"]} allowDecimals={false} />
        <Tooltip {...tooltipStyle} labelFormatter={(s) => `${s}s`} formatter={(v) => [`${v} bpm`, "Heart rate"]} />
        <Line type="monotone" dataKey="hr" stroke={CHART.series[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
