import { Link } from "react-router-dom";
import { ArrowUpRight, Activity, X } from "lucide-react";
import { ORGAN_INFO } from "./organInsights";
import { ANATOMY } from "./anatomyLayout";

const LEVEL = { low: ["good", "Within range"], moderate: ["warn", "Watch"], high: ["bad", "High risk"] };

export default function OrganInfoPanel({ selectedOrgan, onClose, insights }) {
  const info = ORGAN_INFO[selectedOrgan];
  const anatomy = ANATOMY[selectedOrgan];
  const rows = insights?.organs?.[selectedOrgan] || [];
  if (!info || !anatomy) return <aside className="gb-panel"><Activity /><h2>Organ details</h2><p className="ui-muted">No organ selected.</p></aside>;
  return <aside className="gb-panel" aria-label={`${anatomy.name} details`}>
    <header className="gb-panel-head"><div><span className="gb-system">{anatomy.system}</span><h2>{anatomy.name}</h2></div><button className="ui-btn ui-btn-ghost ui-icon-btn" aria-label="Close organ details" title="Close organ details" onClick={onClose}><X /></button></header>
    <p className="gb-about">{info.about}</p>
    <h3 className="gb-section-title">Related measurements</h3>
    {insights?.loading ? <div className="ui-loading"><span className="ui-spinner" /> Loading...</div> : rows.length ? <ul className="gb-rows">{rows.map((r) => <li key={r.label}>
      <div className="gb-row-top"><span>{r.label}</span>{r.level && LEVEL[r.level] && <span className={`ui-badge ui-badge-${LEVEL[r.level][0]}`}>{r.lab && r.status !== "normal" ? r.status : LEVEL[r.level][1]}</span>}</div>
      <strong>{r.value}</strong>{r.hint && <p>{r.hint}</p>}
    </li>)}</ul> : <div className="gb-no-data"><Activity /><p>No linked measurements</p><small>No health status has been inferred for this organ.</small></div>}
    {info.tips?.length > 0 && <><h3 className="gb-section-title">General guidance</h3><ul className="gb-tips">{info.tips.map((t) => <li key={t}>{t}</li>)}</ul></>}
    <div className="gb-actions"><Link to="/labs">Lab reports <ArrowUpRight /></Link><Link to="/chat">Health chat <ArrowUpRight /></Link></div>
  </aside>;
}
