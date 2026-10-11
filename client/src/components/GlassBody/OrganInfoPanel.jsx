import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { ORGAN_INFO } from "./organInsights";

const LEVEL = { low: ["good", "healthy range"], moderate: ["warn", "watch"], high: ["bad", "high risk"] };
const RANK = { low: 1, moderate: 2, high: 3 };

/** Glass side panel for a clicked organ: the user's own numbers (lab results first), then general guidance. */
export default function OrganInfoPanel({ selectedOrgan, onClose, insights }) {
  const info = ORGAN_INFO[selectedOrgan];
  const rows = insights?.organs?.[selectedOrgan] || [];
  const worst = rows.reduce((w, r) => ((RANK[r.level] || 0) > (RANK[w] || 0) ? r.level : w), null);
  const hasLabs = rows.some((r) => r.lab);

  return (
    <AnimatePresence>
      {info && (
        <motion.aside
          key={selectedOrgan}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.25 }}
          className={`gb-panel gb-glass gb-tone-${worst ? LEVEL[worst][0] : "none"}`}
          aria-label={`${info.name} details`}
        >
          <header className="gb-panel-head">
            <span className="gb-panel-icon" aria-hidden="true">{info.icon}</span>
            <div>
              <h2>{info.name}</h2>
              <div className="gb-panel-sub">{worst ? `Overall: ${LEVEL[worst][1]}` : "No personal data yet"}</div>
            </div>
            <button className="gb-close" onClick={onClose} aria-label="Close">✕</button>
          </header>

          <h3 className="gb-eyebrow">Your numbers</h3>
          {insights?.loading ? (
            <div className="ui-loading"><span className="ui-spinner" /> Loading…</div>
          ) : rows.length ? (
            <ul className="gb-rows">
              {rows.map((r) => (
                <li key={r.label} className={r.level ? `gb-row-${LEVEL[r.level][0]}` : ""}>
                  <div className="gb-row-top">
                    <span className="gb-row-label">
                      {r.lab && <span className="gb-tag">LAB</span>}
                      {r.label}
                    </span>
                    {r.level && <span className={`ui-badge ui-badge-${LEVEL[r.level][0]}`}>{r.lab && r.status !== "normal" ? r.status : LEVEL[r.level][1]}</span>}
                  </div>
                  <strong className="gb-row-value">{r.value}</strong>
                  {r.hint && <div className="gb-row-hint">{r.hint}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="ui-faint">No personal data is linked to this organ yet.</p>
          )}

          <h3 className="gb-eyebrow">About</h3>
          <p className="gb-about">{info.about}</p>
          <h3 className="gb-eyebrow">Keep it healthy</h3>
          <ul className="gb-tips">{info.tips.map((t) => <li key={t}>{t}</li>)}</ul>

          <div className="gb-actions">
            <Link to="/labs" className="ui-btn ui-btn-sm">{hasLabs ? "Lab reports" : "Add a lab report"}</Link>
            <Link to="/dashboard" className="ui-btn ui-btn-sm">Risk analysis</Link>
            <Link to="/chat" className="ui-btn ui-btn-sm">Ask about it</Link>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
