// Central Bengaluru, used when the browser can't or won't share a location.
export const DEFAULT_LOCATION = { lat: 12.9716, lon: 77.5946, accuracyM: null, isDefault: true };

export function mapsSearchUrl(term, location = DEFAULT_LOCATION) {
  const point = Number.isFinite(location?.lat) && Number.isFinite(location?.lon)
    ? `${location.lat.toFixed(5)},${location.lon.toFixed(5)}`
    : "Bengaluru";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${term} near ${point}`)}`;
}

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
