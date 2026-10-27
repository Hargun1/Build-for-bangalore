export function hasRecentVitals(vitals, source, now = Date.now()) {
  const maxAge = source === "bluetooth" || source === "simulator" ? 120000 : source === "manual" ? 300000 : 0;
  return maxAge > 0 && Number.isFinite(vitals?.timestamp) && now >= vitals.timestamp && now - vitals.timestamp <= maxAge;
}

export function vitalLogPayload(vitals, source, restingSample, now = Date.now()) {
  if (source === "simulator" || !hasRecentVitals(vitals, source, now)) return null;

  const payload = { source };
  if (
    restingSample?.source === source &&
    Number.isFinite(restingSample.heartRate) &&
    restingSample.heartRate >= 20 &&
    restingSample.heartRate <= 250 &&
    now >= restingSample.timestamp &&
    now - restingSample.timestamp <= 300000 &&
    (source !== "manual" || restingSample.timestamp === vitals.timestamp)
  ) {
    payload.restingHeartRate = restingSample.heartRate;
  }
  if (vitals.hrvMs != null) payload.hrvMs = vitals.hrvMs;
  if (vitals.spo2 != null) payload.spo2 = vitals.spo2;
  if (vitals.bloodPressure) {
    payload.systolic = vitals.bloodPressure.systolic;
    payload.diastolic = vitals.bloodPressure.diastolic;
  }
  if (vitals.temperature != null) payload.temperatureC = vitals.temperature;
  return Object.keys(payload).length > 1 ? payload : null;
}

export function sosVitalPayload(vitals, source, now = Date.now()) {
  if (!hasRecentVitals(vitals, source, now)) return null;
  const payload = {};
  if (vitals.heartRate != null) payload.heartRate = vitals.heartRate;
  if (vitals.spo2 != null) payload.spo2 = vitals.spo2;
  if (vitals.bloodPressure) {
    payload.systolic = vitals.bloodPressure.systolic;
    payload.diastolic = vitals.bloodPressure.diastolic;
  }
  if (vitals.temperature != null) payload.temperatureC = vitals.temperature;
  return Object.keys(payload).length ? payload : null;
}
