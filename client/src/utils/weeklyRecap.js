export const shiftDay = (day, amount) => new Date(Date.parse(`${day}T00:00:00Z`) + amount * 86400000).toISOString().slice(0, 10);

const average = (rows, key) => {
  const values = rows.map((row) => row[key]).filter((value) => typeof value === "number" && Number.isFinite(value));
  return { value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, count: values.length };
};

export function buildWeeklyRecap(rows, todayDay) {
  const recentStart = shiftDay(todayDay, -6);
  const previousStart = shiftDay(todayDay, -13);
  const previousEnd = shiftDay(todayDay, -7);
  const real = rows.filter((row) => row?.source !== "simulator" && typeof row?.day === "string");
  const recent = real.filter((row) => row.day >= recentStart && row.day <= todayDay);
  const previous = real.filter((row) => row.day >= previousStart && row.day <= previousEnd);

  const metrics = [
    { key: "steps", label: "Steps", unit: "/day", digits: 0 },
    { key: "sleepHours", label: "Sleep", unit: "h/night", digits: 1 },
    { key: "systolic", label: "Systolic BP", unit: "mmHg", digits: 0 },
  ].map((item) => {
    const current = average(recent, item.key);
    const earlier = average(previous, item.key);
    return {
      ...item,
      current: current.value,
      previous: earlier.value,
      currentCount: current.count,
      previousCount: earlier.count,
      change: current.count >= 2 && earlier.count >= 2 ? current.value - earlier.value : null,
    };
  });

  const unknowns = [];
  if (recent.length < 3) unknowns.push("Fewer than three days logged this week");
  if (previous.length < 2) unknowns.push("Not enough entries from the previous week to compare");
  if (!metrics.find((item) => item.key === "systolic").currentCount) unknowns.push("No blood-pressure reading this week");
  if (!metrics.find((item) => item.key === "sleepHours").currentCount) unknowns.push("No sleep entry this week");

  const loggedToday = recent.some((row) => row.day === todayDay);
  const action = !loggedToday || recent.length < 3
    ? { kind: "checkin", text: loggedToday ? "Add another day when you have a reading." : "Add today's reading to build your trend.", label: "Quick check-in" }
    : { kind: "summary", text: "Keep this record ready for your next visit.", label: "Visit summary" };

  return { recentDays: recent.length, previousDays: previous.length, metrics, unknowns: unknowns.slice(0, 2), action };
}
