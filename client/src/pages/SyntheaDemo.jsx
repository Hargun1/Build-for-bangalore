import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowLeft, HeartPulse, Search, Stethoscope, UsersRound } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AppShell from "../components/Shared/AppShell";
import { useAuth } from "../context/AuthContext";
import dataset from "../data/syntheaDemo.json";
import "./SyntheaDemo.css";

const date = (value) => value ? new Date(`${value}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "Not recorded";
const reading = (item) => item ? `${Number(item.value).toLocaleString("en-IN", { maximumFractionDigits: 1 })} ${item.unit}` : "Not recorded";

function RecordList({ items, empty, labelKey = "label", dayKey = "since" }) {
  if (!items.length) return <p className="synthea-empty">{empty}</p>;
  return <ul className="synthea-record-list">{items.map((item, index) => <li key={`${item[labelKey]}-${index}`}><span>{item[labelKey]}</span><time>{date(item[dayKey])}</time></li>)}</ul>;
}

function Overview({ profile }) {
  const bp = profile.vitals.bloodPressure[0];
  return <div className="synthea-sections">
    <section aria-labelledby="synthea-vitals-title">
      <div className="synthea-section-head"><h3 id="synthea-vitals-title">Latest recorded measurements</h3><span>From dated encounters</span></div>
      <div className="synthea-measurements">
        <div><HeartPulse aria-hidden="true" /><span>Blood pressure</span><strong>{bp ? `${bp.systolic}/${bp.diastolic}` : "Not recorded"}</strong><small>{bp ? `mmHg | ${date(bp.day)}` : ""}</small></div>
        <div><Activity aria-hidden="true" /><span>Pulse</span><strong>{reading(profile.vitals.pulse)}</strong><small>{profile.vitals.pulse && date(profile.vitals.pulse.day)}</small></div>
        <div><span className="synthea-measure-symbol" aria-hidden="true">kg</span><span>Weight</span><strong>{reading(profile.vitals.weight)}</strong><small>{profile.vitals.weight && date(profile.vitals.weight.day)}</small></div>
        <div><span className="synthea-measure-symbol" aria-hidden="true">%</span><span>Oxygen saturation</span><strong>{reading(profile.vitals.oxygenSaturation)}</strong><small>{profile.vitals.oxygenSaturation && date(profile.vitals.oxygenSaturation.day)}</small></div>
      </div>
    </section>
    <section aria-labelledby="synthea-labs-title">
      <div className="synthea-section-head"><h3 id="synthea-labs-title">Lab observations</h3><span>Source values only; no interpretation</span></div>
      <div className="synthea-table-wrap"><table className="synthea-table"><thead><tr><th scope="col">Test</th><th scope="col">Value</th><th scope="col">Recorded</th></tr></thead><tbody>{profile.labs.map((lab) => <tr key={lab.code}><td>{lab.label}</td><td>{reading(lab)}</td><td>{date(lab.day)}</td></tr>)}</tbody></table></div>
    </section>
    <div className="synthea-history-grid">
      <section aria-labelledby="synthea-conditions-title"><div className="synthea-section-head"><h3 id="synthea-conditions-title">Recorded disorders</h3></div><RecordList items={profile.conditions} dayKey="day" empty="No disorder recorded in this extract." /></section>
      <section aria-labelledby="synthea-meds-title"><div className="synthea-section-head"><h3 id="synthea-meds-title">Open prescription records</h3></div><RecordList items={profile.medications} empty="No open prescription recorded in this extract." /></section>
      <section aria-labelledby="synthea-allergies-title"><div className="synthea-section-head"><h3 id="synthea-allergies-title">Allergy records</h3></div><RecordList items={profile.allergies} empty="No allergy recorded in this extract." /></section>
    </div>
  </div>;
}

function Measurements({ profile }) {
  const bp = [...profile.vitals.bloodPressure].reverse().map((row) => ({ ...row, label: row.day.slice(0, 7) }));
  return <div className="synthea-sections">
    <section aria-labelledby="synthea-bp-title"><div className="synthea-section-head"><h3 id="synthea-bp-title">Blood pressure over visits</h3><span>Up to six recorded pairs</span></div><div className="synthea-chart" role="img" aria-label={`Historical systolic and diastolic blood pressure for ${profile.id}`}><ResponsiveContainer width="100%" height="100%"><LineChart data={bp} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e4eaef" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#657485", fontSize: 11 }} /><YAxis domain={["dataMin - 10", "dataMax + 10"]} tickLine={false} axisLine={false} tick={{ fill: "#657485", fontSize: 11 }} width={42} /><Tooltip formatter={(value, name) => [`${value} mmHg`, name === "systolic" ? "Systolic" : "Diastolic"]} labelFormatter={(label, rows) => date(rows?.[0]?.payload?.day) || label} contentStyle={{ borderRadius: 6, border: "1px solid #dce4e9", fontSize: 12 }} /><Line type="monotone" dataKey="systolic" stroke="#3469aa" strokeWidth={2} dot={{ r: 3 }} /><Line type="monotone" dataKey="diastolic" stroke="#278a79" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div><div className="synthea-legend"><span><i className="sys" />Systolic</span><span><i className="dia" />Diastolic</span></div></section>
    <section aria-labelledby="synthea-bp-history-title"><div className="synthea-section-head"><h3 id="synthea-bp-history-title">Recorded readings</h3></div><div className="synthea-table-wrap"><table className="synthea-table"><thead><tr><th scope="col">Date</th><th scope="col">Systolic</th><th scope="col">Diastolic</th></tr></thead><tbody>{profile.vitals.bloodPressure.map((row, index) => <tr key={`${row.day}-${index}`}><td>{date(row.day)}</td><td>{row.systolic} mmHg</td><td>{row.diastolic} mmHg</td></tr>)}</tbody></table></div></section>
  </div>;
}

function Visits({ profile }) {
  return <section className="synthea-sections" aria-labelledby="synthea-visits-title"><div className="synthea-section-head"><h3 id="synthea-visits-title">Encounter history</h3><span>Most recent eight records</span></div><ol className="synthea-visits">{profile.visits.map((visit, index) => <li key={`${visit.day}-${index}`}><span className="synthea-visit-date">{date(visit.day)}</span><div><strong>{visit.reason}</strong><small>{visit.type || "Visit"}</small></div></li>)}</ol></section>;
}

function DemoContent() {
  const [selectedId, setSelectedId] = useState(dataset.profiles[0].id);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("overview");
  const tabs = [["overview", "Overview"], ["measurements", "Measurements"], ["visits", "Visits"]];
  const selected = dataset.profiles.find((profile) => profile.id === selectedId) || dataset.profiles[0];
  const visible = useMemo(() => dataset.profiles.filter((profile) => profile.id.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const choose = (id) => { setSelectedId(id); setTab("overview"); };
  const onTabKeyDown = (event) => {
    const index = tabs.findIndex(([key]) => key === tab);
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : null;
    if (next === null) return;
    event.preventDefault();
    setTab(tabs[next][0]);
    event.currentTarget.parentElement.children[next].focus();
  };
  return <div className="synthea-demo">
    <div className="synthea-notice" role="note"><strong>Synthetic patient records</strong><span>These people are fictional. Measurements and visits are linked within each sample record, but they are not your data and must not be used for care decisions.</span></div>
    <div className="synthea-layout"><aside className="synthea-list" aria-label="Sample patients"><div className="synthea-list-head"><strong>Sample patients</strong><span>{dataset.profiles.length}</span></div><label className="synthea-search"><Search aria-hidden="true" size={16} /><input type="search" aria-label="Find a sample patient" placeholder="Find sample" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="synthea-people">{visible.map((profile) => <button type="button" key={profile.id} className={profile.id === selectedId ? "selected" : ""} aria-pressed={profile.id === selectedId} onClick={() => choose(profile.id)}><span className="synthea-person-mark">{profile.id.slice(-2)}</span><span><strong>{profile.id}</strong><small>{profile.sex} | age {profile.ageAtLastVisit} at last visit</small></span></button>)}{!visible.length && <p className="synthea-empty">No sample patients found.</p>}</div></aside>
      <div className="synthea-detail"><div className="synthea-heading"><div><span className="synthea-eyebrow">SYNTHETIC CLINICAL RECORD</span><h2>{selected.id}</h2><p>{selected.sex} | age {selected.ageAtLastVisit} at last visit | last record {date(selected.lastVisitDay)}</p></div><span className="synthea-badge">Fictional</span></div><div className="synthea-tabs" role="tablist" aria-label="Patient record views">{tabs.map(([key, label]) => <button type="button" role="tab" id={`synthea-tab-${key}`} aria-controls="synthea-panel" key={key} aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)} onKeyDown={onTabKeyDown}>{label}</button>)}</div><div role="tabpanel" id="synthea-panel" aria-labelledby={`synthea-tab-${tab}`} tabIndex={0}>{tab === "overview" && <Overview profile={selected} />}{tab === "measurements" && <Measurements profile={selected} />}{tab === "visits" && <Visits profile={selected} />}</div><p className="synthea-credit">Source: <a href="https://synthetichealth.github.io/downloads.html" target="_blank" rel="noreferrer">MITRE Synthea sample CSV</a>. No source names, addresses, or identifiers are included. This dataset has no daily steps, food log, emergency contacts, or live environment data. <Link to="/demo/fitbit">Explore separate real Fitbit activity data</Link>.</p></div>
    </div>
  </div>;
}

export default function SyntheaDemo() {
  const { user } = useAuth();
  if (user) return <AppShell title="Sample patients" subtitle="Explore fictional, linked clinical records for app demonstrations."><DemoContent /></AppShell>;
  return <div className="ui-page synthea-public"><header><Link to="/login" className="synthea-brand"><Stethoscope aria-hidden="true" />PranexusAI</Link><nav><Link to="/demo/fitbit" className="ui-btn"><UsersRound size={16} /> Activity demo</Link><Link to="/login" className="ui-btn"><ArrowLeft size={16} /> Sign in</Link></nav></header><main><div className="ui-header"><div><h1>Sample patients</h1><p>Explore fictional, linked clinical records for app demonstrations.</p></div></div><DemoContent /></main></div>;
}
