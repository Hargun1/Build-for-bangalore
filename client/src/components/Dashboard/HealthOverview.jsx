import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ChartNoAxesCombined, Droplets, Footprints, HeartPulse, Moon, Plus, UserRound, Utensils } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../../context/AuthContext";
import { errorMessage } from "../../services/api";
import { analyzeHealth, getMetrics, getPredictions, getToday } from "../../services/healthService";
import { CHART, axisProps, compactNumber, levelBadge, shortDay, tooltipStyle } from "../../utils/chartTheme";
import SourceBadge from "../Shared/SourceBadge";
import LogMetricsModal from "./LogMetricsModal";
import "../../styles/ui.css";

const fmt = (v, digits = 0) => (v == null ? "–" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: digits }));

function Tile({ label, value, unit, sub, icon: Icon, tone }) {
  return (
    <div className={`ui-stat overview-metric ${tone}`}>
      <div className="ui-stat-label">{Icon && <span className="metric-icon"><Icon /></span>}{label}</div>
      <div className="ui-stat-value">
        {value}
        {unit && value !== "–" && <small>{unit}</small>}
      </div>
      {sub && <div className="ui-stat-sub">{sub}</div>}
    </div>
  );
}

function RiskCard({ score, onLog }) {
  const [open, setOpen] = useState(false);
  const known = score.level !== "unknown";
  return (
    <div className="ui-card" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div className="ui-row">
        <strong style={{ fontSize: "0.95rem" }}>{score.label}</strong>
        <div className="ui-spacer" />
        <span className={`ui-badge ${levelBadge(score.level)}`}>{known ? `${score.level} risk` : "needs data"}</span>
      </div>
      <div className="ui-stat-value" style={{ marginTop: 0 }}>
        {score.value != null && known ? fmt(score.value, 1) : "–"}
        {known && score.unit && <small>{score.unit}</small>}
      </div>
      {known && score.percent != null && (
        <div className="ui-progress" aria-hidden="true">
          <span style={{ width: `${Math.max(4, score.percent)}%` }} />
        </div>
      )}
      {score.note && <p className="ui-faint">{score.note}</p>}
      {score.missing?.length > 0 && (
        <p className="ui-small ui-muted">
          Needs: {score.missing.join(", ")}.{" "}
          {score.missing.some((m) => /log|reading/.test(m)) ? (
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" style={{ padding: 0, textDecoration: "underline" }} onClick={onLog}>Log it</button>
          ) : (
            <Link to="/profile" style={{ textDecoration: "underline" }}>Add to profile</Link>
          )}
        </p>
      )}
      <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" style={{ alignSelf: "flex-start", paddingLeft: 0 }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "Hide method" : "How is this calculated?"}
      </button>
      {open && (
        <div className="ui-small ui-muted" style={{ lineHeight: 1.5 }}>
          <div>{score.method}</div>
          {score.factors?.length > 0 && (
            <ul className="ui-bullets" style={{ marginTop: "0.4rem" }}>
              {score.factors.map((f) => (
                <li key={f.name}>
                  {f.name}: {f.detail}
                  {f.points != null && f.name !== "Heart age" ? ` (${f.points} pts)` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function MiniTrend({ title, data, dataKey, unit, kind = "line", color }) {
  const points = data.filter((d) => d[dataKey] != null);
  if (points.length < 2) return null;
  return (
    <div className="ui-card">
      <div className="ui-card-title">
        <h3>{title}</h3>
        <span className="ui-faint">last 14 days</span>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        {kind === "bar" ? (
          <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
            <YAxis {...axisProps} width={48} tickFormatter={compactNumber} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "#315fb510" }} formatter={(v) => [`${fmt(v)} ${unit}`, title]} />
            <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
            <YAxis {...axisProps} width={48} domain={["auto", "auto"]} />
            <Tooltip {...tooltipStyle} formatter={(v) => [`${fmt(v, 1)} ${unit}`, title]} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color, strokeWidth: 0 }} connectNulls />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export default function HealthOverview() {
  const { user } = useAuth();
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [logOpen, setLogOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, m, p] = await Promise.all([getToday(), getMetrics(14), getPredictions(1)]);
      setToday(t.data);
      setHistory(m.data);
      setPrediction(p.data[0] || null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError("");
    try {
      const { data } = await analyzeHealth();
      setPrediction(data);
    } catch (err) {
      setError(errorMessage(err, "Analysis failed"));
    } finally {
      setAnalyzing(false);
    }
  };

  // Oldest -> newest for charts, one point per logged day.
  const series = useMemo(() => [...history].reverse().map((r) => ({ ...r, label: shortDay(r.day) })), [history]);

  const p = user?.profile || {};
  const missingProfile = [
    !user?.dob && "date of birth",
    !p.heightCm && "height",
    !p.weightKg && "weight",
    !p.waistCm && "waist",
    !p.activityLevel && "activity level",
    !p.familyHistoryDiabetes && "family history",
    p.smoker == null && "smoking status",
  ].filter(Boolean);

  const m = today?.metrics || {};
  const avg = today?.averages || {};

  if (loading) return <div className="ui-loading"><span className="ui-spinner" /> Loading your health data…</div>;

  return (
    <div className="ui-stack health-overview" style={{ gap: "1.5rem" }}>
      {error && <div className="ui-alert ui-alert-error" role="alert">{error}</div>}

      {missingProfile.length > 0 && (
        <div className="overview-setup">
          <UserRound />
          <div>
            <strong>Your health profile is incomplete</strong>
            <p>{missingProfile.length} details needed for your screening estimates.</p>
          </div>
          <div className="ui-spacer" />
          <Link to="/profile" className="ui-btn ui-btn-sm">Complete profile</Link>
        </div>
      )}

      <section className="overview-today">
        <div className="ui-card-title">
          <div><h2 style={{ fontSize: "1.1rem" }}>Your daily snapshot</h2><span className="ui-faint">Today & your 7-day averages</span></div>
          <button className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => setLogOpen(true)}><Plus /> Log today</button>
        </div>
        <div className="ui-grid overview-metrics">
          <Tile label="Steps" icon={Footprints} tone="mint" value={fmt(m.steps)} sub={`7-day avg ${fmt(avg.steps)}`} />
          <Tile label="Sleep" icon={Moon} tone="lilac" value={fmt(m.sleepHours, 1)} unit="h" sub={`7-day avg ${fmt(avg.sleepHours, 1)} h`} />
          <Tile label="Resting heart rate" icon={HeartPulse} tone="rose" value={fmt(m.restingHeartRate)} unit="bpm" sub={m.source === "bluetooth" ? "from Bluetooth monitor" : `7-day avg ${fmt(avg.restingHeartRate)}`} />
          <Tile label="Blood pressure" icon={Activity} tone="blue" value={m.systolic ? `${m.systolic}/${m.diastolic ?? "?"}` : "–"} unit="mmHg" sub={avg.systolic ? `7-day avg ${fmt(avg.systolic)}/${fmt(avg.diastolic)}` : "Not logged this week"} />
          <Tile label="Food logged" icon={Utensils} tone="peach" value={fmt(today?.caloriesEaten)} unit="kcal" sub={<Link to="/grocery?tab=log" style={{ textDecoration: "underline" }}>{today?.meals ? `${today.meals} meal(s) logged` : "View food diary"}</Link>} />
          <Tile label="Water" icon={Droplets} tone="aqua" value={fmt(m.waterLitres, 1)} unit="L" sub={`7-day avg ${fmt(avg.waterLitres, 1)} L`} />
        </div>
        {!today?.metrics && <p className="ui-faint" style={{ marginTop: "0.6rem" }}>Nothing logged today yet. Log a few numbers, or connect a heart-rate monitor on the Vitals page.</p>}
      </section>

      <section className="ui-card">
        <div className="ui-card-title">
          <div>
            <h2 style={{ fontSize: "1.2rem", marginBottom: "0.2rem" }}>Risk assessment</h2>
            <span className="ui-faint">
              {prediction ? `Last run ${new Date(prediction.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : "Not run yet"}
              {" · "}screening estimates, not a diagnosis
            </span>
          </div>
          <button className="ui-btn ui-btn-primary" onClick={runAnalysis} disabled={analyzing}>
            {analyzing ? "Analysing…" : prediction ? "Re-run analysis" : "Run analysis"}
          </button>
        </div>

        {!prediction ? (
          <div className="ui-empty">
            <strong>See your diabetes and heart risk</strong>
            Uses the Indian Diabetes Risk Score and the Framingham heart model with your profile and the last 14 days of logs.
          </div>
        ) : (
          <div className="ui-stack" style={{ gap: "1rem" }}>
            <div className="ui-row" style={{ alignItems: "flex-start", gap: "1.25rem" }}>
              {prediction.wellnessScore != null && (
                <div className="ui-stat" style={{ minWidth: 150 }}>
                  <div className="ui-stat-label">Overall</div>
                  <div className="ui-stat-value">{prediction.wellnessScore}<small>/100</small></div>
                  <div className="ui-stat-sub">App summary of known scores</div>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 240 }}>
                <div className="ui-row" style={{ marginBottom: "0.4rem" }}>
                  <strong>Summary</strong>
                  <SourceBadge source={prediction.aiSource} />
                </div>
                <p style={{ lineHeight: 1.6 }}>{prediction.summary}</p>
              </div>
            </div>
            <div className="ui-grid ui-grid-3">
              {prediction.scores.map((s) => (
                <RiskCard key={s.key} score={s} onLog={() => setLogOpen(true)} />
              ))}
            </div>
            {prediction.recommendations?.length > 0 && (
              <div>
                <h3 style={{ fontSize: "1rem", marginBottom: "0.6rem" }}>What to do next</h3>
                <ul className="ui-list">
                  {prediction.recommendations.map((r, i) => (
                    <li key={i} style={{ borderLeft: `3px solid ${r.priority === "high" ? CHART.status.bad : r.priority === "medium" ? CHART.status.warn : CHART.status.good}` }}>
                      <div className="ui-row">
                        <strong>{r.title}</strong>
                        <span className="ui-badge">{r.priority} priority</span>
                      </div>
                      <p className="ui-muted ui-small" style={{ marginTop: "0.3rem", lineHeight: 1.5 }}>{r.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {series.length >= 2 ? (
        <section className="ui-grid ui-grid-2">
          <MiniTrend title="Steps" data={series} dataKey="steps" unit="steps" kind="bar" color={CHART.series[0]} />
          <MiniTrend title="Sleep" data={series} dataKey="sleepHours" unit="h" color={CHART.series[1]} />
          <MiniTrend title="Systolic blood pressure" data={series} dataKey="systolic" unit="mmHg" color={CHART.series[2]} />
          <MiniTrend title="Weight" data={series} dataKey="weightKg" unit="kg" color={CHART.series[3]} />
        </section>
      ) : (
        <div className="overview-empty-trends"><ChartNoAxesCombined /><div><strong>Your patterns, over time</strong><p>Trends will appear after two days of health logs.</p></div></div>
      )}

      {logOpen && <LogMetricsModal open onClose={() => setLogOpen(false)} initial={today?.metrics} onSaved={load} />}
    </div>
  );
}
