import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AppShell from "../components/Shared/AppShell";
import SourceBadge from "../components/Shared/SourceBadge";
import { errorMessage } from "../services/api";
import { deleteLabReport, getLabReports, readLabReport, saveLabReport } from "../services/healthService";
import { filesToPages, MAX_PAGES } from "../utils/reportPages";
import "./Labs.css";

const STATUS = {
  normal: ["ui-badge-good", "In range"],
  high: ["ui-badge-bad", "High"],
  low: ["ui-badge-bad", "Low"],
  check: ["ui-badge-warn", "Check value"],
  unknown: ["ui-badge-info", "Not judged"],
};
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function rangeText(t) {
  if (t.rangeSource === "report") return t.refRange;
  if (t.rangeSource !== "standard") return "—";
  const u = t.standardUnit || "";
  if (t.low != null && t.high != null) return `${t.low}–${t.high} ${u}`;
  if (t.high != null) return `up to ${t.high} ${u}`;
  if (t.low != null) return `${t.low} or more ${u}`;
  return "—";
}

function Status({ t }) {
  const [cls, label] = STATUS[t.status] || STATUS.unknown;
  return (
    <span className="lab-status">
      <span className={`ui-badge ${cls}`}>{label}</span>
      {t.critical && <span className="ui-badge ui-badge-bad lab-urgent">See a doctor today</span>}
    </span>
  );
}

/** Where the value sits within its range: a small bar, so "how far out" is visible at a glance. */
function RangeBar({ t }) {
  const v = t.rangeSource === "report" ? t.value : t.standardValue;
  if (v == null || (t.low == null && t.high == null)) return null;
  const lo = t.low ?? t.high * 0.5;
  const hi = t.high ?? t.low * 1.6;
  const span = hi - lo || 1;
  const min = lo - span * 0.6;
  const max = hi + span * 0.6;
  const pct = (x) => Math.max(0, Math.min(100, ((x - min) / (max - min)) * 100));
  return (
    <div className="lab-bar" aria-hidden="true">
      <div className="lab-bar-ok" style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }} />
      <div className={`lab-bar-dot lab-${t.status}`} style={{ left: `${pct(v)}%` }} />
    </div>
  );
}

