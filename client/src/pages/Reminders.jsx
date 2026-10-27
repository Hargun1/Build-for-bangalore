import { useEffect, useState } from "react";
import { Bell, BellOff, Clock, Download, Droplets, Pill, Stethoscope, Trash2 } from "lucide-react";
import AppShell from "../components/Shared/AppShell";
import { errorMessage } from "../services/api";
import {
  createReminder,
  deleteReminder,
  devicePushState,
  disablePush,
  downloadReminderCalendar,
  enablePush,
  getReminders,
  isIos,
  isStandalone,
  sendTestPush,
  updateReminder,
} from "../services/pushClient";
import "./Reminders.css";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const KINDS = { medicine: <Pill size={20} />, water: <Droplets size={20} />, checkup: <Stethoscope size={20} />, custom: <Clock size={20} /> };
const every2h = ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"];
const PRESETS = [
  { label: "Medicine twice a day", value: { kind: "medicine", title: "", note: "", times: ["08:00", "20:00"], days: [] } },
  { label: "Water every 2 hours", value: { kind: "water", title: "Drink water", note: "", times: every2h, days: [] } },
  { label: "Weekly BP check", value: { kind: "checkup", title: "Check blood pressure", note: "Log it on the dashboard.", times: ["09:00"], days: [0] } },
  { label: "Custom", value: { kind: "custom", title: "", note: "", times: ["09:00"], days: [] } },
];
const daysText = (d) => (!d?.length ? "Every day" : d.length === 5 && !d.includes(0) && !d.includes(6) ? "Weekdays" : d.map((x) => DAYS[x]).join(", "));
const ago = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function DeviceCard({ state, setState }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const run = async (fn, ok) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setState(await devicePushState());
      if (ok) setMsg({ ok: true, text: ok });
    } catch (err) {
      setMsg({ ok: false, text: err.response ? errorMessage(err) : err.message });
    } finally {
      setBusy(false);
    }
  };

  const iosNeedsInstall = isIos() && !isStandalone();
  return (
    <section className={`ui-card rm-device rm-device-${state}`}>
      <div className="rm-device-icon" aria-hidden="true">{state === "on" ? <Bell size={22} /> : <BellOff size={22} />}</div>
      <div className="rm-device-body">
        <h2 className="ui-card-title" style={{ margin: 0 }}>
          {state === "on" ? "Notifications are on for this device" : "Turn on notifications"}
        </h2>
        <p className="ui-muted ui-small" style={{ margin: "0.3rem 0 0" }}>
          {state === "unsupported" && (iosNeedsInstall
            ? "On iPhone: tap Share → Add to Home Screen, open PranexusAI from there, then turn notifications on (iOS 16.4 or newer)."
            : "This browser can't receive notifications. Try Chrome, Edge or Firefox.")}
          {state === "denied" && "Notifications are blocked for this site. Allow them in the browser's site settings (the icon left of the address bar), then reload."}
          {state === "off" && "Browser alerts are off on this device. Turn them on for best-effort notifications."}
          {state === "on" && "This device can receive browser alerts. Scheduled delivery may be late or missed while the server is asleep."}
        </p>
        {msg && <p className={`ui-small ${msg.ok ? "rm-ok" : "rm-err"}`} role="status">{msg.text}</p>}
      </div>
      <div className="rm-device-actions">
        {state === "off" && <button className="ui-btn ui-btn-primary" disabled={busy} onClick={() => run(enablePush, "Done. Send a test to check it.")}>Turn on</button>}
        {state === "on" && (
          <>
            <button className="ui-btn" disabled={busy} onClick={() => run(async () => { const { data } = await sendTestPush(); if (!data.delivered) throw new Error("The test couldn't be delivered. Try turning notifications off and on."); }, "The push service accepted the test. Check this device for the alert.")}>Send test</button>
            <button className="ui-btn ui-btn-ghost" disabled={busy} onClick={() => run(disablePush)}>Turn off</button>
          </>
        )}
      </div>
    </section>
  );
}

