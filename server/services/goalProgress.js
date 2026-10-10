const HealthMetrics = require("../models/HealthMetrics");
const { GoalCheckin } = require("../models/Goal");
const { dayKey } = require("./userContext");

const DAY_MS = 24 * 3600 * 1000;
const parseDay = (d) => new Date(`${d}T00:00:00Z`).getTime();
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / DAY_MS) + 1; // inclusive

function addDays(day, n) {
  return new Date(parseDay(day) + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Progress is computed from what the user actually logged, never typed in by hand:
 *  - atLeast / atMost: share of the goal's days where the logged value met the daily target
 *  - reach (weight):   how far the latest value has moved from start toward target
 *  - habit:            share of planned habit ticks completed
 */
async function computeProgress(goal) {
  const today = dayKey();
  const lastDay = today < goal.endDate ? today : goal.endDate;
  const totalDays = daysBetween(goal.startDate, goal.endDate);
  const elapsedDays = Math.max(0, Math.min(totalDays, daysBetween(goal.startDate, lastDay)));

  const [metrics, checkins] = await Promise.all([
    goal.metric !== "habit"
      ? HealthMetrics.find({ userId: goal.userId, day: { $gte: goal.startDate, $lte: goal.endDate } }).sort({ day: 1 }).lean()
      : [],
    GoalCheckin.find({ goalId: goal._id }).lean(),
  ]);

  const series = [];
  let percent = 0;
  let daysMet = 0;
  let latest = null;

  if (goal.metric !== "habit") {
    for (const row of metrics) {
      const value = row[goal.metric];
      if (typeof value !== "number") continue;
      latest = value;
      const met = goal.direction === "atMost" ? value <= goal.dailyTarget : goal.direction === "atLeast" ? value >= goal.dailyTarget : null;
      if (met) daysMet += 1;
      series.push({ day: row.day, value, met });
    }
    if (goal.direction === "reach") {
      const start = goal.startValue;
      const target = goal.targetValue;
      if (latest != null && start != null && target != null && start !== target) {
        percent = ((start - latest) / (start - target)) * 100;
      }
    } else if (goal.dailyTarget != null) {
      percent = (daysMet / totalDays) * 100;
    }
  }

  const habitCount = goal.habits?.length || 0;
  const ticks = checkins.reduce((sum, c) => sum + (c.habitsDone?.length || 0), 0);
  const habitPercent = habitCount ? (ticks / (habitCount * totalDays)) * 100 : null;
  if (goal.metric === "habit") percent = habitPercent ?? 0;

  // Current streak: consecutive days up to today with every habit ticked.
  const doneDays = new Set(checkins.filter((c) => habitCount && c.habitsDone.length >= habitCount).map((c) => c.day));
  let streak = 0;
  for (let d = today; doneDays.has(d); d = addDays(d, -1)) streak += 1;

  return {
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    daysMet,
    totalDays,
    elapsedDays,
    daysLeft: Math.max(0, totalDays - elapsedDays),
    latestValue: latest,
    habitPercent: habitPercent == null ? null : Math.round(Math.min(100, habitPercent)),
    streak,
    todayHabits: checkins.find((c) => c.day === today)?.habitsDone || [],
    series,
  };
}

module.exports = { computeProgress, addDays, daysBetween };
