import { useCallback, useEffect, useState } from "react";
import { MapPin, Plus } from "lucide-react";
import SourceBadge from "../Shared/SourceBadge";
import { errorMessage } from "../../services/api";
import {
  createAppointment,
  deleteAppointment,
  downloadAppointmentIcs,
  getAppointments,
  getNearbyPlaces,
  setAppointmentStatus,
  triageSymptoms,
} from "../../services/healthService";
import { getLocation, mapsSearchUrl } from "../../utils/geo";

// Values match OpenStreetMap's healthcare:speciality tag, so search can filter on them.
const SPECIALTIES = {
  general: "General physician",
  cardiology: "Cardiologist (heart)",
  dermatology: "Dermatologist (skin)",
  otolaryngology: "ENT (ear, nose, throat)",
  gastroenterology: "Gastroenterologist (stomach)",
  gynaecology: "Gynaecologist",
  neurology: "Neurologist",
  ophthalmology: "Eye specialist",
  orthopaedics: "Orthopaedic (bones, joints)",
  paediatrics: "Paediatrician (children)",
  psychiatry: "Psychiatrist",
  pulmonology: "Pulmonologist (lungs)",
  urology: "Urologist",
  dentistry: "Dentist",
  endocrinology: "Endocrinologist (diabetes, thyroid)",
  nephrology: "Nephrologist (kidneys)",
};
const URGENCY = {
  emergency: ["ui-alert-emergency", "Go to an emergency department now"],
  urgent: ["ui-alert-error", "See a doctor within 24 hours"],
  soon: ["ui-alert-warn", "See a doctor this week"],
  routine: ["ui-alert-info", "A routine appointment is fine"],
};

function defaultSlot() {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  d.setHours(10, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
}

function Triage({ onResult }) {
  const [symptoms, setSymptoms] = useState("");
  const [state, setState] = useState({ busy: false, error: "", result: null });

  const run = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: "", result: null });
    onResult(null);
    try {
      const { data } = await triageSymptoms(symptoms.trim());
      setState({ busy: false, error: "", result: data });
      onResult({ ...data, symptoms: symptoms.trim() });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err), result: null });
    }
  };

  const t = state.result;
  return (
    <div className="ui-card ui-stack">
      <h2>1. What's wrong?</h2>
      <form className="ui-stack" onSubmit={run}>
        <textarea className="ui-textarea" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="e.g. Itchy red patches on both elbows for 3 weeks, worse at night" maxLength={1500} minLength={3} required />
        <div className="ui-row">
          <button className="ui-btn ui-btn-primary" disabled={state.busy || symptoms.trim().length < 3}>{state.busy ? "Thinking…" : "Which doctor should I see?"}</button>
          <span className="ui-faint">or pick a specialty below</span>
        </div>
      </form>
      {state.error && <div className="ui-alert ui-alert-error">{state.error}</div>}
      {t && (
        <div className={`ui-alert ${URGENCY[t.urgency][0]}`}>
          <div className="ui-row" style={{ marginBottom: "0.3rem" }}>
            <strong style={{ margin: 0 }}>{SPECIALTIES[t.specialty]} · {URGENCY[t.urgency][1]}</strong>
            <div className="ui-spacer" />
            <SourceBadge source={t.aiSource} />
          </div>
          <p>{t.summary}</p>
          {t.urgency === "emergency" && (
            <div className="ui-row" style={{ marginTop: "0.5rem" }}>
              <a className="ui-btn ui-btn-danger ui-btn-sm" href="tel:112">Call 112</a>
              <a className="ui-btn ui-btn-danger ui-btn-sm" href="tel:108">Call 108</a>
            </div>
          )}
          {t.selfCare?.length > 0 && <><strong className="ui-small" style={{ marginTop: "0.5rem" }}>Meanwhile</strong><ul className="ui-bullets">{t.selfCare.map((x) => <li key={x}>{x}</li>)}</ul></>}
          {t.seeDoctorIf?.length > 0 && <><strong className="ui-small" style={{ marginTop: "0.5rem" }}>Go sooner if</strong><ul className="ui-bullets">{t.seeDoctorIf.map((x) => <li key={x}>{x}</li>)}</ul></>}
          {t.questionsForDoctor?.length > 0 && <><strong className="ui-small" style={{ marginTop: "0.5rem" }}>Questions to ask</strong><ul className="ui-bullets">{t.questionsForDoctor.map((x) => <li key={x}>{x}</li>)}</ul></>}
          <p className="ui-faint" style={{ marginTop: "0.5rem", color: "inherit", opacity: 0.75 }}>Triage guidance, not a diagnosis.</p>
        </div>
      )}
    </div>
  );
}

