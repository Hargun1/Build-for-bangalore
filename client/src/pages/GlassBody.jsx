import { useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/Shared/AppShell";
import GlassBodyViewer from "../components/GlassBody/GlassBodyViewer";
import GlassBodyViewerFemale from "../components/GlassBody/GlassBodyViewerFemale";
import { ORGAN_INFO, useOrganInsights } from "../components/GlassBody/organInsights";
import { useAuth } from "../context/AuthContext";
import "../components/GlassBody/GlassBody.css";

const ORGANS = {
  male: ["brain", "eyes", "heart", "lungs", "liver", "stomach", "digestive", "kidneyL"],
  female: ["brain", "eyes", "heart", "lungs", "liver", "stomach", "digestive", "kidneyL", "uterus", "ovaryL"],
};
// Same thresholds as the 3D materials, so the list and the model always agree.
const tone = (score) => (score == null ? "none" : score > 0.7 ? "bad" : score > 0.4 ? "warn" : "good");
const LEGEND = [
  ["good", "Healthy range"],
  ["warn", "Watch"],
  ["bad", "High risk"],
  ["none", "No data yet"],
];
const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function LabPill({ labs }) {
  if (!labs) return null;
  if (!labs.count) {
    return (
      <Link to="/labs" className="gb-pill gb-glass">
        <span aria-hidden="true">🧪</span> Add a blood test to colour organs with real lab results →
      </Link>
    );
  }
  const off = labs.outOfRange.length;
  return (
    <Link to="/labs" className={`gb-pill gb-glass ${off ? "gb-pill-warn" : ""}`}>
      <span className={`gb-dot gb-${off ? "bad" : "good"}`} />
      Lab report {fmt(labs.latestDate)} · {off ? `${off} result${off > 1 ? "s" : ""} out of range` : "all results in range"} →
    </Link>
  );
}

export default function GlassBody() {
  const { user } = useAuth();
  const [body, setBody] = useState(user?.gender === "female" ? "female" : "male");
  const [selected, setSelected] = useState(null);
  const insights = useOrganInsights();
  const scores = insights.riskScores || {};
  const Viewer = body === "male" ? GlassBodyViewer : GlassBodyViewerFemale;

  return (
    <AppShell
      title="Your body"
      subtitle="Organs are coloured by your own data: lab results, risk analysis, logs and air quality. Click one to see the numbers behind its colour."
      actions={
        <div className="ui-tabs" role="tablist" aria-label="Body model">
          {["male", "female"].map((b) => (
            <button key={b} role="tab" aria-selected={body === b} className={body === b ? "active" : ""} onClick={() => { setBody(b); setSelected(null); }}>
              {b === "male" ? "Male model" : "Female model"}
            </button>
          ))}
        </div>
      }
    >
      <div className={`gb-stage gb-stage-${body}`}>
        <Viewer insights={insights} selectedOrgan={selected} onSelectOrgan={setSelected} />

        <div className="gb-top">
          {!insights.loading && <LabPill labs={insights.labs} />}
        </div>

        <nav className="gb-organs gb-glass" aria-label="Organs">
          <div className="gb-eyebrow">Organs</div>
          {ORGANS[body].map((k) => (
            <button key={k} type="button" className={`gb-organ ${selected === k ? "active" : ""}`} aria-pressed={selected === k} onClick={() => setSelected(selected === k ? null : k)}>
              <span className={`gb-dot gb-${tone(scores[k])}`} />
              <span>{ORGAN_INFO[k].name}</span>
              {(insights.organs?.[k] || []).some((r) => r.lab) && <span className="gb-tag">LAB</span>}
            </button>
          ))}
        </nav>

        <div className="gb-legend gb-glass" aria-label="Colour legend">
          {LEGEND.map(([t, label]) => (
            <span key={t}><span className={`gb-dot gb-${t}`} /> {label}</span>
          ))}
        </div>

        <div className="gb-hint" aria-hidden="true">Drag to rotate · Scroll to zoom · Click an organ</div>
        {insights.loading && <div className="gb-loading gb-glass"><span className="ui-spinner" /> Loading your data…</div>}
      </div>

      {insights.labs?.other?.length > 0 && (
        <section className="ui-card gb-other">
          <div className="ui-row">
            <h2 className="ui-card-title" style={{ margin: 0 }}>Other blood results</h2>
            <div className="ui-spacer" />
            <Link to="/labs" className="ui-btn ui-btn-sm">All lab reports</Link>
          </div>
          <p className="ui-faint">Tests that aren't tied to one organ, from your latest reports.</p>
          <div className="gb-other-grid">
            {insights.labs.other.map((r) => (
              <div key={r.label} className={`gb-other-item gb-row-${r.level === "low" ? "good" : r.level === "high" ? "bad" : "warn"}`}>
                <div className="ui-faint">{r.label}</div>
                <strong>{r.value}</strong>
                {r.hint && <div className="ui-small ui-muted">{r.hint}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {!insights.loading && !insights.analysedAt && !insights.labs?.count && (
        <div className="ui-alert ui-alert-info" style={{ marginTop: "0.75rem" }}>
          The organs are blue because there's no data yet. <Link to="/labs">Add a lab report</Link> or run the risk analysis on your <Link to="/dashboard">dashboard</Link>.
        </div>
      )}
      <p className="ui-faint" style={{ marginTop: "0.6rem" }}>
        3D models from Sketchfab under CC BY 4.0 by adimed, 3DRT STUDIOS, DEGUIDER, ElliotSS, Ruslan Gadzhiev, Safiya and neshallads.{" "}
        <a href="https://github.com/Hargun1/Build-for-bangalore#data-and-credits" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>Full credits</a>
      </p>
    </AppShell>
  );
}
