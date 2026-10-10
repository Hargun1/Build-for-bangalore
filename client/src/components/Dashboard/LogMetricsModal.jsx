import { useState } from "react";
import Modal from "../Shared/Modal";
import { errorMessage } from "../../services/api";
import { logMetrics } from "../../services/healthService";

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

/** Log or update today's numbers (one entry per day; only filled fields are sent). */
export default function LogMetricsModal({ open, onClose, initial, onSaved }) {
  const [values, setValues] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.key, initial?.[f.key] ?? ""])));
  const [state, setState] = useState({ busy: false, error: "" });

  const submit = async (e) => {
    e.preventDefault();
    const payload = { source: "manual" };
    for (const f of FIELDS) {
      if (values[f.key] !== "" && values[f.key] != null) payload[f.key] = Number(values[f.key]);
    }
    if (Object.keys(payload).length === 1) {
      setState({ busy: false, error: "Fill in at least one number." });
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
    <Modal open={open} onClose={onClose} title="Log today" width={620}>
      <p className="ui-faint" style={{ marginBottom: "1rem" }}>Fill in whatever you know. Logging again today updates the same entry.</p>
      <form className="ui-stack" onSubmit={submit}>
        <div className="ui-form-grid">
          {FIELDS.map((f) => (
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
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        {state.error && <div className="ui-alert ui-alert-error" role="alert">{state.error}</div>}
        <div className="ui-row">
          <div className="ui-spacer" />
          <button type="button" className="ui-btn ui-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="ui-btn ui-btn-primary" disabled={state.busy}>{state.busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}
