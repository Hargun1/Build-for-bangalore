import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

const DEMO_USER = {
  id: "demo-user-id",
  name: "Pranexus User",
  email: "demo@pranexusai.com",
  gender: "male",
  emailVerified: true,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      api
        .get("/users/me")
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem("token");
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const loginWithGoogle = async (credential) => {
    const res = await api.post("/auth/google", { credential });
    localStorage.setItem("token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (data) => {
    const res = await api.post("/auth/register", data);
    // No token returned — user must verify email first
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    delete api.defaults.headers.common["Authorization"];
  };

  if (loading) return null;

  const activeUser = user || DEMO_USER;

  return (
    <AuthContext.Provider value={{ user: activeUser, token, login, loginWithGoogle, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
