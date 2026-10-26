// Chart colours for the app's dark surface, taken from the validated reference
// palette (dark steps). Categorical slots are used in this fixed order; status
// colours are reserved for good/warning/critical states only.
export const CHART = {
  series: ["#a6dfbf", "#9fc9e9", "#ed9891", "#e8c17b"],
  grid: "rgba(255,255,255,0.07)",
  axis: "#919c94",
  text: "#c3c2b7",
  surface: "#1f2321",
  status: { good: "#a6dfbf", warn: "#e8c17b", bad: "#ed9891" },
};

export const tooltipStyle = {
  contentStyle: { background: CHART.surface, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#e8eaf0", fontSize: 12 },
  labelStyle: { color: CHART.text },
  itemStyle: { color: "#e8eaf0" },
  cursor: { stroke: "rgba(255,255,255,0.25)", strokeWidth: 1 },
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
