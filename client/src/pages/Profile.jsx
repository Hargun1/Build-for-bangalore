import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "../components/Shared/AppShell";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../services/api";
import { checkAiProvider, deleteAccount, getProviderCheckAccess, getSystemStatus, updateAccount, updateEmergencyContacts, updateProfile } from "../services/healthService";

const list = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
const num = (v) => (v === "" || v == null ? null : Number(v));
const tri = (v) => (v === "" ? null : v === "yes");
const providerLabels = { "not-configured": "not configured", rejected: "key rejected", "rate-limited": "rate limited", unavailable: "unavailable", available: "available (unverified)", "recently-working": "worked recently" };

function Section({ title, description, children }) {
  return (
    <section className="ui-card">
      <h2>{title}</h2>
      {description && <p className="ui-faint" style={{ marginTop: "-0.4rem", marginBottom: "1rem" }}>{description}</p>}
      {children}
    </section>
  );
}

function Saved({ status }) {
  if (!status) return null;
  return <span className={`ui-small ${status.ok ? "ui-muted" : ""}`} style={status.ok ? undefined : { color: "var(--ui-bad)" }} role="status">{status.text}</span>;
}

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const p = user?.profile || {};

  const [account, setAccount] = useState({ name: user?.name || "", gender: user?.gender || "other", dob: user?.dob || "" });
  const [health, setHealth] = useState({
    heightCm: p.heightCm ?? "",
    weightKg: p.weightKg ?? "",
    waistCm: p.waistCm ?? "",
    activityLevel: p.activityLevel ?? "",
    familyHistoryDiabetes: p.familyHistoryDiabetes ?? "",
    smoker: p.smoker == null ? "" : p.smoker ? "yes" : "no",
    hasDiabetes: p.hasDiabetes == null ? "" : p.hasDiabetes ? "yes" : "no",
    onBpMedication: p.onBpMedication == null ? "" : p.onBpMedication ? "yes" : "no",
    diet: p.diet ?? "",
    conditions: (p.conditions || []).join(", "),
    medications: (p.medications || []).join(", "),
    allergies: (p.allergies || []).join(", "),
  });
  const [contacts, setContacts] = useState(user?.emergencyContacts?.length ? user.emergencyContacts : []);
  const [status, setStatus] = useState({});
  const [system, setSystem] = useState(null);
  const [canCheckProviders, setCanCheckProviders] = useState(false);
  const [checkingProvider, setCheckingProvider] = useState(null);

  useEffect(() => {
    getSystemStatus().then((r) => setSystem(r.data)).catch(() => setSystem(null));
    if (user && !user.isGuest) {
      getProviderCheckAccess().then(() => setCanCheckProviders(true)).catch(() => setCanCheckProviders(false));
    }
  }, [user?.id, user?.isGuest]);

  const checkProvider = async (provider) => {
    setCheckingProvider(provider);
    setStatus((s) => ({ ...s, [provider]: null }));
    try {
      const { data } = await checkAiProvider(provider);
      const label = data.state === "working" ? `Working (${(data.latencyMs / 1000).toFixed(1)} s)` : providerLabels[data.state] || data.state;
      setStatus((s) => ({ ...s, [provider]: { ok: data.state === "working", text: label } }));
      const current = await getSystemStatus();
      setSystem(current.data);
    } catch (err) {
      setStatus((s) => ({ ...s, [provider]: { ok: false, text: errorMessage(err) } }));
    } finally {
      setCheckingProvider(null);
    }
  };

  const save = async (key, fn) => {
    setStatus((s) => ({ ...s, [key]: { ok: true, text: "Saving…" } }));
    try {
      const { data } = await fn();
      setUser(data);
      setStatus((s) => ({ ...s, [key]: { ok: true, text: "Saved" } }));
    } catch (err) {
      setStatus((s) => ({ ...s, [key]: { ok: false, text: errorMessage(err) } }));
    }
  };

  const saveAccount = (e) => {
    e.preventDefault();
    save("account", () => updateAccount({ name: account.name, gender: account.gender, dob: account.dob || null }));
  };

  const saveHealth = (e) => {
    e.preventDefault();
    save("health", () =>
      updateProfile({
        heightCm: num(health.heightCm),
        weightKg: num(health.weightKg),
        waistCm: num(health.waistCm),
        activityLevel: health.activityLevel || null,
        familyHistoryDiabetes: health.familyHistoryDiabetes || null,
        smoker: tri(health.smoker),
        hasDiabetes: tri(health.hasDiabetes),
        onBpMedication: tri(health.onBpMedication),
        diet: health.diet || null,
        conditions: list(health.conditions),
        medications: list(health.medications),
        allergies: list(health.allergies),
      })
    );
  };

  const saveContacts = (e) => {
    e.preventDefault();
    save("contacts", () => updateEmergencyContacts(contacts.map(({ name, phone, email, relation }) => ({ name, phone: phone || "", email: email || "", relation: relation || "" }))));
  };

  const removeAccount = async () => {
    if (!window.confirm("Delete your account and all of your health data permanently? This cannot be undone.")) return;
    try {
      await deleteAccount();
      logout();
      navigate("/", { replace: true });
    } catch (err) {
      setStatus((s) => ({ ...s, danger: { ok: false, text: errorMessage(err) } }));
    }
  };

  const h = (key) => ({ value: health[key], onChange: (e) => setHealth((x) => ({ ...x, [key]: e.target.value })) });
  const yesNo = (key) => (
    <select className="ui-select" {...h(key)}>
      <option value="">Not set</option>
      <option value="no">No</option>
      <option value="yes">Yes</option>
    </select>
  );

  return (
    <AppShell title="Profile & settings" subtitle="Your details, health profile and preferences.">
      {params.get("welcome") && (
        <div className="ui-alert ui-alert-info" style={{ marginBottom: "1rem" }}>
          <strong>Welcome! One step left.</strong>
          Fill in your health profile so your diabetes and heart risk scores can be calculated.
        </div>
      )}

      <div className="ui-grid ui-grid-2">
        <Section title="Account">
          <form className="ui-stack" onSubmit={saveAccount}>
            <label className="ui-field">
              <span>Name</span>
              <input className="ui-input" value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} required maxLength={80} />
            </label>
            <div className="ui-form-grid">
              <label className="ui-field">
                <span>Sex (used by the heart and waist formulas)</span>
                <select className="ui-select" value={account.gender} onChange={(e) => setAccount({ ...account, gender: e.target.value })}>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Prefer not to say</option>
                </select>
              </label>
              <label className="ui-field">
                <span>Date of birth</span>
                <input className="ui-input" type="date" max={new Date().toISOString().slice(0, 10)} value={account.dob || ""} onChange={(e) => setAccount({ ...account, dob: e.target.value })} />
              </label>
            </div>
            {!user?.isGuest && <p className="ui-faint">Signed in as {user?.email}</p>}
            <div className="ui-row">
              <button className="ui-btn ui-btn-primary">Save account</button>
              <Saved status={status.account} />
            </div>
          </form>
        </Section>

        <Section title="System status" description="What's live in this deployment.">
          {system ? (
            <ul className="ui-list">
              <li className="ui-row"><span>Database</span><span className="ui-spacer" /><span className={`ui-badge ${system.database === "connected" ? "ui-badge-good" : "ui-badge-bad"}`}>{system.database}</span></li>
              <li className="ui-row"><span>AI service</span><span className="ui-spacer" /><span className={`ui-badge ${system.ai.aiReady && system.ai.providers?.some((pr) => pr.state) ? "ui-badge-good" : system.ai.reachable ? "ui-badge-warn" : "ui-badge-bad"}`}>{!system.ai.reachable ? "unreachable" : !system.ai.providers?.some((pr) => pr.state) ? "status unavailable" : system.ai.aiReady ? "models available" : "no models available"}</span></li>
              {(system.ai.providers || []).map((pr) => (
                <li key={pr.provider} className="ui-row">
                  <span className="ui-faint">AI provider: {pr.provider}</span>
                  <span className="ui-spacer" />
                  <span className={`ui-badge ${pr.state === "recently-working" ? "ui-badge-good" : pr.state === "available" ? "ui-badge-warn" : ""}`}>{providerLabels[pr.state] || (pr.configured === false ? "not configured" : "status unavailable")}</span>
                  {canCheckProviders && <button type="button" className="ui-btn ui-btn-sm" onClick={() => checkProvider(pr.provider)} disabled={Boolean(checkingProvider) || pr.state === "not-configured"} title={`Test ${pr.provider} with a short request`}>{checkingProvider === pr.provider ? "Testing…" : "Test"}</button>}
                  <Saved status={status[pr.provider]} />
                </li>
              ))}
              <li className="ui-row"><span>Email (OTP, SOS)</span><span className="ui-spacer" /><span className={`ui-badge ${system.email === "configured" ? "ui-badge-good" : "ui-badge-warn"}`}>{system.email}</span></li>
            </ul>
          ) : (
            <div className="ui-loading"><span className="ui-spinner" /> Checking…</div>
          )}
        </Section>
      </div>

      <div style={{ height: "1rem" }} />

      <Section title="Health profile" description="Used for the Indian Diabetes Risk Score, Framingham heart risk and BMI. Leave anything you don't know as 'Not set'.">
        <form className="ui-stack" onSubmit={saveHealth}>
          <div className="ui-form-grid">
            <label className="ui-field"><span>Height (cm)</span><input className="ui-input" type="number" min="50" max="250" step="0.5" {...h("heightCm")} /></label>
            <label className="ui-field"><span>Weight (kg)</span><input className="ui-input" type="number" min="10" max="400" step="0.1" {...h("weightKg")} /></label>
            <label className="ui-field"><span>Waist at navel (cm)</span><input className="ui-input" type="number" min="30" max="250" step="0.5" {...h("waistCm")} /></label>
            <label className="ui-field">
              <span>Physical activity</span>
              <select className="ui-select" {...h("activityLevel")}>
                <option value="">Not set</option>
                <option value="sedentary">No exercise, desk work</option>
                <option value="mild">Mild exercise or light activity</option>
                <option value="moderate">Regular moderate exercise</option>
                <option value="vigorous">Vigorous exercise or manual work</option>
              </select>
            </label>
            <label className="ui-field">
              <span>Parents with diabetes</span>
              <select className="ui-select" {...h("familyHistoryDiabetes")}>
                <option value="">Not set</option>
                <option value="none">Neither</option>
                <option value="one_parent">One parent</option>
                <option value="both_parents">Both parents</option>
              </select>
            </label>
            <label className="ui-field">
              <span>Diet</span>
              <select className="ui-select" {...h("diet")}>
                <option value="">Not set</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="eggetarian">Eggetarian</option>
                <option value="non_vegetarian">Non-vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="jain">Jain</option>
              </select>
            </label>
            <label className="ui-field"><span>Do you smoke?</span>{yesNo("smoker")}</label>
            <label className="ui-field"><span>Diagnosed with diabetes?</span>{yesNo("hasDiabetes")}</label>
            <label className="ui-field"><span>On blood-pressure medicine?</span>{yesNo("onBpMedication")}</label>
          </div>
          <div className="ui-form-grid">
            <label className="ui-field"><span>Conditions (comma-separated)</span><input className="ui-input" placeholder="e.g. asthma, thyroid" {...h("conditions")} /></label>
            <label className="ui-field"><span>Medicines</span><input className="ui-input" placeholder="e.g. metformin" {...h("medications")} /></label>
            <label className="ui-field"><span>Allergies</span><input className="ui-input" placeholder="e.g. peanuts, penicillin" {...h("allergies")} /></label>
          </div>
          <div className="ui-row">
            <button className="ui-btn ui-btn-primary">Save health profile</button>
            <Saved status={status.health} />
          </div>
        </form>
      </Section>

      <div style={{ height: "1rem" }} />

      <Section title="Emergency contacts" description="When you press SOS, contacts with an email get an alert with your location; contacts with a phone get a one-tap WhatsApp/SMS message.">
        <form className="ui-stack" onSubmit={saveContacts}>
          {contacts.length === 0 && <div className="ui-empty">No contacts yet. Add at least one person who should hear from you in an emergency.</div>}
          {contacts.map((c, i) => (
            <div key={c.id || i} className="ui-form-grid" style={{ alignItems: "end" }}>
              {["name", "relation", "phone", "email"].map((field) => (
                <label key={field} className="ui-field">
                  <span>{field[0].toUpperCase() + field.slice(1)}</span>
                  <input
                    className="ui-input"
                    type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                    value={c[field] || ""}
                    required={field === "name"}
                    onChange={(e) => setContacts((list_) => list_.map((x, j) => (j === i ? { ...x, [field]: e.target.value } : x)))}
                  />
                </label>
              ))}
              <button type="button" className="ui-btn ui-btn-ghost" onClick={() => setContacts((l) => l.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          <div className="ui-row">
            {contacts.length < 5 && (
              <button type="button" className="ui-btn" onClick={() => setContacts((l) => [...l, { name: "", relation: "", phone: "", email: "" }])}>
                + Add contact
              </button>
            )}
            <button className="ui-btn ui-btn-primary">Save contacts</button>
            <Saved status={status.contacts} />
          </div>
        </form>
      </Section>

      <div style={{ height: "1rem" }} />

      <Section title="Session and data">
        <div className="ui-row">
          <button className="ui-btn" onClick={() => { logout(); navigate("/"); }}>Sign out</button>
          <div className="ui-spacer" />
          <button className="ui-btn ui-btn-danger" onClick={removeAccount}>Delete account and all data</button>
        </div>
        <Saved status={status.danger} />
      </Section>
    </AppShell>
  );
}
