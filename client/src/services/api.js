import axios from "axios";

const TOKEN_KEY = "token";

function resolveBaseUrl() {
  const envUrl = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
  if (!envUrl) return "/api"; // dev: Vite proxies /api to the backend
  return envUrl.endsWith("/api") ? envUrl : `${envUrl}/api`;
}

export const API_BASE = resolveBaseUrl();

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  // AI calls can take a while (the free AI service may be waking up).
  timeout: 120000,
});

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* private mode */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private mode */
    }
  },
};

// Read the token on every request so a login in another tab is picked up.
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired session anywhere signs the user out everywhere.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && tokenStore.get() && !err.config?.url?.startsWith("/auth/")) {
      tokenStore.clear();
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(err);
  }
);

/** A user-friendly message from any API error. */
export function errorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (err?.code === "ECONNABORTED") return "The request timed out. The AI service may be waking up; please try again.";
  if (!err?.response) return "Can't reach the server. Check your connection and try again.";
  return err.response.data?.message || fallback;
}

export default api;
