import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowLeft, Footprints, Route, Search } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AppShell from "../components/Shared/AppShell";
import { useAuth } from "../context/AuthContext";
import dataset from "../data/fitbitDemo.json";
import { participantSummary } from "../utils/fitbitDemo";
import "./FitbitDemo.css";

const profiles = dataset.profiles.map((profile) => ({ ...profile, summary: participantSummary(profile) }));
const integer = (value) => value == null ? "-" : value.toLocaleString("en-IN");
const date = (value) => value ? new Date(`${value}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "-";

function DemoContent() {
  const [selectedId, setSelectedId] = useState(profiles[0].id);
  const [query, setQuery] = useState("");
  const [metric, setMetric] = useState("steps");
  const selected = profiles.find((profile) => profile.id === selectedId) || profiles[0];
  const { summary } = selected;
  const visible = useMemo(() => profiles.filter((profile) => profile.id.toLowerCase().includes(query.trim().toLowerCase())), [query]);

  return <div className="fitbit-demo">
    <div className="fitbit-demo-notice" role="note">
      <strong>Historical research data, not your health record.</strong>
      <span>These are anonymous Fitbit activity profiles from March-April 2016. No live sync, account details, or medical conclusions are included.</span>
    </div>
    <div className="fitbit-demo-layout">
      <aside className="fitbit-demo-list" aria-label="Demo profiles">
        <div className="fitbit-demo-list-head"><strong>Activity profiles</strong><span>{profiles.length}</span></div>
        <label className="fitbit-demo-search"><Search aria-hidden="true" size={16} /><input type="search" aria-label="Find a profile" placeholder="Find profile" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="fitbit-demo-people">
          {visible.map((profile) => <button type="button" key={profile.id} className={profile.id === selectedId ? "selected" : ""} onClick={() => setSelectedId(profile.id)} aria-pressed={profile.id === selectedId}>
            <span className="fitbit-demo-person-mark">{profile.id.slice(-2)}</span>
            <span><strong>{profile.id}</strong><small>{profile.summary.days} recorded days</small></span>
            <span className="fitbit-demo-person-steps">{integer(profile.summary.averageSteps)}<small>avg steps</small></span>
          </button>)}
          {!visible.length && <p className="ui-faint">No profiles found.</p>}
        </div>
      </aside>
      <div className="fitbit-demo-detail">
        <div className="fitbit-demo-heading"><div><span className="fitbit-demo-eyebrow">FITBIT ACTIVITY RECORD</span><h2>{selected.id}</h2><p>{date(summary.firstDay)} to {date(summary.lastDay)} | {summary.days} recorded days</p></div><span className="fitbit-demo-source">Archived sample</span></div>
        <div className="fitbit-demo-stats">
          <div><Footprints aria-hidden="true" /><span>Average steps / day</span><strong>{integer(summary.averageSteps)}</strong></div>
          <div><Route aria-hidden="true" /><span>Average distance / day</span><strong>{summary.averageDistanceKm?.toFixed(1)} <small>km</small></strong></div>
          <div><Activity aria-hidden="true" /><span>Active minutes / day</span><strong>{integer(summary.averageActiveMinutes)}</strong></div>
        </div>
        <section className="fitbit-demo-section" aria-labelledby="fitbit-demo-trend-title">
          <div className="fitbit-demo-section-head"><div><h3 id="fitbit-demo-trend-title">Daily activity</h3><p>Recorded days only; gaps are not filled in.</p></div><div className="fitbit-demo-segment" role="group" aria-label="Chart metric"><button type="button" className={metric === "steps" ? "active" : ""} aria-pressed={metric === "steps"} onClick={() => setMetric("steps")}>Steps</button><button type="button" className={metric === "distanceKm" ? "active" : ""} aria-pressed={metric === "distanceKm"} onClick={() => setMetric("distanceKm")}>Distance</button></div></div>
          <div className="fitbit-demo-chart" role="img" aria-label={`${metric === "steps" ? "Daily steps" : "Daily distance"} chart for ${selected.id}`}>
            <ResponsiveContainer width="100%" height="100%"><BarChart data={summary.chart} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e5ebef" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#657485", fontSize: 11 }} interval="preserveStartEnd" /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#657485", fontSize: 11 }} width={46} tickFormatter={(v) => metric === "steps" ? `${Math.round(v / 1000)}k` : v} /><Tooltip formatter={(value) => [metric === "steps" ? `${integer(value)} steps` : `${Number(value).toFixed(2)} km`, ""]} labelFormatter={(label, rows) => date(rows?.[0]?.payload?.day) || label} contentStyle={{ borderRadius: 6, border: "1px solid #dce4e9", fontSize: 12 }} /><Bar dataKey={metric} fill={metric === "steps" ? "#278a79" : "#3469aa"} radius={[3, 3, 0, 0]} maxBarSize={24} /></BarChart></ResponsiveContainer>
          </div>
        </section>
        <section className="fitbit-demo-section" aria-labelledby="fitbit-demo-log-title">
          <div className="fitbit-demo-section-head"><div><h3 id="fitbit-demo-log-title">Recorded days</h3><p>Distance is the tracker’s reported value, not calculated from steps.</p></div><span className="ui-faint">{summary.days} entries</span></div>
          <div className="fitbit-demo-table-wrap"><table className="fitbit-demo-table"><thead><tr><th scope="col">Date</th><th scope="col">Steps</th><th scope="col">Distance</th><th scope="col">Active time</th></tr></thead><tbody>{[...selected.days].sort((a, b) => b.day.localeCompare(a.day)).map((row) => <tr key={row.day}><td>{date(row.day)}</td><td>{integer(row.steps)}</td><td>{row.distanceKm.toFixed(2)} km</td><td>{integer(row.activeMinutes)} min</td></tr>)}</tbody></table></div>
        </section>
        <p className="fitbit-demo-credit">Source: <a href="https://zenodo.org/records/53894" target="_blank" rel="noreferrer">Furberg et al., Crowd-sourced Fitbit datasets (2016)</a>. The archive contains 35 activity IDs from a study reporting 30 consenting users; profiles here do not necessarily represent 35 distinct people. Data is presented for demonstration only. <Link to="/demo/patients">Explore separate synthetic clinical records</Link>.</p>
      </div>
    </div>
  </div>;
}

export default function FitbitDemo() {
  const { user } = useAuth();
  if (user) return <AppShell title="Activity demo" subtitle="Explore real, historical Fitbit activity from anonymous profiles."><DemoContent /></AppShell>;
  return <div className="ui-page fitbit-demo-public"><header><Link to="/login" className="fitbit-demo-brand"><Activity aria-hidden="true" />PranexusAI</Link><Link to="/login" className="ui-btn"><ArrowLeft size={16} /> Sign in</Link></header><main><div className="ui-header"><div><h1>Activity demo</h1><p>Explore real, historical Fitbit activity from anonymous profiles.</p></div></div><DemoContent /></main></div>;
}
