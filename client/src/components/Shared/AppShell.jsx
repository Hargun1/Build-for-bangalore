import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "../../styles/ui.css";

const LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/chat", label: "Health chat" },
  { to: "/grocery", label: "Nutrition" },
  { to: "/goals", label: "Goals" },
  { to: "/exposome", label: "Environment" },
  { to: "/wearable", label: "Vitals" },
  { to: "/appointments", label: "Doctors" },
  { to: "/glass-body", label: "Body" },
  { to: "/emergency", label: "SOS", className: "sos" },
];

/** Page frame for the app's inner pages: sticky nav, optional header, content. */
export default function AppShell({ title, subtitle, actions, children }) {
  const { user } = useAuth();
  return (
    <div className="ui-page">
      <header className="ui-topbar">
        <div className="ui-container ui-topbar-inner">
          <Link to="/dashboard" className="ui-brand">
            <span className="ui-brand-dot" />
            PranexusAI
          </Link>
          <nav className="ui-nav" aria-label="Main">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => `${isActive ? "active" : ""} ${l.className || ""}`}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <Link to="/profile" className="ui-btn ui-btn-sm" title="Profile and settings">
            {user?.isGuest ? "Guest" : (user?.name || "Profile").split(" ")[0]}
          </Link>
        </div>
      </header>
      <main className="ui-container">
        {(title || actions) && (
          <div className="ui-header ui-row" style={{ alignItems: "flex-end" }}>
            <div>
              {title && <h1>{title}</h1>}
              {subtitle && <p>{subtitle}</p>}
            </div>
            <div className="ui-spacer" />
            {actions}
          </div>
        )}
        {user?.isGuest && (
          <div className="ui-alert ui-alert-info" style={{ marginBottom: "1rem" }}>
            You're using a guest account. Everything works, but your data is deleted after 24 hours.{" "}
            <Link to="/register" style={{ textDecoration: "underline" }}>Create an account</Link> to keep it.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