function ClinicFinder({ specialty, onSpecialty, onPick }) {
  const [state, setState] = useState({ loading: false, error: "", places: null, loc: null });
  const [radius, setRadius] = useState(5);

  const search = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    const loc = state.loc || (await getLocation());
    try {
      const { data } = await getNearbyPlaces({
        lat: loc.lat,
        lon: loc.lon,
        kinds: specialty === "dentistry" ? "dentist" : "hospital,clinic",
        radiusKm: radius,
        ...(specialty && specialty !== "general" && specialty !== "dentistry" ? { specialty } : {}),
      });
      setState({ loading: false, error: "", places: data.places, loc });
    } catch (err) {
      setState({ loading: false, error: errorMessage(err), places: null, loc });
    }
  }, [specialty, radius, state.loc]);

  useEffect(() => {
    if (specialty) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialty, radius]);

  return (
    <div className="ui-card ui-stack">
      <h2>2. Pick a clinic near you</h2>
      <div className="ui-row">
        <select className="ui-select" style={{ flex: 1, minWidth: 200 }} value={specialty} onChange={(e) => onSpecialty(e.target.value)} aria-label="Specialty">
          <option value="">Choose a specialty…</option>
          {Object.entries(SPECIALTIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="ui-select" style={{ width: "auto" }} value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Search radius">
          {[2, 5, 10, 15].map((r) => <option key={r} value={r}>within {r} km</option>)}
        </select>
      </div>
      {state.loc?.isDefault && <p className="ui-faint">Location is off, so this searches around central Bengaluru.</p>}
      {state.loading && <div className="ui-loading"><span className="ui-spinner" /> Searching OpenStreetMap…</div>}
      {state.error && (
        <div className="ui-alert ui-alert-warn ui-row">
          <span>{state.error}</span>
          <div className="ui-spacer" />
          <button className="ui-btn ui-btn-sm" onClick={search}>Try again</button>
        </div>
      )}
      {state.places && !state.loading && (
        state.places.length === 0 ? (
          <div className="ui-empty">Nothing found. Try a bigger radius, search in Maps, or add the clinic by hand below.</div>
        ) : (
          <ul className="ui-list" style={{ maxHeight: 420, overflowY: "auto" }}>
            {state.places.map((p) => (
              <li key={p.osmId}>
                <div className="ui-row">
                  <strong>{p.name}</strong>
                  <span className="ui-badge">{p.kind}</span>
                  {p.matchesSpecialty && <span className="ui-badge ui-badge-good">lists {SPECIALTIES[specialty]?.split(" (")[0]}</span>}
                  <div className="ui-spacer" />
                  <span className="ui-faint">{p.distanceKm} km</span>
                </div>
                <div className="ui-faint" style={{ marginTop: "0.2rem" }}>{[p.address, p.phone, p.openingHours].filter(Boolean).join(" · ") || "No address or phone listed"}</div>
                <div className="ui-row" style={{ marginTop: "0.4rem" }}>
                  <button className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => onPick(p)}>Choose</button>
                  <a className="ui-btn ui-btn-sm" href={p.mapsUrl} target="_blank" rel="noreferrer">Map</a>
                  {p.phone && <a className="ui-btn ui-btn-sm" href={`tel:${p.phone.replace(/\s/g, "")}`}>Call</a>}
                </div>
              </li>
            ))}
          </ul>
        )
      )}
      <div className="ui-row">
        <a className="ui-btn ui-btn-sm" href={mapsSearchUrl(SPECIALTIES[specialty] || "clinics", state.loc)} target="_blank" rel="noreferrer"><MapPin size={15} /> Search in Maps</a>
        <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => onPick({ name: "", address: "", phone: "", manual: true })}><Plus size={15} /> My clinic isn't listed</button>
      </div>
      <p className="ui-faint">Clinic data © OpenStreetMap contributors. Many clinics don't list their specialties, so clinics without a tag are shown too.</p>
    </div>
  );
}