function Editor({ initial, onSave, onCancel }) {
  const [r, setR] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setR((x) => ({ ...x, ...patch }));
  const toggleDay = (d) => {
    const all = r.days.length ? r.days : [0, 1, 2, 3, 4, 5, 6];
    const next = all.includes(d) ? all.filter((x) => x !== d) : [...all, d];
    if (next.length) set({ days: next.length === 7 ? [] : next.sort() });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ kind: r.kind, title: r.title, note: r.note || "", times: r.times.filter(Boolean), days: r.days, enabled: r.enabled ?? true });
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the reminder."));
      setSaving(false);
    }
  };

  return (
    <form className="ui-card rm-editor" onSubmit={save}>
      <div className="ui-form-grid">
        <label className="ui-field">
          <span>{r.kind === "medicine" ? "Medicine and dose" : "Reminder"}</span>
          <input className="ui-input" required maxLength={80} autoFocus value={r.title} placeholder={r.kind === "medicine" ? "e.g. Metformin 500 mg" : "e.g. Evening walk"} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label className="ui-field">
          <span>Note (optional)</span>
          <input className="ui-input" maxLength={160} value={r.note || ""} placeholder={r.kind === "medicine" ? "e.g. after food" : ""} onChange={(e) => set({ note: e.target.value })} />
        </label>
      </div>

      <div className="ui-field" style={{ marginTop: "0.8rem" }}>
        <span>Times (India time)</span>
        <div className="rm-times">
          {r.times.map((t, i) => (
            <span key={i} className="rm-time">
              <input type="time" className="ui-input" required value={t} aria-label={`Time ${i + 1}`} onChange={(e) => set({ times: r.times.map((x, j) => (j === i ? e.target.value : x)) })} />
              {r.times.length > 1 && <button type="button" className="rm-x" aria-label={`Remove ${t}`} onClick={() => set({ times: r.times.filter((_, j) => j !== i) })}>✕</button>}
            </span>
          ))}
          {r.times.length < 12 && <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" onClick={() => set({ times: [...r.times, "12:00"] })}>+ Add time</button>}
        </div>
      </div>

      <div className="ui-field" style={{ marginTop: "0.8rem" }}>
        <span>Days</span>
        <div className="rm-days" role="group" aria-label="Days">
          {DAYS.map((d, i) => {
            const on = !r.days.length || r.days.includes(i);
            return (
              <button key={d} type="button" aria-pressed={on} className={`rm-day ${on ? "on" : ""}`} onClick={() => toggleDay(i)}>{d}</button>
            );
          })}
        </div>
      </div>

      {error && <div className="ui-alert ui-alert-error" role="alert" style={{ marginTop: "0.8rem" }}>{error}</div>}
      <div className="ui-row" style={{ marginTop: "1rem" }}>
        <button className="ui-btn ui-btn-primary" disabled={saving}>{saving ? "Saving…" : "Save reminder"}</button>
        <button type="button" className="ui-btn ui-btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
}

export default function Reminders() {
  const [device, setDevice] = useState("off");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // {id?, value}
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    devicePushState().then(setDevice).catch(() => setDevice("unsupported"));
    getReminders()
      .then((r) => setList(r.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const save = async (value) => {
    if (editing.id) {
      const { data } = await updateReminder(editing.id, value);
      setList((l) => l.map((x) => (x._id === data._id ? data : x)));
    } else {
      const { data } = await createReminder(value);
      setList((l) => [...l, data]);
    }
    setExported(false);
    setEditing(null);
  };
  const toggle = async (r) => {
    try {
      const { data } = await updateReminder(r._id, { ...r, enabled: !r.enabled });
      setList((l) => l.map((x) => (x._id === data._id ? data : x)));
      setExported(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const remove = async (r) => {
    if (!window.confirm(`Delete "${r.title}"?`)) return;
    try {
      await deleteReminder(r._id);
      setList((l) => l.filter((x) => x._id !== r._id));
      setExported(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const exportCalendar = async () => {
    setExporting(true);
    setError("");
    try {
      await downloadReminderCalendar();
      setExported(true);
    } catch (err) {
      setError(errorMessage(err, "Couldn't download the calendar file."));
    } finally {
      setExporting(false);
    }
  };

  const activeCount = list.filter((r) => r.enabled).length;

  return (
    <AppShell title="Reminders" subtitle="Your routines and alerts.">
      {error && <div className="ui-alert ui-alert-error" role="alert">{error}</div>}
      <div className="ui-stack" style={{ gap: "1rem" }}>
        <div className="ui-alert ui-alert-info" role="note">Browser push is best-effort on this hosting plan. For time-sensitive medicine, also use a device calendar or alarm.</div>
        <DeviceCard state={device} setState={setDevice} />

        {editing ? (
          <Editor initial={editing.value} onSave={save} onCancel={() => setEditing(null)} />
        ) : (
          <section className="ui-card">
            <h2 className="ui-card-title">Add a reminder</h2>
            <div className="rm-presets">
              {PRESETS.map((p) => (
                <button key={p.label} className="rm-preset" onClick={() => setEditing({ value: { ...p.value, times: [...p.value.times] } })}>{KINDS[p.value.kind]}{p.label}</button>
              ))}
            </div>
          </section>
        )}

        <section className="ui-card">
          <div className="ui-card-title">
            <h2>Your reminders</h2>
            <button className="ui-btn ui-btn-sm" onClick={exportCalendar} disabled={!activeCount || exporting || loading} title="Download active reminders as a calendar file"><Download size={16} /> {exporting ? "Preparing…" : "Download calendar file"}</button>
          </div>
          {loading ? (
            <div className="ui-loading"><span className="ui-spinner" /> Loading…</div>
          ) : !list.length ? (
            <p className="ui-faint">No reminders yet. Pick one above to start.</p>
          ) : (
            <ul className="rm-list">
              {list.map((r) => (
                <li key={r._id} className={r.enabled ? "" : "rm-paused"}>
                  <span className="rm-kind" aria-hidden="true">{KINDS[r.kind]}</span>
                  <div className="rm-main">
                    <strong>{r.title}</strong>
                    {r.note && <span className="ui-faint"> · {r.note}</span>}
                    <div className="rm-chips">
                      {r.times.map((t) => <span key={t} className="rm-chip">{t}</span>)}
                      <span className="ui-faint ui-small">{daysText(r.days)}</span>
                    </div>
                    {r.lastSentAt && (
                      <div className="ui-faint ui-small">
                        Last push attempt {ago(r.lastSentAt)}
                        {r.lastResult && !r.lastResult.delivered && " · not delivered; check device settings"}
                      </div>
                    )}
                  </div>
                  <div className="rm-actions">
                    <button className={`rm-switch ${r.enabled ? "on" : ""}`} role="switch" aria-checked={r.enabled} aria-label={`${r.title} ${r.enabled ? "on" : "paused"}`} onClick={() => toggle(r)} />
                    <button className="ui-btn ui-btn-sm ui-btn-ghost" onClick={() => setEditing({ id: r._id, value: { ...r, times: [...r.times], days: [...(r.days || [])] } })}>Edit</button>
                    <button className="ui-btn ui-btn-sm ui-btn-ghost" onClick={() => remove(r)} aria-label={`Delete ${r.title}`} title="Delete reminder"><Trash2 size={16} /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {exported && <p className="ui-small rm-ok" role="status">Calendar file downloaded. Import it on your calendar website and check its notification settings.</p>}
          {list.length > 0 && <p className="ui-faint ui-small" style={{ marginTop: "0.75rem" }}>Calendar export is a one-time copy of active reminders in India time. Edits or pauses here will not update imported events; remove old events before importing again. Titles and notes are included. <a href="https://support.google.com/calendar/answer/37118?hl=en" target="_blank" rel="noreferrer">Google Calendar import guide</a></p>}
        </section>
      </div>
    </AppShell>
  );
}
