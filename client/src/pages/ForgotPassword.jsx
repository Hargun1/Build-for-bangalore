import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthCard from "../components/Shared/AuthCard";
import { useAuth } from "../context/AuthContext";
import api, { errorMessage } from "../services/api";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { acceptSession } = useAuth();
  const [step, setStep] = useState("email"); // email -> code
  const [form, setForm] = useState({ email: "", otp: "", password: "" });
  const [state, setState] = useState({ busy: false, error: "", info: "" });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: key === "otp" ? e.target.value.replace(/\D/g, "") : e.target.value }));

  const requestCode = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: "", info: "" });
    try {
      const { data } = await api.post("/auth/forgot-password", { email: form.email.trim() });
      setState({ busy: false, error: "", info: data.message });
      setStep("code");
    } catch (err) {
      setState({ busy: false, error: errorMessage(err), info: "" });
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: "", info: "" });
    try {
      const { data } = await api.post("/auth/reset-password", { email: form.email.trim(), otp: form.otp, password: form.password });
      acceptSession(data);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err), info: "" });
    }
  };

  return (
    <AuthCard
      title="Reset your password"
      subtitle={step === "email" ? "Enter your account email and we'll send you a 6-digit code." : "Enter the code from your email and choose a new password."}
      footer={<Link to="/login" style={{ textDecoration: "underline" }}>Back to sign in</Link>}
    >
      {step === "email" ? (
        <form className="ui-stack" onSubmit={requestCode}>
          <label className="ui-field">
            <span>Email</span>
            <input className="ui-input" type="email" value={form.email} onChange={set("email")} required autoComplete="email" />
          </label>
          {state.error && <div className="ui-alert ui-alert-error" role="alert">{state.error}</div>}
          <button className="ui-btn ui-btn-primary ui-btn-lg" disabled={state.busy}>{state.busy ? "Sending…" : "Send code"}</button>
        </form>
      ) : (
        <form className="ui-stack" onSubmit={reset}>
          {state.info && <div className="ui-alert ui-alert-info">{state.info}</div>}
          <label className="ui-field">
            <span>6-digit code</span>
            <input className="ui-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={form.otp} onChange={set("otp")} required />
          </label>
          <label className="ui-field">
            <span>New password (8+ characters, a letter and a number)</span>
            <input
              className="ui-input"
              type="password"
              value={form.password}
              onChange={set("password")}
              minLength={8}
              pattern="(?=.*[A-Za-z])(?=.*\d).{8,}"
              required
              autoComplete="new-password"
            />
          </label>
          {state.error && <div className="ui-alert ui-alert-error" role="alert">{state.error}</div>}
          <button className="ui-btn ui-btn-primary ui-btn-lg" disabled={state.busy || form.otp.length !== 6}>{state.busy ? "Saving…" : "Set new password"}</button>
          <button type="button" className="ui-btn ui-btn-ghost" onClick={() => setStep("email")}>Use a different email</button>
        </form>
      )}
    </AuthCard>
  );
}