function BookForm({ place, specialty, triage, onDone, onCancel }) {
  const [form, setForm] = useState({ name: place.name, address: place.address || "", phone: place.phone || "", startsAt: defaultSlot(), reason: triage?.symptoms || "" });
  const [state, setState] = useState({ busy: false, error: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: "" });
    try {
      const { data } = await createAppointment({
        place: { osmId: place.osmId, name: form.name, kind: place.kind, address: form.address, phone: form.phone, website: place.website || "", ...(place.lat != null && { lat: place.lat, lon: place.lon }) },
        specialty: specialty ? SPECIALTIES[specialty] : "",
        reason: form.reason,
        ...(triage && { triage: { specialty: triage.specialty, urgency: triage.urgency, summary: triage.summary } }),
        startsAt: new Date(form.startsAt).toISOString(),
      });
      onDone(data);
    } catch (err) {
      setState({ busy: false, error: errorMessage(err) });
    }
  };

  return (
    <form className="ui-card ui-stack" onSubmit={submit}>
      <h2>3. When?</h2>
      <div className="ui-form-grid">
        <label className="ui-field"><span>Clinic</span><input className="ui-input" value={form.name} onChange={set("name")} required minLength={2} maxLength={160} /></label>
        <label className="ui-field"><span>Date and time</span><input className="ui-input" type="datetime-local" value={form.startsAt} onChange={set("startsAt")} required /></label>
        <label className="ui-field"><span>Address</span><input className="ui-input" value={form.address} onChange={set("address")} maxLength={300} /></label>
        <label className="ui-field"><span>Phone</span><input className="ui-input" type="tel" value={form.phone} onChange={set("phone")} maxLength={40} /></label>
      </div>
      <label className="ui-field"><span>Reason for visit</span><textarea className="ui-textarea" value={form.reason} onChange={set("reason")} maxLength={600} /></label>
      <p className="ui-faint">PranexusAI doesn't book with the clinic. Call them to confirm the slot. After saving, you can download a calendar file; email is attempted when available.</p>
      {state.error && <div className="ui-alert ui-alert-error">{state.error}</div>}
      <div className="ui-row">
        <div className="ui-spacer" />
        <button type="button" className="ui-btn ui-btn-ghost" onClick={onCancel}>Back</button>
        <button className="ui-btn ui-btn-primary" disabled={state.busy}>{state.busy ? "Saving…" : "Save appointment"}</button>
      </div>
    </form>
  );
}

function CalendarDownload({ id }) {
  const [state, setState] = useState({ busy: false, message: "", ok: true });
  const download = async () => {
    setState({ busy: true, message: "", ok: true });
    try {
      await downloadAppointmentIcs(id);
      setState({ busy: false, message: "File downloaded. Import it into your calendar and check its alerts.", ok: true });
    } catch (err) {
      setState({ busy: false, message: errorMessage(err), ok: false });
    }
  };
  return (
    <span className="ui-row">
      <button className="ui-btn ui-btn-sm" onClick={download} disabled={state.busy}>{state.busy ? "Downloading…" : "Download calendar file"}</button>
      {state.message && <span className={state.ok ? "ui-faint" : ""} style={state.ok ? undefined : { color: "var(--ui-bad)" }} role={state.ok ? "status" : "alert"}>{state.message}</span>}
    </span>
  );
}

