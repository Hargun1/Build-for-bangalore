export function participantSummary(profile) {
  const days = [...profile.days].sort((a, b) => a.day.localeCompare(b.day));
  const total = (key) => days.reduce((sum, row) => sum + row[key], 0);
  const count = days.length;
  return {
    id: profile.id,
    days: count,
    firstDay: days[0]?.day || null,
    lastDay: days.at(-1)?.day || null,
    averageSteps: count ? Math.round(total("steps") / count) : null,
    averageDistanceKm: count ? Math.round(total("distanceKm") / count * 10) / 10 : null,
    totalDistanceKm: Math.round(total("distanceKm") * 10) / 10,
    averageActiveMinutes: count ? Math.round(total("activeMinutes") / count) : null,
    chart: days.map((row) => ({ ...row, label: row.day.slice(5) })),
  };
}
