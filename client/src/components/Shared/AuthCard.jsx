import { Brand } from "./AppShell";
import "../../styles/ui.css";

export default function AuthCard({ title, subtitle, children, footer }) {
  return <div className="ui-page auth-page">
    <Brand />
    <main className="auth-form"><h1>{title}</h1>{subtitle && <p className="auth-subtitle">{subtitle}</p>}{children}{footer && <div className="auth-footer">{footer}</div>}</main>
    <p className="auth-legal">PranexusAI · Personal health, in one place.<br />Health information is not a medical diagnosis.</p>
  </div>;
}
