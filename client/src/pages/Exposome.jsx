import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AppShell from "../components/Shared/AppShell";
import SourceBadge from "../components/Shared/SourceBadge";
import { errorMessage } from "../services/api";
import { getExposome, getExposomeHistory } from "../services/healthService";
import { CHART, axisProps, tooltipStyle } from "../utils/chartTheme";
import { getLocation } from "../utils/geo";

// CPCB's published colour for each AQI band (always shown with the band name).
const AQI_COLORS = { Good: "#00b050", Satisfactory: "#92d050", Moderate: "#ffd400", Poor: "#ff9900", "Very Poor": "#ff0000", Severe: "#c00000" };
const SEVERITY = { severe: "ui-alert-error", high: "ui-alert-error", moderate: "ui-alert-warn", low: "ui-alert-info" };
const time = (iso) => (iso ? iso.slice(11, 16) : "–");

function HourTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const h = payload[0].payload;
  return (
    <div style={{ ...tooltipStyle.contentStyle, padding: "0.5rem 0.7rem" }}>
      <strong>{time(h.time)}</strong> · outdoor score {h.outdoorScore}
      <div style={{ color: CHART.text, marginTop: 2 }}>AQI {h.aqi ?? "–"} · feels {Math.round(h.feelsLike)}°C · UV {h.uv?.toFixed(1)} · rain {h.rainChance ?? 0}%</div>
    </div>
  );
}

