import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import api, { errorMessage } from "../services/api";
import AuthCard from "../components/Shared/AuthCard";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "", gender: "other", dob: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setError(""); setBusy(true);
    try { const { dob, ...rest } = form; await api.post("/auth/register", dob ? form : rest); navigate(`/verify-email?email=${encodeURIComponent(form.email.trim().toLowerCase())}`); }
    catch (err) { setError(errorMessage(err, "Registration failed")); }
    finally { setBusy(false); }
  };
  return <AuthCard title="Make room for your health." subtitle="Create your account. Your first step starts here." footer={<>Already have an account? <Link to="/login">Sign in</Link></>}>
    {error && <div className="ui-alert ui-alert-error" role="alert" style={{ marginBottom: 20 }}>{error}</div>}
    <form className="ui-stack" onSubmit={submit}>
      <label className="ui-field"><span>Full name</span><input className="ui-input" name="name" autoComplete="name" value={form.name} onChange={change} maxLength={80} required /></label>
      <label className="ui-field"><span>Email address</span><input className="ui-input" name="email" type="email" autoComplete="email" value={form.email} onChange={change} required /></label>
      <div className="ui-field"><label htmlFor="register-password" className="ui-small">Password</label><div className="auth-password"><input className="ui-input" id="register-password" name="password" type={show ? "text" : "password"} autoComplete="new-password" value={form.password} onChange={change} minLength={8} maxLength={128} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,}" title="At least 8 characters, including a letter and a number" required /><button type="button" className="ui-btn ui-btn-ghost ui-icon-btn" onClick={() => setShow(!show)} title={show ? "Hide password" : "Show password"} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff /> : <Eye />}</button></div><span className="ui-faint">At least 8 characters, including a letter and a number.</span></div>
      <div className="ui-form-grid">
        <label className="ui-field"><span>Sex for risk assessment</span><select className="ui-select" name="gender" value={form.gender} onChange={change}><option value="other">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option></select></label>
        <label className="ui-field"><span>Date of birth (optional)</span><input className="ui-input" type="date" name="dob" max={new Date().toISOString().slice(0, 10)} value={form.dob} onChange={change} /></label>
      </div>
      <button className="ui-btn ui-btn-primary" disabled={busy}>{busy ? "Creating account..." : <>Create account <ArrowRight /></>}</button>
    </form>
  </AuthCard>;
}
