import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AppShell from "../components/Shared/AppShell";
import SourceBadge from "../components/Shared/SourceBadge";
import { errorMessage } from "../services/api";
import { checkinGoal, createGoal, deleteGoal, getGoals, planGoal, setGoalStatus } from "../services/healthService";
import { CHART, axisProps, compactNumber, shortDay, tooltipStyle } from "../utils/chartTheme";

const METRIC_LABEL = {
  steps: "daily steps",
  sleepHours: "hours of sleep",
  weightKg: "body weight",
  systolic: "systolic BP",
  waterLitres: "litres of water",
  restingHeartRate: "resting heart rate",
  habit: "daily habits",
};
const IDEAS = ["Walk 8,000 steps a day", "Sleep 7.5 hours on weeknights", "Lose 4 kg in 8 weeks", "Bring my BP under 130", "Drink 2.5 L of water daily"];

function targetText(g) {
  if (g.metric === "habit") return `${g.habits.length} daily habit${g.habits.length === 1 ? "" : "s"}`;
  if (g.direction === "reach") return `${g.startValue} → ${g.targetValue} ${g.unit}`;
  return `${g.direction === "atMost" ? "≤" : "≥"} ${g.dailyTarget?.toLocaleString("en-IN")} ${g.unit} a day`;
}

function PlanEditor({ preview, onCancel, onSaved }) {
  const [plan, setPlan] = useState(preview.plan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setPlan((p) => ({ ...p, [k]: e.target.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value }));

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const { weeks, ...rest } = plan;
      await createGoal({ ...rest, weeks, planSource: preview.planSource });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="ui-card ui-stack">
      <div className="ui-row">
        <h2 style={{ margin: 0 }}>Your plan</h2>
        <SourceBadge source={preview.planSource} />
      </div>
      {preview.safetyNotes?.map((n) => <div key={n} className="ui-alert ui-alert-warn">{n}</div>)}
      <div className="ui-form-grid">
        <label className="ui-field" style={{ gridColumn: "1 / -1" }}><span>Title</span><input className="ui-input" value={plan.title} onChange={set("title")} maxLength={120} /></label>
        <label className="ui-field"><span>Tracked by</span><input className="ui-input" value={METRIC_LABEL[plan.metric]} readOnly /></label>
        {plan.metric !== "habit" && plan.direction !== "reach" && (
          <label className="ui-field"><span>Daily target ({plan.unit})</span><input className="ui-input" type="number" value={plan.dailyTarget ?? ""} onChange={set("dailyTarget")} /></label>
        )}
        {plan.direction === "reach" && (
          <>
            <label className="ui-field"><span>Start ({plan.unit})</span><input className="ui-input" type="number" step="0.1" value={plan.startValue ?? ""} onChange={set("startValue")} /></label>
            <label className="ui-field"><span>Target ({plan.unit})</span><input className="ui-input" type="number" step="0.1" value={plan.targetValue ?? ""} onChange={set("targetValue")} /></label>
          </>
        )}
        <label className="ui-field"><span>Weeks</span><input className="ui-input" type="number" min="1" max="26" value={plan.weeks} onChange={set("weeks")} /></label>
      </div>
      {plan.description && <p className="ui-muted ui-small">{plan.description}</p>}
      {plan.habits.length > 0 && (
        <div>
          <strong className="ui-small">Daily habits</strong>
          <ul className="ui-bullets" style={{ marginTop: "0.3rem" }}>{plan.habits.map((h) => <li key={h.title}>{h.title}{h.timeOfDay && h.timeOfDay !== "any" ? ` (${h.timeOfDay})` : ""}</li>)}</ul>
        </div>
      )}
      {plan.milestones.length > 0 && (
        <div>
          <strong className="ui-small">Weekly milestones</strong>
          <ul className="ui-bullets" style={{ marginTop: "0.3rem" }}>{plan.milestones.map((m) => <li key={m.week}>Week {m.week}: {m.title}{m.target ? ` (${m.target})` : ""}</li>)}</ul>
        </div>
      )}
      {error && <div className="ui-alert ui-alert-error">{error}</div>}
      <div className="ui-row">
        <div className="ui-spacer" />
        <button className="ui-btn ui-btn-ghost" onClick={onCancel}>Discard</button>
        <button className="ui-btn ui-btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Start this goal"}</button>
      </div>
    </div>
  );
}

