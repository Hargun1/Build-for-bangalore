import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import HealthOrb from "../components/Shared/HealthOrb";
import api, { errorMessage } from "../services/api";
import "./Login.css";

const features = [
  { icon: "🩸", text: "Indian diabetes risk score" },
  { icon: "🤖", text: "AI chat, meals & goals" },
  { icon: "🌫️", text: "Live Bengaluru air quality" },
  { icon: "🗑️", text: "Delete your data anytime" },
];

const steps = [
  { num: "01", label: "Create account", desc: "Enter your details" },
  { num: "02", label: "Verify email", desc: "Check your inbox" },
  { num: "03", label: "Start journey", desc: "Access dashboard" },
];

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "", gender: "male", dob: "" });
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
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { dob, ...rest } = form;
      await api.post("/auth/register", dob ? form : rest);
      navigate(`/verify-email?email=${encodeURIComponent(form.email.trim().toLowerCase())}`);
    } catch (err) {
      setError(errorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
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

      {/* Animated background */}
      <div className="login-bg-gradient login-bg-gradient-1" />
      <div className="login-bg-gradient login-bg-gradient-2" />
      <div className="login-bg-gradient login-bg-gradient-3" />
      <div className="login-grid-overlay" />

      <div className="login-content">
        {/* Left side - Visual */}
        <motion.div
          className="login-visual-section"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="login-brand">
            <motion.div
              className="login-brand-icon"
              animate={{
                boxShadow: [
                  "0 0 20px rgba(0, 245, 212, 0.5)",
                  "0 0 40px rgba(0, 245, 212, 0.8)",
                  "0 0 20px rgba(0, 245, 212, 0.5)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </motion.div>
            <span className="login-brand-text">PranexusAI</span>
            <span className="login-brand-badge">Join Us</span>
          </div>

          <div className="login-3d-container">
            <HealthOrb />
          </div>

          <motion.div
            className="login-tagline"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <h1>
              Start Your
              <br />
              <span className="login-tagline-gradient">Health Journey</span>
            </h1>
            <p>
              Join thousands using AI-powered health monitoring to prevent disease before it starts.
            </p>
          </motion.div>

          {/* How it works steps */}
          <motion.div
            style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  background: "var(--login-card-bg)",
                  border: "1px solid var(--login-border)",
                  borderRadius: "12px",
                  backdropFilter: "blur(12px)",
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                whileHover={{ scale: 1.03, borderColor: "var(--login-primary)" }}
              >
                <div
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "var(--login-primary)",
                    letterSpacing: "0.05em",
                    marginBottom: "0.25rem",
                  }}
                >
                  STEP {step.num}
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--login-text)" }}>
                  {step.label}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--login-text-muted)", marginTop: "0.15rem" }}>
                  {step.desc}
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="login-features"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.text}
                className="login-feature-pill"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + index * 0.1 }}
                whileHover={{ scale: 1.05, backgroundColor: "rgba(0, 245, 212, 0.15)" }}
              >
                <span>{feature.icon}</span>
                <span>{feature.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Right side - Form */}
        <motion.div
          className="login-form-section"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="login-form-container">
            <div className="login-form-glow" />

            <AnimatePresence mode="wait">
              {(
                /* ===== Registration Form ===== */
                <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0, x: -30 }}>
                  <div className="login-form-header">
                    <motion.div
                      className="login-welcome-icon"
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    >
                      🚀
                    </motion.div>
                    <h2>Create Account</h2>
                    <p>Begin your personalized health journey</p>
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
                        <span>{error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form className="login-form" onSubmit={handleSubmit}>
                    {/* Full Name */}
                    <div className={`login-input-group ${focusedField === "name" ? "focused" : ""} ${form.name ? "has-value" : ""}`}>
                      <div className="login-input-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <input
                        name="name"
                        placeholder="Full name"
                        value={form.name}
                        onChange={handleChange}
                        onFocus={() => setFocusedField("name")}
                        onBlur={() => setFocusedField(null)}
                        required
                        autoComplete="name"
                      />
                      <div className="login-input-highlight" />
                    </div>

                    {/* Email */}
                    <div className={`login-input-group ${focusedField === "email" ? "focused" : ""} ${form.email ? "has-value" : ""}`}>
                      <div className="login-input-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                      </div>
                      <input
                        name="email"
                        type="email"
                        placeholder="Email address"
                        value={form.email}
                        onChange={handleChange}
                        onFocus={() => setFocusedField("email")}
                        onBlur={() => setFocusedField(null)}
                        required
                        autoComplete="email"
                      />
                      <div className="login-input-highlight" />
                    </div>

                    {/* Password */}
                    <div className={`login-input-group ${focusedField === "password" ? "focused" : ""} ${form.password ? "has-value" : ""}`}>
                      <div className="login-input-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                      </div>
                      <input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={form.password}
                        onChange={handleChange}
                        onFocus={() => setFocusedField("password")}
                        onBlur={() => setFocusedField(null)}
                        required
                        minLength={8}
                        pattern="(?=.*[A-Za-z])(?=.*\d).{8,}"
                        title="At least 8 characters, with a letter and a number"
                        autoComplete="new-password"
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

                    {/* Gender & DOB row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                      <div className={`login-input-group ${focusedField === "gender" ? "focused" : ""}`}>
                        <div className="login-input-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <select
                          name="gender"
                          value={form.gender}
                          onChange={handleChange}
                          onFocus={() => setFocusedField("gender")}
                          onBlur={() => setFocusedField(null)}
                          style={{
                            width: "100%",
                            padding: "1rem 1rem 1rem 3rem",
                            background: "var(--login-input-bg)",
                            border: "1px solid var(--login-border)",
                            borderRadius: "12px",
                            color: "var(--login-text)",
                            fontSize: "1rem",
                            fontFamily: "inherit",
                            outline: "none",
                            appearance: "none",
                            cursor: "pointer",
                            transition: "all 0.3s ease",
                          }}
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                        <div className="login-input-highlight" />
                      </div>

                      <div className={`login-input-group ${focusedField === "dob" ? "focused" : ""} ${form.dob ? "has-value" : ""}`}>
                        <div className="login-input-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                        </div>
                        <input
                          name="dob"
                          type="date"
                          value={form.dob}
                          onChange={handleChange}
                          onFocus={() => setFocusedField("dob")}
                          onBlur={() => setFocusedField(null)}
                          required
                          style={{ colorScheme: theme }}
                        />
                        <div className="login-input-highlight" />
                      </div>
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
                          <span>Creating account...</span>
                        </div>
                      ) : (
                        <>
                          <span>Create Account</span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </>
                      )}
                    </motion.button>
                  </form>

                  <div className="login-footer">
                    <p>
                      Already have an account? <Link to="/login">Sign in</Link>
                    </p>
                  </div>

                  <p className="login-disclaimer">
                    Your date of birth and sex are used only for the risk scores. You can delete your account and data from your profile.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
