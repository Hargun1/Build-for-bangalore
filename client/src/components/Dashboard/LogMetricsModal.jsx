import { useState } from "react";
import Modal from "../Shared/Modal";
import { errorMessage } from "../../services/api";
import { logMetrics } from "../../services/healthService";
import { makeCheckInPayload } from "../../utils/checkIn";

const FIELDS = [
  { key: "steps", label: "Steps", step: 1, min: 0, max: 100000, hint: "From your phone's health app" },
  { key: "sleepHours", label: "Sleep (hours)", step: 0.25, min: 0, max: 24 },
  { key: "restingHeartRate", label: "Resting heart rate (bpm)", step: 1, min: 20, max: 250 },
  { key: "systolic", label: "BP systolic (top)", step: 1, min: 50, max: 260 },
  { key: "diastolic", label: "BP diastolic (bottom)", step: 1, min: 30, max: 180 },
  { key: "weightKg", label: "Weight (kg)", step: 0.1, min: 10, max: 400 },
  { key: "waterLitres", label: "Water (litres)", step: 0.25, min: 0, max: 15 },
  { key: "spo2", label: "SpO₂ (%)", step: 1, min: 50, max: 100 },
  { key: "stressLevel", label: "Stress (0-10)", step: 1, min: 0, max: 10 },
];
const QUICK_FIELDS = new Set(["steps", "sleepHours", "systolic", "diastolic"]);

/** Log or update today's numbers; unchanged fields are left alone. */
export default function LogMetricsModal({ open, onClose, initial, onSaved }) {
  const [values, setValues] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.key, initial?.[f.key] ?? ""])));
  const [edited, setEdited] = useState(() => new Set());
  const [mode, setMode] = useState("quick");
  const [state, setState] = useState({ busy: false, error: "" });

  const submit = async (e) => {
    e.preventDefault();
    const { payload, error } = makeCheckInPayload(values, edited);
    if (error) {
      setState({ busy: false, error });
      return;
    }
    setState({ busy: true, error: "" });
    try {
      const { data } = await logMetrics(payload);
      onSaved?.(data);
      onClose();
    } catch (err) {
      setState({ busy: false, error: errorMessage(err) });
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Quick check-in" width={620}>
      <div className="ui-tabs" role="tablist" aria-label="Check-in readings" style={{ marginBottom: "1rem" }}>
        <button type="button" role="tab" aria-selected={mode === "quick"} className={mode === "quick" ? "active" : ""} onClick={() => setMode("quick")}>Quick</button>
        <button type="button" role="tab" aria-selected={mode === "all"} className={mode === "all" ? "active" : ""} onClick={() => setMode("all")}>All readings</button>
      </div>
      <form className="ui-stack" onSubmit={submit}>
        <div className="ui-form-grid">
          {FIELDS.filter((f) => mode === "all" || QUICK_FIELDS.has(f.key)).map((f) => (
            <label key={f.key} className="ui-field">
              <span>{f.label}</span>
              <input
                className="ui-input"
                type="number"
                inputMode="decimal"
                step={f.step}
                min={f.min}
                max={f.max}
                value={values[f.key]}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [f.key]: e.target.value }));
                  setEdited((current) => new Set(current).add(f.key));
                }}
              />
            </label>
          ))}
        </div>
        {state.error && <div className="ui-alert ui-alert-error" role="alert">{state.error}</div>}
        <div className="ui-row">
          <div className="ui-spacer" />
          <button type="button" className="ui-btn ui-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="ui-btn ui-btn-primary" disabled={state.busy}>{state.busy ? "Saving…" : "Save check-in"}</button>
        </div>
      </form>
    </Modal>
  );
}
