import { Link } from "react-router-dom";
import "../../styles/ui.css";

export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="ui-page" style={{ display: "grid", placeItems: "center", padding: "2rem 1rem" }}>
      <div className="ui-card" style={{ width: "min(440px, 100%)", padding: "1.75rem" }}>
        <Link to="/" className="ui-brand" style={{ marginBottom: "1.25rem" }}>
          <span className="ui-brand-dot" />
          PranexusAI
        </Link>
        <h1 style={{ fontSize: "1.4rem", marginBottom: "0.35rem" }}>{title}</h1>
        {subtitle && <p className="ui-muted ui-small" style={{ marginBottom: "1.25rem", lineHeight: 1.5 }}>{subtitle}</p>}
        {children}
        {footer && <div className="ui-faint" style={{ marginTop: "1.25rem", textAlign: "center" }}>{footer}</div>}
      </div>
    </div>
  );
}
