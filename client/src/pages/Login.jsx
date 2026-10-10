import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useGoogleLogin } from "@react-oauth/google";
import { motion, AnimatePresence } from "framer-motion";
import HealthOrb from "../components/Shared/HealthOrb";
import { errorMessage } from "../services/api";
import { GOOGLE_CLIENT_ID } from "../config";
import "./Login.css";

// What each module actually does (shown around the orb).
const healthStats = [
  { icon: "🩸", label: "Diabetes risk", value: "IDRS", status: "optimal" },
  { icon: "❤️", label: "Heart risk", value: "Framingham", status: "active" },
  { icon: "🌫️", label: "Air quality", value: "Live CPCB AQI", status: "optimal" },
  { icon: "🍛", label: "Meal photos", value: "AI analysis", status: "good" },
];

const features = [
  { icon: "📊", text: "Daily health log" },
  { icon: "🤖", text: "AI chat, meals & goals" },
  { icon: "🔒", text: "Passwords hashed with bcrypt" },
  { icon: "⌚", text: "Bluetooth heart-rate sync" },
];

// Rendered only when a Google client ID is configured (the hook needs its provider).
function GoogleButton({ onCredential, onError, disabled }) {
  const googleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => onCredential(tokenResponse.access_token),
    onError: () => onError("Google sign-in was cancelled or failed."),
  });
  return (
    <button type="button" className="login-social-btn" onClick={() => googleLogin()} disabled={disabled} title="Sign in with Google" aria-label="Sign in with Google">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      <span style={{ marginLeft: 8 }}>Google</span>
    </button>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") || "dark";
    }
    return "dark";
  });
  const { login, loginWithGoogle, loginAsGuest } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const goNext = () => navigate(location.state?.from?.pathname || "/dashboard", { replace: true });

  const run = async (fn) => {
    setError("");
    setLoading(true);
    try {
      await fn();
      goNext();
    } catch (err) {
      if (err?.response?.data?.requiresEmailVerification) {
        navigate(`/verify-email?email=${encodeURIComponent(err.response.data.email || email)}`);
        return;
      }
      setError(errorMessage(err, "Sign-in failed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    run(() => login(email, password));
  };

  return (
    <div className={`login-container ${theme}`} data-theme={theme}>
      {/* Theme toggle */}
      <motion.button
        className="theme-toggle"
        onClick={toggleTheme}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {theme === "dark" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </motion.button>
      {/* Animated background gradients */}
      <div className="login-bg-gradient login-bg-gradient-1" />
      <div className="login-bg-gradient login-bg-gradient-2" />
      <div className="login-bg-gradient login-bg-gradient-3" />
      <div className="login-grid-overlay" />

      {/* Main content */}
      <div className="login-content">
        {/* Left side - 3D visualization */}
        <motion.div
          className="login-visual-section"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Brand header */}
          <div className="login-brand">
            <motion.div
              className="login-brand-icon"
              animate={{ 
                boxShadow: [
                  "0 0 20px rgba(0, 245, 212, 0.5)",
                  "0 0 40px rgba(0, 245, 212, 0.8)",
                  "0 0 20px rgba(0, 245, 212, 0.5)"
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </motion.div>
            <span className="login-brand-text">PranexusAI</span>
            <span className="login-brand-badge">Health Dashboard</span>
          </div>

          {/* 3D Health Orb */}
          <div className="login-3d-container">
            <HealthOrb />
            
            {/* Floating health stats around the orb */}
            <div className="login-floating-stats">
              {healthStats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  className={`login-stat-card login-stat-card-${index + 1}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.1, duration: 0.5 }}
                  whileHover={{ scale: 1.05, zIndex: 10 }}
                >
                  <span className="login-stat-icon">{stat.icon}</span>
                  <div className="login-stat-info">
                    <span className="login-stat-label">{stat.label}</span>
                    <span className={`login-stat-value login-stat-${stat.status}`}>
                      {stat.value}
                    </span>
                  </div>
                  <div className={`login-stat-indicator login-stat-indicator-${stat.status}`} />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Tagline */}
          <motion.div
            className="login-tagline"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <h1>Your Health,<br /><span className="login-tagline-gradient">Visualized</span></h1>
            <p>Advanced AI-powered health monitoring with real-time insights and predictive analytics.</p>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            className="login-features"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.text}
                className="login-feature-pill"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                whileHover={{ scale: 1.05, backgroundColor: "rgba(0, 245, 212, 0.15)" }}
              >
                <span>{feature.icon}</span>
                <span>{feature.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Right side - Login form */}
        <motion.div
          className="login-form-section"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="login-form-container">
            {/* Glass card effect */}
            <div className="login-form-glow" />
            
            <div className="login-form-header">
              <motion.div
                className="login-welcome-icon"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                👋
              </motion.div>
              <h2>Welcome back</h2>
              <p>Sign in to access your personalized health dashboard</p>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  className="login-error"
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span role="alert">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form className="login-form" onSubmit={handleSubmit}>
              <div className={`login-input-group ${focusedField === "email" ? "focused" : ""} ${email ? "has-value" : ""}`}>
                <div className="login-input-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  required
                  autoComplete="email"
                />
                <div className="login-input-highlight" />
              </div>

              <div className={`login-input-group ${focusedField === "password" ? "focused" : ""} ${password ? "has-value" : ""}`}>
                <div className="login-input-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
                <div className="login-input-highlight" />
              </div>

              <div className="login-options">
                <span />
                <Link to="/forgot-password" className="login-forgot">Forgot password?</Link>
              </div>

              <motion.button
                type="submit"
                className="login-submit"
                disabled={loading}
                whileHover={!loading ? { scale: 1.02 } : {}}
                whileTap={!loading ? { scale: 0.98 } : {}}
              >
                {loading ? (
                  <div className="login-loading">
                    <div className="login-spinner" />
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  <>
                    <span>Sign In</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
              </motion.button>
            </form>

            <div className="login-divider">
              <span>or continue with</span>
            </div>

            <div className="login-social-buttons">
              {GOOGLE_CLIENT_ID && (
                <GoogleButton disabled={loading} onCredential={(token) => run(() => loginWithGoogle(token))} onError={setError} />
              )}
              <button type="button" className="login-social-btn" onClick={() => run(loginAsGuest)} disabled={loading} title="Try without an account">
                <span>Continue as guest</span>
              </button>
            </div>

            <div className="login-footer">
              <p>Don't have an account? <Link to="/register">Create one</Link></p>
            </div>

            <p className="login-disclaimer">
              PranexusAI gives general wellness information, not medical advice. In an emergency call 112.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
