import { Clock, HeartPulse } from "lucide-react";

export default function FirstAidGuide({ emergencyType, steps = [] }) {
  if (!steps.length) return <div className="ui-empty"><HeartPulse size={28} /><p>No first-aid guide selected.</p></div>;
  return <div className="firstaid-guide">
    <h3>{emergencyType}</h3>
    <p className="ui-muted ui-small">While waiting for professional help.</p>
    <ol className="firstaid-steps">
      {steps.map((step, i) => <li key={i}>
        <span className="firstaid-number">{step.step}</span>
        <div><h4>{step.title}</h4><p>{step.desc}</p>{step.timer && <span className="firstaid-timer"><Clock size={14} />{step.timer}</span>}</div>
      </li>)}
    </ol>
  </div>;
}