function GoalCard({ goal, onChange }) {
  const pr = goal.progress;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const week = Math.max(1, Math.min(Math.floor((pr.elapsedDays - 1) / 7) + 1, Math.ceil(pr.totalDays / 7)));

  const act = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await onChange();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleHabit = (id) => {
    const done = pr.todayHabits.includes(id) ? pr.todayHabits.filter((h) => h !== id) : [...pr.todayHabits, id];
    act(() => checkinGoal(goal._id, done));
  };

  const chartData = pr.series.map((p) => ({ ...p, label: shortDay(p.day) }));

  return (
    <div className="ui-card ui-stack">
      <div className="ui-row" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0 }}>{goal.title}</h3>
          <div className="ui-faint">{targetText(goal)} · {goal.category}</div>
        </div>
        <span className={`ui-badge ${goal.status === "completed" ? "ui-badge-good" : "ui-badge-info"}`}>{goal.status === "completed" ? "Completed" : `Week ${week}`}</span>
      </div>

      <div>
        <div className="ui-row ui-small" style={{ marginBottom: "0.35rem" }}>
          <span>{pr.percent}% complete</span>
          <div className="ui-spacer" />
          <span className="ui-faint">
            {goal.metric === "habit" ? "" : goal.direction === "reach" ? `Latest ${pr.latestValue ?? "–"} ${goal.unit}` : `${pr.daysMet} of ${pr.totalDays} days on target`}
            {" · "}{pr.daysLeft} days left
          </span>
        </div>
        <div className="ui-progress" role="progressbar" aria-valuenow={pr.percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.max(2, pr.percent)}%` }} /></div>
      </div>

      {goal.metric !== "habit" && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
            <YAxis {...axisProps} width={46} tickFormatter={compactNumber} domain={goal.direction === "reach" ? ["auto", "auto"] : [0, (max) => Math.max(max, goal.dailyTarget || 0) * 1.1]} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v) => [`${v} ${goal.unit}`, METRIC_LABEL[goal.metric]]} />
            {goal.dailyTarget != null && goal.direction !== "reach" && <ReferenceLine y={goal.dailyTarget} stroke={CHART.text} strokeDasharray="4 4" label={{ value: "target", fill: CHART.text, fontSize: 10, position: "insideTopRight" }} />}
            {goal.direction === "reach" && goal.targetValue != null && <ReferenceLine y={goal.targetValue} stroke={CHART.text} strokeDasharray="4 4" label={{ value: "target", fill: CHART.text, fontSize: 10, position: "insideTopRight" }} />}
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={18}>
              {chartData.map((d) => <Cell key={d.day} fill={d.met === false ? CHART.axis : CHART.series[0]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      {goal.metric !== "habit" && chartData.length === 0 && (
        <p className="ui-faint">No {METRIC_LABEL[goal.metric]} logged since this goal started. Log it on the dashboard or connect a device on the Vitals page.</p>
      )}

      {goal.habits.length > 0 && goal.status === "active" && (
        <div>
          <div className="ui-row ui-small" style={{ marginBottom: "0.35rem" }}>
            <strong>Today</strong>
            {pr.streak > 0 && <span className="ui-badge ui-badge-good">{pr.streak}-day streak</span>}
            {pr.habitPercent != null && <span className="ui-faint">{pr.habitPercent}% of habits done overall</span>}
          </div>
          <div className="ui-stack" style={{ gap: "0.4rem" }}>
            {goal.habits.map((h) => (
              <label key={h.id} className="ui-check">
                <input type="checkbox" checked={pr.todayHabits.includes(h.id)} disabled={busy} onChange={() => toggleHabit(h.id)} />
                {h.title}
              </label>
            ))}
          </div>
        </div>
      )}

      {goal.tips?.length > 0 && (
        <details>
          <summary className="ui-small ui-muted" style={{ cursor: "pointer" }}>Plan details</summary>
          <ul className="ui-bullets" style={{ marginTop: "0.4rem" }}>
            {goal.milestones.map((m) => <li key={`m${m.week}`} style={{ fontWeight: m.week === week ? 700 : 400 }}>Week {m.week}: {m.title}{m.target ? ` (${m.target})` : ""}</li>)}
            {goal.tips.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </details>
      )}

      {error && <div className="ui-alert ui-alert-error">{error}</div>}
      <div className="ui-row">
        <div className="ui-spacer" />
        {goal.status === "active" && <button className="ui-btn ui-btn-ghost ui-btn-sm" disabled={busy} onClick={() => act(() => setGoalStatus(goal._id, "completed"))}>Mark done</button>}
        <button className="ui-btn ui-btn-ghost ui-btn-sm" disabled={busy} onClick={() => window.confirm(`Delete "${goal.title}"?`) && act(() => deleteGoal(goal._id))}>Delete</button>
      </div>
    </div>
  );
}

export default function GoalPlanner() {
  const [goals, setGoals] = useState(null);
  const [description, setDescription] = useState("");
  const [weeks, setWeeks] = useState("");
  const [preview, setPreview] = useState(null);
  const [state, setState] = useState({ busy: false, error: "" });

  const load = useCallback(async () => {
    try {
      const { data } = await getGoals();
      setGoals(data);
    } catch (err) {
      setState({ busy: false, error: errorMessage(err) });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const plan = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: "" });
    setPreview(null);
    try {
      const { data } = await planGoal(description.trim(), weeks ? Number(weeks) : undefined);
      setPreview(data);
      setState({ busy: false, error: "" });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err, "Couldn't create a plan.") });
    }
  };

  const active = (goals || []).filter((g) => g.status === "active");
  const done = (goals || []).filter((g) => g.status === "completed");

  return (
    <AppShell title="Goals" subtitle="Your goals and progress.">
      <div className="ui-grid ui-grid-2" style={{ alignItems: "start", marginBottom: "1.25rem" }}>
        <form className="ui-card ui-stack" onSubmit={plan}>
          <h2>New goal</h2>
          <label className="ui-field">
            <span>What do you want to achieve?</span>
            <textarea className="ui-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. I want to walk more and get to 8,000 steps a day" maxLength={400} required minLength={3} />
          </label>
          <div className="ui-row">
            {IDEAS.map((i) => <button type="button" key={i} className="ui-btn ui-btn-sm" onClick={() => setDescription(i)}>{i}</button>)}
          </div>
          <div className="ui-row">
            <label className="ui-field" style={{ width: 160 }}>
              <span>Duration (optional)</span>
              <select className="ui-select" value={weeks} onChange={(e) => setWeeks(e.target.value)}>
                <option value="">Let AI suggest</option>
                {[2, 4, 6, 8, 12].map((w) => <option key={w} value={w}>{w} weeks</option>)}
              </select>
            </label>
            <div className="ui-spacer" />
            <button className="ui-btn ui-btn-primary" style={{ alignSelf: "flex-end" }} disabled={state.busy || description.trim().length < 3}>{state.busy ? "Planning…" : "Plan it with AI"}</button>
          </div>
          {state.error && <div className="ui-alert ui-alert-error">{state.error}</div>}
        </form>
        {preview ? (
          <PlanEditor key={preview.plan.title} preview={preview} onCancel={() => setPreview(null)} onSaved={() => { setPreview(null); setDescription(""); load(); }} />
        ) : (
          <div className="ui-card ui-empty" style={{ alignSelf: "stretch", display: "grid", placeItems: "center" }}>
            <div>
              <strong>How progress works</strong>
              Steps, sleep, weight, blood pressure and water goals update automatically from your daily log. Habit goals use the daily checklist. Weight-loss targets are capped at 1 kg a week.
            </div>
          </div>
        )}
      </div>

      {goals === null ? (
        <div className="ui-loading"><span className="ui-spinner" /> Loading goals…</div>
      ) : (
        <>
          <h2 style={{ fontSize: "1.15rem", marginBottom: "0.75rem" }}>Active goals ({active.length})</h2>
          {active.length === 0 ? <div className="ui-empty">No active goals yet. Plan one above.</div> : (
            <div className="ui-grid ui-grid-2">{active.map((g) => <GoalCard key={g._id} goal={g} onChange={load} />)}</div>
          )}
          {done.length > 0 && (
            <>
              <h2 style={{ fontSize: "1.15rem", margin: "1.5rem 0 0.75rem" }}>Completed ({done.length})</h2>
              <div className="ui-grid ui-grid-2">{done.map((g) => <GoalCard key={g._id} goal={g} onChange={load} />)}</div>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
