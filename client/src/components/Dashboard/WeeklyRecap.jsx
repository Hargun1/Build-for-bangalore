import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { buildWeeklyRecap } from "../../utils/weeklyRecap";

const number = (value, digits) => Number(value).toLocaleString("en-IN", { maximumFractionDigits: digits });

export default function WeeklyRecap({ rows, todayDay, onCheckIn }) {
  const recap = buildWeeklyRecap(rows, todayDay);

  return (
    <section className="weekly-recap" aria-labelledby="weekly-recap-title">
      <div className="ui-card-title">
        <div>
          <h2 id="weekly-recap-title">Your past 7 days</h2>
          <p className="ui-faint">{recap.recentDays} days logged · compared with the 7 days before</p>
        </div>
        {recap.action.kind === "checkin" ? (
          <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={onCheckIn}>{recap.action.label}<ArrowRight size={14} /></button>
        ) : (
          <Link to="/visit-summary" className="ui-btn ui-btn-primary ui-btn-sm">{recap.action.label}<ArrowRight size={14} /></Link>
        )}
      </div>
      <div className="weekly-recap-metrics">
        {recap.metrics.map((metric) => (
          <div className="weekly-recap-metric" key={metric.key}>
            <span className="ui-faint">{metric.label}</span>
            <strong>{metric.current == null ? "Not logged" : `${number(metric.current, metric.digits)} ${metric.unit}`}</strong>
            <small>{metric.change == null ? "Need 2 readings in each week to compare" : `${metric.change > 0 ? "+" : ""}${number(metric.change, metric.digits)} ${metric.unit} vs previous 7 days`}</small>
          </div>
        ))}
      </div>
      <div className="weekly-recap-footer">
        <span>{recap.action.text}</span>
        {recap.unknowns.length > 0 && <span className="ui-faint">Still unknown: {recap.unknowns.join(" · ")}</span>}
      </div>
    </section>
  );
}
