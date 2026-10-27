import { buildWeeklyRecap } from "./weeklyRecap.js";

const flagged = (test) => test.critical || ["high", "low", "check"].includes(test.status);

export function buildVisitSummary({ user, metrics = [], reports = [], prediction = null, todayDay }) {
  const realMetrics = metrics.filter((row) => row?.source !== "simulator" && typeof row?.day === "string");
  const recentReadings = [...realMetrics].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 5);
  const latestReports = [...reports].sort((a, b) => b.reportDate.localeCompare(a.reportDate)).slice(0, 3);
  const allFlags = latestReports.flatMap((report) => (report.tests || []).filter(flagged).map((test) => ({
    date: report.reportDate,
    lab: report.labName || "Lab report",
    name: test.display || test.name || "Test",
    value: test.valueText || (test.value != null ? String(test.value) : "Not recorded"),
    unit: test.unit || "",
    range: test.refRange || "Not recorded",
    status: test.critical ? "critical flag" : test.status,
  })));
  const scores = (prediction?.scores || []).filter((score) => score.level && score.level !== "unknown").slice(0, 4);

  return {
    name: user?.name || "Patient",
    age: user?.age ?? null,
    asOf: todayDay,
    recap: buildWeeklyRecap(realMetrics, todayDay),
    recentReadings,
    reportCount: latestReports.length,
    reportList: latestReports.map((report) => ({
      date: report.reportDate,
      lab: report.labName || "Lab report",
      testCount: report.tests?.length || 0,
      unknownCount: (report.tests || []).filter((test) => test.status === "unknown").length,
    })),
    flags: allFlags.slice(0, 6),
    additionalFlags: Math.max(0, allFlags.length - 6),
    screeningDate: prediction?.createdAt || null,
    scores,
    conditions: user?.profile?.conditions || [],
    medications: user?.profile?.medications || [],
    allergies: user?.profile?.allergies || [],
  };
}
