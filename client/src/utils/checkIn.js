export function makeCheckInPayload(values, edited) {
  if (!edited.size) return { error: "Change or enter at least one reading." };
  const payload = { source: "manual" };
  for (const key of edited) {
    const raw = values[key];
    const value = raw === "" || raw == null ? null : Number(raw);
    if (value !== null && !Number.isFinite(value)) return { error: "Enter a valid number for every changed reading." };
    payload[key] = value;
  }

  if (edited.has("systolic") || edited.has("diastolic")) {
    const top = values.systolic === "" ? null : Number(values.systolic);
    const bottom = values.diastolic === "" ? null : Number(values.diastolic);
    if ((top == null) !== (bottom == null)) return { error: "Enter both blood-pressure numbers, or clear both." };
    if (top != null && (!Number.isFinite(top) || !Number.isFinite(bottom) || top <= bottom)) {
      return { error: "The top blood-pressure number must be higher than the bottom number." };
    }
    payload.systolic = top;
    payload.diastolic = bottom;
  }
  return { payload };
}