export default function Exposome() {
  const [loc, setLoc] = useState(null);
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });

  const load = useCallback(async () => {
    setState({ loading: true, error: "" });
    try {
      const position = loc || (await getLocation());
      setLoc(position);
      const [env, hist] = await Promise.all([getExposome(position.lat, position.lon), getExposomeHistory().catch(() => ({ data: [] }))]);
      setData(env.data);
      setHistory(hist.data);
      setState({ loading: false, error: "" });
    } catch (err) {
      setState({ loading: false, error: errorMessage(err) });
    }
  }, [loc]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aq = data?.airQuality;
  const placeName = data ? [data.location.area, data.location.city].filter(Boolean).join(", ") || "your location" : "";

  // One snapshot per hour; keep the daily maximum for the 7-day chart.
  const daily = Object.values(
    history.reduce((acc, r) => {
      const day = r.hour.slice(0, 10);
      if (r.aqi != null && (!acc[day] || r.aqi > acc[day].aqi)) acc[day] = { day, label: day.slice(5), aqi: r.aqi };
      return acc;
    }, {})
  );

  return (
    <AppShell
      title="Environment"
      subtitle="Live air quality on India's CPCB scale, weather and UV where you are, and the best time to be outside today."
      actions={<button className="ui-btn ui-btn-sm" onClick={load} disabled={state.loading}>{state.loading ? "Updating…" : "Refresh"}</button>}
    >
      {loc?.isDefault && <div className="ui-alert ui-alert-info" style={{ marginBottom: "1rem" }}>Location access is off, so this shows central Bengaluru. Allow location in your browser for your own area.</div>}
      {state.error && <div className="ui-alert ui-alert-error" role="alert" style={{ marginBottom: "1rem" }}>{state.error}</div>}
      {state.loading && !data && <div className="ui-loading"><span className="ui-spinner" /> Fetching live conditions…</div>}

      {data && (
        <div className="ui-stack" style={{ gap: "1rem" }}>
          <p className="ui-muted">{placeName} · updated {new Date(data.fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>

          <div className="ui-grid ui-grid-3">
            <div className="ui-card">
              <div className="ui-stat-label">Air quality · India NAQI</div>
              {aq ? (
                <>
                  <div className="ui-row" style={{ marginTop: "0.4rem" }}>
                    <span className="ui-stat-value" style={{ marginTop: 0 }}>{aq.aqi}</span>
                    <span className="ui-badge" style={{ background: AQI_COLORS[aq.name], color: ["Moderate", "Satisfactory"].includes(aq.name) ? "#1a1a1a" : "#fff", borderColor: "transparent" }}>{aq.name}</span>
                  </div>
                  <p className="ui-small ui-muted" style={{ marginTop: "0.5rem", lineHeight: 1.5 }}>{aq.impact}. Main pollutant: <strong>{aq.dominant}</strong>.</p>
                  <table className="ui-table" style={{ marginTop: "0.6rem" }}>
                    <tbody>
                      {[["PM2.5", aq.pollutants.pm25, "µg/m³"], ["PM10", aq.pollutants.pm10, "µg/m³"], ["NO₂", aq.pollutants.no2, "µg/m³"], ["O₃", aq.pollutants.o3, "µg/m³"]].map(([k, v, u]) => (
                        <tr key={k}><td>{k}</td><td className="num">{v ?? "–"} <span className="ui-faint">{u}</span></td></tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <p className="ui-muted" style={{ marginTop: "0.5rem" }}>Air-quality data isn't available for this location right now.</p>
              )}
            </div>

            <div className="ui-card">
              <div className="ui-stat-label">Weather</div>
              <div className="ui-stat-value">{data.current.temp}<small>°C</small></div>
              <div className="ui-stat-sub">{data.current.description} · feels like {data.current.feelsLike}°C</div>
              <table className="ui-table" style={{ marginTop: "0.6rem" }}>
                <tbody>
                  <tr><td>Humidity</td><td className="num">{data.current.humidity}%</td></tr>
                  <tr><td>Wind</td><td className="num">{Math.round(data.current.windKmh)} km/h</td></tr>
                  <tr><td>UV now / today's max</td><td className="num">{data.current.uvIndex?.toFixed(1)} / {data.sun.uvMax?.toFixed(1)}</td></tr>
                  <tr><td>Sunrise / sunset</td><td className="num">{time(data.sun.sunrise)} / {time(data.sun.sunset)}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="ui-card">
              <div className="ui-stat-label">Best time to be outside</div>
              {data.bestWindow ? (
                <>
                  <div className="ui-stat-value">{time(data.bestWindow.start)}<small>– {String(Number(time(data.bestWindow.end).slice(0, 2)) + 1).padStart(2, "0")}:00</small></div>
                  <div className="ui-stat-sub">Outdoor score {data.bestWindow.score}/100, from air quality, heat, UV and rain chance</div>
                </>
              ) : (
                <p className="ui-muted" style={{ marginTop: "0.5rem" }}>No suitable window left today.</p>
              )}
              {data.aiAdvice?.headline && (
                <div style={{ marginTop: "0.9rem" }}>
                  <div className="ui-row" style={{ marginBottom: "0.3rem" }}><strong className="ui-small">For you today</strong><SourceBadge source={data.aiAdvice.aiSource} /></div>
                  <p className="ui-small" style={{ lineHeight: 1.5 }}>{data.aiAdvice.headline}</p>
                  <ul className="ui-bullets" style={{ marginTop: "0.4rem" }}>{data.aiAdvice.tips.map((t) => <li key={t} className="ui-small">{t}</li>)}</ul>
                </div>
              )}
            </div>
          </div>

          {data.alerts.length > 0 && (
            <div className="ui-stack">
              {data.alerts.map((a) => (
                <div key={a.type} className={`ui-alert ${SEVERITY[a.severity]}`}>
                  <strong>{a.title}</strong>
                  {a.message}
                  <div className="ui-faint" style={{ marginTop: "0.3rem", color: "inherit", opacity: 0.85 }}>{a.recommendations.join(" · ")}</div>
                </div>
              ))}
            </div>
          )}

          <div className="ui-card">
            <div className="ui-card-title">
              <h3>Outdoor score, next 24 hours</h3>
              <span className="ui-faint">higher is better · hover for details</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.hourly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="time" tickFormatter={time} {...axisProps} interval={2} />
                <YAxis {...axisProps} domain={[0, 100]} width={44} />
                <Tooltip content={<HourTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="outdoorScore" radius={[4, 4, 0, 0]} maxBarSize={18}>
                  {data.hourly.map((h) => (
                    <Cell key={h.time} fill={data.bestWindow && (h.time === data.bestWindow.start || h.time === data.bestWindow.end) ? CHART.series[2] : CHART.series[0]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="ui-faint">Green bars mark the best 2-hour window. Hourly AQI uses the CAMS forecast model, so it is an estimate.</p>
          </div>

          {daily.length >= 2 && (
            <div className="ui-card">
              <div className="ui-card-title"><h3>Your air quality, last 7 days</h3><span className="ui-faint">daily maximum NAQI where you checked</span></div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={daily} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} width={44} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [v, "NAQI"]} />
                  <Line type="monotone" dataKey="aqi" stroke={CHART.series[0]} strokeWidth={2} dot={{ r: 3, fill: CHART.series[0], strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <p className="ui-faint">
            Data: {data.sources.map((s, i) => (
              <span key={s.url}>{i > 0 && " · "}<a href={s.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{s.name}</a></span>
            ))}. AQI computed on the CPCB National Air Quality Index scale from 24-hour (PM, NO₂, SO₂) and 8-hour (O₃, CO) averages.
          </p>
        </div>
      )}
    </AppShell>
  );
}
