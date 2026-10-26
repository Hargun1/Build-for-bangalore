import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api, { tokenStore } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const acceptSession = useCallback(({ token, user: u }) => {
    tokenStore.set(token);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    try {
      Object.keys(sessionStorage).filter((key) => key.startsWith("pranexus-chat-")).forEach((key) => sessionStorage.removeItem(key));
    } catch { /* Storage can be unavailable in private browsing. */ }
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await api.get("/users/me");
    setUser(res.data);
    return res.data;
  }, []);

  // Restore the session on first load.
  useEffect(() => {
    if (!tokenStore.get()) return;
    refreshUser()
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [refreshUser, logout]);

  // The API client fires this when any request comes back 401.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      setUser,
      refreshUser,
      logout,
      acceptSession,
      login: async (email, password) => acceptSession((await api.post("/auth/login", { email, password })).data),
      loginWithGoogle: async (credential) => acceptSession((await api.post("/auth/google", { credential })).data),
      loginAsGuest: async () => acceptSession((await api.post("/auth/guest")).data),
      register: async (data) => (await api.post("/auth/register", data)).data,
    }),
    [user, loading, refreshUser, logout, acceptSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
