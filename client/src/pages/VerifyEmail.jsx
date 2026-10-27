import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthCard from "../components/Shared/AuthCard";
import { useAuth } from "../context/AuthContext";
import api, { errorMessage } from "../services/api";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { acceptSession } = useAuth();
  const [email, setEmail] = useState(params.get("email") || "");
  const [otp, setOtp] = useState("");
  const [state, setState] = useState({ busy: false, error: "", info: "" });

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: "", info: "" });
    try {
      const { data } = await api.post("/auth/verify-email", { email: email.trim(), otp: otp.trim() });
      acceptSession(data);
      navigate("/profile?welcome=1", { replace: true });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err, "Verification failed"), info: "" });
    }
  };

  const resend = async () => {
    setState({ busy: true, error: "", info: "" });
    try {
      const { data } = await api.post("/auth/resend-verification", { email: email.trim() });
      setState({ busy: false, error: "", info: data.message });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err), info: "" });
    }
  };

  return (
    <AuthCard
      title="Verify your email"
      subtitle="Enter the 6-digit code from your inbox. It expires in 10 minutes."
      footer={<Link to="/login" style={{ textDecoration: "underline" }}>Back to sign in</Link>}
    >
      <form className="ui-stack" onSubmit={submit}>
        <label className="ui-field">
          <span>Email</span>
          <input className="ui-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="ui-field">
          <span>6-digit code</span>
          <input
            className="ui-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            required
            style={{ letterSpacing: "0.4em", fontSize: "1.3rem", textAlign: "center" }}
          />
        </label>
        {state.error && <div className="ui-alert ui-alert-error" role="alert">{state.error}</div>}
        {state.info && <div className="ui-alert ui-alert-info">{state.info}</div>}
        <button className="ui-btn ui-btn-primary ui-btn-lg" disabled={state.busy || otp.length !== 6}>
          {state.busy ? "Checking…" : "Verify and continue"}
        </button>
        <button type="button" className="ui-btn ui-btn-ghost" onClick={resend} disabled={state.busy || !email}>
          Didn't get it? Send a new code
        </button>
      </form>
    </AuthCard>
  );
}
