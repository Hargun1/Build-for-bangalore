import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Search } from "lucide-react";
import AppShell from "../components/Shared/AppShell";
import GlassBodyViewer from "../components/GlassBody/GlassBodyViewer";
import OrganInfoPanel from "../components/GlassBody/OrganInfoPanel";
import { useOrganInsights } from "../components/GlassBody/organInsights";
import { ANATOMY, organKeys, riskTone } from "../components/GlassBody/anatomyLayout";
import { useAuth } from "../context/AuthContext";
import "../components/GlassBody/GlassBody.css";

export default function GlassBody() {
  const { user } = useAuth();
  const [body, setBody] = useState(user?.gender === "female" ? "female" : "male");
  const [selected, setSelected] = useState("heart");
  const [query, setQuery] = useState("");
  const insights = useOrganInsights();
  const keys = useMemo(() => organKeys(body).filter((k) => `${ANATOMY[k].name} ${ANATOMY[k].system}`.toLowerCase().includes(query.toLowerCase())), [body, query]);
  return <AppShell className="body-page" title="Body explorer" subtitle="Anatomy and your related health measurements."
    actions={<div className="ui-tabs" role="tablist" aria-label="Body model">{["male","female"].map((b) => <button key={b} role="tab" aria-selected={body === b} className={body === b ? "active" : ""} onClick={() => { setBody(b); setSelected("heart"); }}>{b === "male" ? "Male" : "Female"}</button>)}</div>}>
    <div className="gb-statusbar"><span>{organKeys(body).length} anatomical regions</span><span className="ui-spacer" /><Link to="/labs"><FileText />{insights.labs?.count ? `${insights.labs.count} lab reports linked` : "Add lab results"}</Link></div>
    <div className="gb-layout">
      <aside className="gb-organ-sidebar">
        <label className="gb-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find an organ" aria-label="Find an organ" /></label>
        <nav className="gb-organ-list" aria-label="Organs">{keys.map((key, i) => <div key={key}>
          {(i === 0 || ANATOMY[key].system !== ANATOMY[keys[i-1]].system) && <h2 className="gb-system">{ANATOMY[key].system}</h2>}
          <button className={`gb-organ ${selected === key ? "active" : ""}`} aria-pressed={selected === key} onClick={() => setSelected(key)}><span className={`gb-dot gb-${riskTone(insights.riskScores?.[key])}`} />{ANATOMY[key].name}</button>
        </div>)}</nav>
        {!keys.length && <p className="ui-faint" style={{ padding: 16 }}>No matching organs.</p>}
      </aside>
      <GlassBodyViewer key={body} body={body} insights={insights} selectedOrgan={selected} onSelectOrgan={setSelected} />
      <OrganInfoPanel selectedOrgan={selected} insights={insights} onClose={() => setSelected(null)} />
    </div>
    <div className="gb-footer">
      <div className="gb-legend">{[["good","Within range"],["warn","Watch"],["bad","High risk"],["none","No linked assessment"]].map(([tone,label]) => <span key={tone}><i className={`gb-dot gb-${tone}`} />{label}</span>)}</div>
      <p>Educational reference, not a scan of your body or a diagnosis. Both views share a reference skeleton; the female view includes pelvic organs.</p>
      <p>3D assets: adimed, 3DRT STUDIOS, DEGUIDER, ElliotSS, Ruslan Gadzhiev, Safiya and neshallads, CC BY 4.0. <a href="https://github.com/Hargun1/Build-for-bangalore#data-and-credits" target="_blank" rel="noreferrer">Credits</a>. Additional organs are simplified reference shapes.</p>
    </div>
  </AppShell>;
}
