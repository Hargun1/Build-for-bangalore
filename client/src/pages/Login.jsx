import { useState } from "react";
import { useNavigate, useLocation, Link, Navigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../services/api";
import { GOOGLE_CLIENT_ID } from "../config";
import AuthCard from "../components/Shared/AuthCard";

function GoogleButton({ onCredential, onError, disabled }) {
  const login = useGoogleLogin({ onSuccess: (r) => onCredential(r.access_token), onError: () => onError("Google sign-in was cancelled or failed.") });
  return <button type="button" className="ui-btn" style={{ width: "100%" }} onClick={() => login()} disabled={disabled}>Continue with Google</button>;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const { user, login, loginAsGuest, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = location.state?.from?.pathname || "/dashboard";
  const run = async (fn) => {
    setError(""); setBusy(true);
    try { await fn(); navigate(next, { replace: true }); }
    catch (err) {
      if (err?.response?.data?.requiresEmailVerification) navigate(`/verify-email?email=${encodeURIComponent(err.response.data.email || email)}`);
      else setError(errorMessage(err, "Sign-in failed"));
    } finally { setBusy(false); }
  };
  if (user) return <Navigate to={next} replace />;
  return <AuthCard title="Welcome back." subtitle="Sign in to your health account." footer={<>New here? <Link to="/register">Create an account</Link></>}>
    {error && <div className="ui-alert ui-alert-error" role="alert" style={{ marginBottom: 20 }}>{error}</div>}
    <form className="ui-stack" onSubmit={(e) => { e.preventDefault(); run(() => login(email, password)); }}>
      <label className="ui-field"><span>Email address</span><input className="ui-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" /></label>
      <div className="ui-field"><div className="ui-row"><label htmlFor="login-password" className="ui-small">Password</label><span className="ui-spacer" /><Link to="/forgot-password" className="ui-faint">Forgot password?</Link></div><div className="auth-password"><input id="login-password" className="ui-input" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /><button type="button" className="ui-btn ui-btn-ghost ui-icon-btn" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} title={show ? "Hide password" : "Show password"}>{show ? <EyeOff /> : <Eye />}</button></div></div>
      <button className="ui-btn ui-btn-primary" disabled={busy}>{busy ? <><span className="ui-spinner" /> Signing in...</> : <>Sign in <ArrowRight /></>}</button>
    </form>
    <div className="auth-divider">or</div>
    <div className="ui-stack">
      {GOOGLE_CLIENT_ID && !/your_|placeholder|example/i.test(GOOGLE_CLIENT_ID) && <GoogleButton disabled={busy} onCredential={(token) => run(() => loginWithGoogle(token))} onError={setError} />}
      <button className="ui-btn" disabled={busy} onClick={() => run(loginAsGuest)}>Continue as guest</button>
    </div>
  </AuthCard>;
}
