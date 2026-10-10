// Central Bengaluru, used when the browser can't or won't share a location.
export const DEFAULT_LOCATION = { lat: 12.9716, lon: 77.5946, accuracyM: null, isDefault: true };

/** Resolves to { lat, lon, accuracyM, isDefault }. Never rejects. */
export function getLocation({ timeoutMs = 8000, highAccuracy = false } = {}) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(DEFAULT_LOCATION);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracyM: Math.round(pos.coords.accuracy), isDefault: false }),
      () => resolve(DEFAULT_LOCATION),
      { timeout: timeoutMs, enableHighAccuracy: highAccuracy, maximumAge: 5 * 60 * 1000 }
    );
  });
}
