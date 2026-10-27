import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Printer, RotateCw } from "lucide-react";
import AppShell from "../components/Shared/AppShell";
import { errorMessage } from "../services/api";
import { getLabReports, getMe, getMetrics, getPredictions, getToday } from "../services/healthService";
import { buildVisitSummary } from "../utils/visitSummary";
import "./VisitSummary.css";

const day = (value) => value ? new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "Not recorded";
const number = (value, digits = 0) => value == null ? "—" : Number(value).toLocaleString("en-IN", { maximumFractionDigits: digits });
const list = (values) => values?.length ? values.join(", ") : "Not recorded";

export default function VisitSummary() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState(["", "", ""]);

  const load = useCallback(async () => {
    setError("");
    try {
      const [user, metrics, reports, predictions, today] = await Promise.all([
        getMe(), getMetrics(30), getLabReports(), getPredictions(1), getToday(),
      ]);
      setData(buildVisitSummary({ user: user.data, metrics: metrics.data, reports: reports.data, prediction: predictions.data[0], todayDay: today.data.day }));
    } catch (err) {
      setError(errorMessage(err, "Could not load your visit summary."));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell title="Visit summary" subtitle="A private snapshot for your next appointment." actions={data && <button type="button" className="ui-btn ui-btn-primary visit-print-button" onClick={() => window.print()}><Printer size={16} /> Print / save PDF</button>}>
      {error && <div className="ui-alert ui-alert-error visit-error" role="alert">{error} <button type="button" className="ui-btn ui-btn-sm" onClick={load}><RotateCw size={14} /> Retry</button></div>}
      {!data && !error && <div className="ui-loading"><span className="ui-spinner" /> Loading your records…</div>}
      {data && <article className="visit-summary" aria-label="Doctor visit summary">
        <header className="visit-header">
          <div><span className="visit-kicker">PRANEXUSAI · PATIENT SUMMARY</span><h2>{data.name}</h2><p>{data.age != null ? `Age ${data.age}` : "Age not recorded"} · Prepared {day(data.asOf)}</p></div>
          <span className="visit-private">Private health information</span>
        </header>
        <p className="visit-notice">Patient-entered readings and saved report values. Screening estimates are not a diagnosis. Check original lab reports and confirm details with a clinician.</p>

        <section className="visit-section">
          <div className="visit-section-heading"><h3>Last 7 days</h3><span>{data.recap.recentDays} days logged</span></div>
          <div className="visit-averages">
            {data.recap.metrics.map((metric) => <div key={metric.key}>
              <span>{metric.label}</span>
              <strong>{metric.current == null ? "Not logged" : `${number(metric.current, metric.digits)} ${metric.unit}`}</strong>
              <small>{metric.change == null ? "No reliable week-to-week comparison" : `${metric.change > 0 ? "+" : ""}${number(metric.change, metric.digits)} ${metric.unit} vs prior 7 days`}</small>
            </div>)}
          </div>
          {data.recap.unknowns.length > 0 && <p className="visit-muted">Unknown: {data.recap.unknowns.join(" · ")}</p>}
        </section>

        <section className="visit-section">
          <div className="visit-section-heading"><h3>Recent readings</h3><span>Last 30 days · up to 5 entries</span></div>
          {data.recentReadings.length ? <div className="visit-table-wrap"><table className="visit-table"><thead><tr><th>Date</th><th>Steps</th><th>Sleep</th><th>BP</th><th>Weight</th></tr></thead><tbody>
            {data.recentReadings.map((row) => <tr key={row.day}><td>{day(row.day)}</td><td>{number(row.steps)}</td><td>{row.sleepHours == null ? "—" : `${number(row.sleepHours, 1)} h`}</td><td>{row.systolic == null || row.diastolic == null ? "—" : `${number(row.systolic)}/${number(row.diastolic)}`}</td><td>{row.weightKg == null ? "—" : `${number(row.weightKg, 1)} kg`}</td></tr>)}
          </tbody></table></div> : <p className="visit-muted">No readings saved in the last 30 days. <Link to="/dashboard" className="visit-screen-only">Open your dashboard</Link></p>}
        </section>

        <section className="visit-section">
          <div className="visit-section-heading"><h3>Saved lab results needing review</h3><span>From {data.reportCount} recent report{data.reportCount === 1 ? "" : "s"}</span></div>
          {data.reportList.length > 0 && <ul className="visit-reports">{data.reportList.map((report, index) => <li key={`${report.date}-${report.lab}-${index}`}><strong>{report.lab}</strong><span>{day(report.date)} · {report.testCount} saved tests{report.unknownCount ? ` · ${report.unknownCount} without a checked status` : ""}</span></li>)}</ul>}
          {data.flags.length ? <div className="visit-table-wrap"><table className="visit-table"><thead><tr><th>Test and report</th><th>Result</th><th>Printed range</th><th>Flag</th></tr></thead><tbody>
            {data.flags.map((flag, index) => <tr key={`${flag.date}-${flag.name}-${index}`}><td><strong>{flag.name}</strong><small>{flag.lab} · {day(flag.date)}</small></td><td>{flag.value} {flag.unit}</td><td>{flag.range}</td><td>{flag.status}</td></tr>)}
          </tbody></table></div> : <p className="visit-muted">{data.reportCount ? "No flagged results in the included reports. Check the original reports, including any values without a checked status." : "No lab reports saved."}</p>}
          {data.additionalFlags > 0 && <p className="visit-muted">{data.additionalFlags} more flagged values are in the saved reports. Bring the original reports.</p>}
        </section>

        <div className="visit-columns">
          <section className="visit-section">
            <div className="visit-section-heading"><h3>Health background</h3></div>
            <dl className="visit-details"><dt>Conditions</dt><dd>{list(data.conditions)}</dd><dt>Medicines</dt><dd>{list(data.medications)}</dd><dt>Allergies</dt><dd>{list(data.allergies)}</dd></dl>
          </section>
          <section className="visit-section">
            <div className="visit-section-heading"><h3>Latest screening</h3><span>{data.screeningDate ? day(data.screeningDate) : "Not run"}</span></div>
            {data.scores.length ? <ul className="visit-scores">{data.scores.map((score) => <li key={score.key}><span>{score.label}</span><strong>{score.level}{score.value != null ? ` · ${number(score.value, 1)} ${score.unit || ""}` : ""}</strong></li>)}</ul> : <p className="visit-muted">No complete screening estimate saved.</p>}
          </section>
        </div>

        <section className="visit-section visit-questions">
          <div className="visit-section-heading"><h3>Questions for the visit</h3></div>
          <div className="visit-screen-only visit-question-inputs">{questions.map((question, index) => <label key={index}><span>{index + 1}.</span><input className="ui-input" value={question} maxLength={180} onChange={(event) => setQuestions((current) => current.map((item, i) => i === index ? event.target.value : item))} aria-label={`Question ${index + 1}`} /></label>)}</div>
          <ol className="visit-print-only">{questions.map((question, index) => <li key={index}>{question || "________________________________________________________"}</li>)}</ol>
        </section>
        <footer className="visit-footer">Generated from PranexusAI records on {day(data.asOf)}. This summary does not replace the original reports or a clinical assessment.</footer>
      </article>}
    </AppShell>
  );
}