function ResultsTable({ tests, editable, onEdit }) {
  const [open, setOpen] = useState(null);
  const groups = useMemo(() => {
    const g = {};
    tests.forEach((t, i) => (g[t.group || "Other"] ||= []).push([t, i]));
    return Object.entries(g);
  }, [tests]);

  return (
    <div className="lab-table-wrap">
      <table className="ui-table lab-table">
        <thead>
          <tr>
            <th>Test</th>
            <th className="num">Result</th>
            <th className="lab-hide-sm">Range</th>
            <th>Status</th>
          </tr>
        </thead>
        {groups.map(([group, rows]) => (
          <tbody key={group}>
            <tr className="lab-group">
              <td colSpan={4}>{group}</td>
            </tr>
            {rows.map(([t, i]) => {
              const hasMore = t.meaning || t.band || t.note || t.source || t.url;
              const expanded = open === i;
              return [
                <tr key={i} className={`lab-row ${hasMore ? "lab-clickable" : ""} ${t.status === "high" || t.status === "low" ? "lab-off" : ""}`} onClick={() => hasMore && setOpen(expanded ? null : i)}>
                  <td>
                    <div className="lab-name">{t.display || t.name}</div>
                    {t.display && t.display !== t.name && <div className="ui-faint">{t.name}</div>}
                  </td>
                  <td className="num" onClick={(e) => editable && e.stopPropagation()}>
                    {editable ? (
                      <input className="ui-input lab-value-input" value={t.valueText} aria-label={`${t.name} value`} onChange={(e) => onEdit(i, e.target.value)} />
                    ) : (
                      <strong>{t.valueText}</strong>
                    )}{" "}
                    <span className="ui-faint">{t.unit}</span>
                    <RangeBar t={t} />
                  </td>
                  <td className="lab-hide-sm ui-small ui-muted">
                    {rangeText(t)}
                    {t.rangeSource === "standard" && <div className="ui-faint">standard range</div>}
                  </td>
                  <td>
                    <Status t={t} />
                    {hasMore && <span className="lab-chevron" aria-hidden="true">{expanded ? "▴" : "▾"}</span>}
                  </td>
                </tr>,
                expanded && (
                  <tr key={`${i}-more`} className="lab-more">
                    <td colSpan={4}>
                      <div className="lab-hide-lg ui-small ui-muted">Range: {rangeText(t)}</div>
                      {t.band && <p><strong>{t.band[0].toUpperCase() + t.band.slice(1)}.</strong></p>}
                      {t.meaning && <p>{t.meaning}</p>}
                      {t.note && <p className="ui-muted">{t.note}</p>}
                      {t.source && (
                        <blockquote className="lab-quote">
                          “{t.source.text.trim()}…”
                          <footer>
                            <a href={t.source.url} target="_blank" rel="noreferrer">{t.source.title}</a> · MedlinePlus (NIH)
                          </footer>
                        </blockquote>
                      )}
                      {t.url && (
                        <a className="ui-small" href={t.url} target="_blank" rel="noreferrer">
                          About the {t.display} test on MedlinePlus ↗
                        </a>
                      )}
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function Uploader({ onRead }) {
  const inputRef = useRef(null);
  const [pages, setPages] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const pick = async (files) => {
    setError("");
    setBusy("Preparing pages…");
    try {
      setPages(await filesToPages([...files]));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const read = async () => {
    setError("");
    setBusy("Reading your report… this takes 20–45 seconds, as every row is copied carefully");
    try {
      const { data } = await readLabReport(pages);
      if (!data.isLabReport) setError(data.message);
      else {
        onRead(data);
        setPages([]);
      }
    } catch (err) {
      setError(errorMessage(err, "Couldn't read the report. Please try again."));
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="ui-card">
      <h2 className="ui-card-title">Add a report</h2>
      <div
        className={`ui-dropzone ${dragging ? "dragging" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
      >
        <div className="lab-drop-icon" aria-hidden="true">🧪</div>
        <strong>Drop a photo or PDF of your blood test</strong>
        <div className="ui-faint">Up to {MAX_PAGES} pages · photos: flat, well lit, whole table visible</div>
        <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => e.target.files.length && pick(e.target.files)} />
      </div>

      {pages.length > 0 && (
        <div className="lab-thumbs">
          {pages.map((p, i) => (
            <img key={i} src={p} alt={`Page ${i + 1}`} />
          ))}
        </div>
      )}
      {error && <div className="ui-alert ui-alert-error" role="alert">{error}</div>}
      <div className="ui-row" style={{ marginTop: "0.75rem" }}>
        {busy ? (
          <div className="ui-loading"><span className="ui-spinner" /> {busy}</div>
        ) : (
          <>
            <button className="ui-btn ui-btn-primary" disabled={!pages.length} onClick={read}>Read report</button>
            {pages.length > 0 && <button className="ui-btn ui-btn-ghost" onClick={() => setPages([])}>Clear</button>}
          </>
        )}
      </div>
      <p className="ui-faint" style={{ marginTop: "0.75rem" }}>
        The AI only copies the printed values. Plain code then checks each one against your lab's printed range, converts units and rejects impossible numbers.
      </p>
    </section>
  );
}

function Review({ draft, setDraft, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const edited = draft.tests.some((t) => t.edited);

  const edit = (i, valueText) =>
    setDraft((d) => ({ ...d, tests: d.tests.map((t, j) => (j === i ? { ...t, valueText, edited: true } : t)) }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const tests = draft.tests
        .filter((t) => t.valueText.trim())
        .map((t) => ({ name: t.name, key: t.key || undefined, value: t.valueText, unit: t.unit || "", refRange: t.refRange || "" }));
      const { data } = await saveLabReport({ reportDate: draft.reportDate, labName: draft.labName, tests, aiSource: draft.aiSource });
      onSaved(data);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the report."));
    } finally {
      setSaving(false);
    }
  };

  const c = draft.counts;
  return (
    <section className="ui-card lab-review">
      <div className="ui-row" style={{ marginBottom: "0.5rem" }}>
        <h2 className="ui-card-title" style={{ margin: 0 }}>Check and save</h2>
        <div className="ui-spacer" />
        <SourceBadge source={draft.aiSource} />
      </div>
      {draft.alert && (
        <div className="ui-alert ui-alert-emergency" role="alert">
          <strong>{draft.alert.title}</strong>
          <div>{draft.alert.text}</div>
        </div>
      )}
      <div className="lab-counts">
        <span className="ui-badge ui-badge-good">{c.normal} in range</span>
        {c.high + c.low > 0 && <span className="ui-badge ui-badge-bad">{c.high + c.low} out of range</span>}
        {c.check > 0 && <span className="ui-badge ui-badge-warn">{c.check} to check</span>}
        {c.unknown > 0 && <span className="ui-badge ui-badge-info">{c.unknown} not judged</span>}
      </div>
      <p className="ui-muted">{draft.summary}</p>
      <div className="ui-form-grid lab-meta">
        <label className="ui-field">
          <span>Report date</span>
          <input className="ui-input" type="date" max={today()} value={draft.reportDate} onChange={(e) => setDraft({ ...draft, reportDate: e.target.value })} />
        </label>
        <label className="ui-field">
          <span>Lab</span>
          <input className="ui-input" value={draft.labName} maxLength={80} onChange={(e) => setDraft({ ...draft, labName: e.target.value })} />
        </label>
      </div>
      <p className="ui-faint">Compare each value with your report and fix any misread number before saving. Tap a row for what it means.</p>
      <ResultsTable tests={draft.tests} editable onEdit={edit} />
      {error && <div className="ui-alert ui-alert-error" role="alert">{error}</div>}
      <div className="ui-row" style={{ marginTop: "0.75rem" }}>
        <button className="ui-btn ui-btn-primary" onClick={save} disabled={saving || !draft.reportDate}>
          {saving ? "Saving…" : edited ? "Re-check and save" : "Save report"}
        </button>
        <button className="ui-btn ui-btn-ghost" onClick={() => setDraft(null)} disabled={saving}>Discard</button>
      </div>
      <p className="ui-faint" style={{ marginTop: "0.6rem" }}>{draft.disclaimer}</p>
    </section>
  );
}

function Trends({ reports }) {
  const series = useMemo(() => {
    const by = {};
    [...reports].reverse().forEach((r) =>
      r.tests.forEach((t) => {
        if (!t.key || t.standardValue == null || t.status === "check") return;
        (by[t.key] ||= { name: t.display, unit: t.standardUnit, points: [], last: t }).points.push({ date: r.reportDate, value: t.standardValue, status: t.status });
        by[t.key].last = t;
      })
    );
    return Object.entries(by).filter(([, s]) => s.points.length >= 2);
  }, [reports]);
  const [key, setKey] = useState(null);
  const active = series.find(([k]) => k === key) || series[0];

  if (!series.length) {
    return (
      <section className="ui-card">
        <h2 className="ui-card-title">Trends</h2>
        <p className="ui-faint">Save two or more reports with the same test to see how it changes over time.</p>
      </section>
    );
  }
  const [, s] = active;
  const band = s.last.rangeSource === "standard" ? s.last : null;
  // Keep the normal range in view, so a value far below it still shows how far off it is.
  const vals = s.points.map((p) => p.value).concat(band ? [band.low, band.high].filter((x) => x != null) : []);
  const pad = (Math.max(...vals) - Math.min(...vals)) * 0.1 || 1;
  const domain = [Math.max(0, +(Math.min(...vals) - pad).toFixed(1)), +(Math.max(...vals) + pad).toFixed(1)];
  return (
    <section className="ui-card">
      <h2 className="ui-card-title">Trends</h2>
      <div className="lab-chips" role="tablist">
        {series.map(([k, x]) => (
          <button key={k} role="tab" aria-selected={k === active[0]} className={`lab-chip ${k === active[0] ? "active" : ""}`} onClick={() => setKey(k)}>
            <span className={`lab-dot lab-${x.last.status}`} /> {x.name}
          </button>
        ))}
      </div>
      <div style={{ height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={s.points} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmt} stroke="#6b7385" fontSize={12} />
            <YAxis stroke="#6b7385" fontSize={12} domain={domain} />
            {band && <ReferenceArea y1={band.low ?? undefined} y2={band.high ?? undefined} fill="#4ade80" fillOpacity={0.08} />}
            <Tooltip contentStyle={{ background: "#0f131c", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} labelFormatter={fmt} formatter={(v) => [`${v} ${s.unit}`, s.name]} />
            <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} dot={{ r: 4, fill: "#22d3ee" }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="ui-faint">Values converted to {s.unit} so different labs can be compared.{band && " Green band: standard adult range."}</p>
    </section>
  );
}

export default function Labs() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getLabReports()
      .then((r) => setReports(r.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const onRead = (data) => setDraft({ ...data, reportDate: data.reportDate || today(), labName: data.labName || "" });
  const onSaved = (doc) => {
    setReports((r) => [doc, ...r].sort((a, b) => b.reportDate.localeCompare(a.reportDate)));
    setDraft(null);
    setOpenId(doc._id);
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this report?")) return;
    try {
      await deleteLabReport(id);
      setReports((r) => r.filter((x) => x._id !== id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AppShell title="Lab reports" subtitle="Upload a blood test. See which results are out of range, what they mean, and how they change over time.">
      {error && <div className="ui-alert ui-alert-error" role="alert">{error}</div>}
      <div className="ui-stack" style={{ gap: "1rem" }}>
        {draft ? <Review draft={draft} setDraft={setDraft} onSaved={onSaved} /> : <Uploader onRead={onRead} />}

        <div className="ui-grid ui-grid-2 lab-lower">
          <section className="ui-card">
            <div className="ui-row">
              <h2 className="ui-card-title" style={{ margin: 0 }}>Saved reports</h2>
              <div className="ui-spacer" />
              {reports.length > 0 && <Link to="/glass-body" className="ui-btn ui-btn-sm">See on your body →</Link>}
            </div>
            {loading ? (
              <div className="ui-loading"><span className="ui-spinner" /> Loading…</div>
            ) : !reports.length ? (
              <p className="ui-faint" style={{ marginTop: "0.75rem" }}>No reports yet.</p>
            ) : (
              <ul className="lab-reports">
                {reports.map((r) => (
                  <li key={r._id}>
                    <button className="lab-report-head" onClick={() => setOpenId(openId === r._id ? null : r._id)} aria-expanded={openId === r._id}>
                      <span>
                        <strong>{fmt(r.reportDate)}</strong>
                        {r.labName && <span className="ui-faint"> · {r.labName}</span>}
                      </span>
                      <span className="lab-counts">
                        <span className="ui-badge ui-badge-good">{r.counts?.normal ?? 0} in range</span>
                        {(r.counts?.high || 0) + (r.counts?.low || 0) > 0 && <span className="ui-badge ui-badge-bad">{r.counts.high + r.counts.low} out</span>}
                      </span>
                    </button>
                    {openId === r._id && (
                      <div className="lab-report-body">
                        <p className="ui-small ui-muted">{r.summary}</p>
                        <ResultsTable tests={r.tests} />
                        <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => remove(r._id)}>Delete report</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Trends reports={reports} />
        </div>
      </div>
    </AppShell>
  );
}
