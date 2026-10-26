// Categorical chart colours are separate from clinical status colours.
export const CHART = {
  series: ["#3b8271", "#8564ad", "#4f79ba", "#b66a61"],
  grid: "#e1e7ed",
  axis: "#647183",
  text: "#243240",
  surface: "#ffffff",
  status: { good: "#20745b", warn: "#896017", bad: "#b13d4d" },
};

export const tooltipStyle = {
  contentStyle: { background: CHART.surface, border: `1px solid ${CHART.grid}`, borderRadius: 6, color: CHART.text, fontSize: 12 },
  labelStyle: { color: CHART.text },
  itemStyle: { color: CHART.text },
  cursor: { stroke: "#b8c8dc", strokeWidth: 1 },
};

export const axisProps = {
  tick: { fill: CHART.axis, fontSize: 11 },
  axisLine: false,
  tickLine: false,
};

// 8000 -> "8k" so step counts fit narrow chart axes.
export const compactNumber = (v) => (Math.abs(v) >= 1000 ? `${Math.round((v / 1000) * 10) / 10}k` : String(v));

export const levelColor = (level) =>
  ({ low: CHART.status.good, moderate: CHART.status.warn, high: CHART.status.bad }[level] || CHART.axis);

export const levelBadge = (level) =>
  ({ low: "ui-badge-good", moderate: "ui-badge-warn", high: "ui-badge-bad" }[level] || "");

export const shortDay = (day) => {
  const d = new Date(`${day}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