function AppointmentList({ refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const { data: appointments } = await getAppointments();
      setData(appointments);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const act = async (fn) => {
    try {
      await fn();
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!data) return error
    ? <div className="ui-alert ui-alert-error ui-row"><span>{error}</span><button className="ui-btn ui-btn-sm" onClick={load}>Try again</button></div>
    : <div className="ui-loading"><span className="ui-spinner" /> Loading appointments…</div>;

  const row = (a, upcoming) => (
    <li key={a._id}>
      <div className="ui-row">
        <strong>{a.place.name}</strong>
        {a.specialty && <span className="ui-faint">{a.specialty}</span>}
        <div className="ui-spacer" />
        <span className={`ui-badge ${a.status === "cancelled" ? "ui-badge-bad" : a.status === "completed" ? "ui-badge-good" : "ui-badge-info"}`}>{a.status}</span>
      </div>
      <div className="ui-small ui-muted" style={{ marginTop: "0.2rem" }}>
        {new Date(a.startsAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{a.place.address ? ` · ${a.place.address}` : ""}
      </div>
      {a.reason && <div className="ui-faint" style={{ marginTop: "0.2rem" }}>{a.reason}</div>}
      <div className="ui-row" style={{ marginTop: "0.5rem" }}>
        {upcoming && <CalendarDownload id={a._id} />}
        {a.place.phone && <a className="ui-btn ui-btn-sm" href={`tel:${a.place.phone.replace(/\s/g, "")}`}>Call clinic</a>}
        {a.place.lat != null && <a className="ui-btn ui-btn-sm" href={`https://www.google.com/maps/dir/?api=1&destination=${a.place.lat},${a.place.lon}`} target="_blank" rel="noreferrer">Directions</a>}
        <div className="ui-spacer" />
        {upcoming && <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => act(() => setAppointmentStatus(a._id, "completed"))}>Mark done</button>}
        {upcoming && <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => act(() => setAppointmentStatus(a._id, "cancelled"))}>Cancel</button>}
        {!upcoming && <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => act(() => deleteAppointment(a._id))}>Delete</button>}
      </div>
    </li>
  );

  return (
    <div className="ui-stack">
      {error && <div className="ui-alert ui-alert-error ui-row"><span>{error}</span><button className="ui-btn ui-btn-sm" onClick={load}>Try again</button></div>}
      <div className="ui-grid ui-grid-2" style={{ alignItems: "start" }}>
        <div className="ui-card">
          <h2>Upcoming ({data.upcoming.length})</h2>
          {data.upcoming.length ? <ul className="ui-list">{data.upcoming.map((a) => row(a, true))}</ul> : <div className="ui-empty">No upcoming visits.</div>}
        </div>
        <div className="ui-card">
          <h2>Past and cancelled</h2>
          {data.past.length ? <ul className="ui-list">{data.past.slice(0, 10).map((a) => row(a, false))}</ul> : <div className="ui-empty">Nothing yet.</div>}
        </div>
      </div>
    </div>
  );
}

export default function AppointmentBooking() {
  const [triage, setTriage] = useState(null);
  const [specialty, setSpecialty] = useState("");
  const [place, setPlace] = useState(null);
  const [saved, setSaved] = useState(null);
  const [version, setVersion] = useState(0);

  return (
    <div className="ui-stack" style={{ gap: "1rem" }}>
      {saved && (
        <div className="ui-alert ui-alert-info ui-row">
          <div>
            <strong>Saved: {saved.place.name}, {new Date(saved.startsAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</strong>{" "}
            {saved.confirmationEmailSent ? "A confirmation email was accepted for delivery. Check your inbox." : "Email was not available."} Remember to call the clinic to confirm. Calendar files include the clinic and time, not your reason for visiting.
          </div>
          <div className="ui-spacer" />
          <CalendarDownload id={saved._id} />
        </div>
      )}
      <div className="ui-grid ui-grid-2" style={{ alignItems: "start" }}>
        <Triage onResult={(t) => { setTriage(t); if (t) setSpecialty(t.specialty); setPlace(null); }} />
        {place ? (
          <BookForm
            key={place.osmId || "manual"}
            place={place}
            specialty={specialty}
            triage={triage}
            onCancel={() => setPlace(null)}
            onDone={(a) => { setSaved(a); setPlace(null); setVersion((v) => v + 1); }}
          />
        ) : (
          <ClinicFinder specialty={specialty} onSpecialty={setSpecialty} onPick={setPlace} />
        )}
      </div>
      <AppointmentList refreshKey={version} />
    </div>
  );
}
