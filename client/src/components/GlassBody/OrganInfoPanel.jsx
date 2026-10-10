import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { ORGAN_INFO } from "./organInsights";
import "../../styles/ui.css";

const LEVEL = { low: ["ui-badge-good", "healthy range"], moderate: ["ui-badge-warn", "watch"], high: ["ui-badge-bad", "high risk"] };

/** Side panel for a clicked organ: the user's own related numbers, then general guidance. */
export default function OrganInfoPanel({ selectedOrgan, onClose, insights }) {
  const info = ORGAN_INFO[selectedOrgan];
  const rows = insights?.organs?.[selectedOrgan] || [];

  return (
    <AnimatePresence>
      {info && (
        <motion.aside
          key={selectedOrgan}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.25 }}
          className="ui-card"
          style={{ position: "absolute", top: 72, right: 16, width: "min(360px, calc(100% - 32px))", maxHeight: "calc(100% - 96px)", overflowY: "auto", background: "rgba(10, 13, 20, 0.92)", backdropFilter: "blur(12px)", zIndex: 30 }}
          aria-label={`${info.name} details`}
        >
          <div className="ui-row" style={{ marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }} aria-hidden="true">{info.icon}</span>
            <h2 style={{ margin: 0 }}>{info.name}</h2>
            <div className="ui-spacer" />
            <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={onClose} aria-label="Close">✕</button>
          </div>

          <h3 className="ui-small" style={{ marginBottom: "0.4rem" }}>Your numbers</h3>
          {insights?.loading ? (
            <div className="ui-loading"><span className="ui-spinner" /> Loading…</div>
          ) : rows.length ? (
            <ul className="ui-list" style={{ marginBottom: "1rem" }}>
              {rows.map((r) => (
                <li key={r.label}>
                  <div className="ui-row">
                    <span className="ui-small">{r.label}</span>
                    <div className="ui-spacer" />
                    {r.level && <span className={`ui-badge ${LEVEL[r.level][0]}`}>{LEVEL[r.level][1]}</span>}
                  </div>
                  <strong>{r.value}</strong>
                  {r.hint && <div className="ui-faint">{r.hint}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="ui-faint" style={{ marginBottom: "1rem" }}>No personal data is linked to this organ yet.</p>
          )}

          <h3 className="ui-small" style={{ marginBottom: "0.4rem" }}>About</h3>
          <p className="ui-small ui-muted" style={{ lineHeight: 1.55, marginBottom: "0.75rem" }}>{info.about}</p>
          <h3 className="ui-small" style={{ marginBottom: "0.4rem" }}>Keep it healthy</h3>
          <ul className="ui-bullets ui-small">{info.tips.map((t) => <li key={t}>{t}</li>)}</ul>

          <div className="ui-row" style={{ marginTop: "1rem" }}>
            <Link to="/dashboard" className="ui-btn ui-btn-sm">Run risk analysis</Link>
            <Link to="/chat" className="ui-btn ui-btn-sm">Ask about it</Link>
          </div>
          <p className="ui-faint" style={{ marginTop: "0.75rem" }}>Colours: green healthy range, amber watch, red high risk, blue no data yet.</p>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
