import axios from "axios";

function resolveApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL;

  if (!envUrl) return "/api";

  const trimmed = envUrl.trim().replace(/\/+$/, "");

  // Accept both backend root URLs and explicit /api URLs from env.
  if (/^https?:\/\//i.test(trimmed) && !trimmed.endsWith("/api")) {
    return `${trimmed}/api`;
  }

  return trimmed;
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: { "Content-Type": "application/json" },
});

// Attach token if it exists
const token = localStorage.getItem("token");
if (token) {
  api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

export default api;
