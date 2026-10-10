import { useState } from "react";
import { errorMessage } from "../../services/api";
import { analyzeGroceryPhoto } from "../../services/healthService";
import SourceBadge from "../Shared/SourceBadge";
import PhotoPicker from "./PhotoPicker";

const GROUPS = [
  { key: "good", label: "Good picks", badge: "ui-badge-good" },
  { key: "moderate", label: "Fine in moderation", badge: "ui-badge-warn" },
  { key: "limit", label: "Limit these", badge: "ui-badge-bad" },
];
const PROCESSING = { whole: "Whole food", minimally_processed: "Minimally processed", processed: "Processed", ultra_processed: "Ultra-processed" };

export default function GroceryScanner() {
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [state, setState] = useState({ busy: false, error: "" });

  const analyze = async (img) => {
    setImage(img);
    setResult(null);
    setState({ busy: true, error: "" });
    try {
      const { data } = await analyzeGroceryPhoto(img);
      setResult(data);
      setState({ busy: false, error: "" });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err, "Couldn't read that photo.") });
    }
  };

  return (
    <div className="ui-grid ui-grid-2" style={{ alignItems: "start" }}>
      <div className="ui-card ui-stack">
        <h2>Grocery bill, list or bag</h2>
        {image ? (
          <>
            <img src={image} alt="Your groceries" className="ui-preview-img" />
            <div className="ui-row">
              <button className="ui-btn ui-btn-sm" onClick={() => { setImage(null); setResult(null); setState({ busy: false, error: "" }); }} disabled={state.busy}>Use another photo</button>
              {state.error && <button className="ui-btn ui-btn-sm ui-btn-primary" onClick={() => analyze(image)}>Try again</button>}
            </div>
          </>
        ) : (
          <PhotoPicker title="Photograph a receipt, list or your shopping" hint="Handwritten lists and printed bills (BigBasket, Zepto, DMart…) both work." onPicked={analyze} />
        )}
      </div>

      <div className="ui-card ui-stack">
        {state.busy && <div className="ui-loading"><span className="ui-spinner" /> Reading items and checking each one…</div>}
        {state.error && <div className="ui-alert ui-alert-error" role="alert">{state.error}</div>}
        {!result && !state.busy && !state.error && (
          <div className="ui-empty"><strong>Basket report appears here</strong>Every item rated for you, how processed it is, and what's missing from the basket.</div>
        )}
        {result && !result.isGrocery && <div className="ui-alert ui-alert-warn">{result.message}</div>}
        {result?.isGrocery && (
          <>
            <div className="ui-row">
              <div className="ui-stat" style={{ minWidth: 150 }}>
                <div className="ui-stat-label">Basket score</div>
                <div className="ui-stat-value">{result.score}<small>/100</small></div>
                <div className="ui-stat-sub">{result.items.length} items · {result.counts.good} good · {result.counts.limit} to limit</div>
              </div>
              <div className="ui-spacer" />
              <SourceBadge source={result.aiSource} />
            </div>
            <p style={{ lineHeight: 1.55 }}>{result.summary}</p>
            {result.missing?.length > 0 && <div className="ui-alert ui-alert-info"><strong>Worth adding</strong>{result.missing.join(", ")}</div>}
            {GROUPS.map((g) => {
              const items = result.items.filter((i) => i.verdict === g.key);
              if (!items.length) return null;
              return (
                <div key={g.key}>
                  <div className="ui-row" style={{ marginBottom: "0.4rem" }}>
                    <span className={`ui-badge ${g.badge}`}>{g.label}</span>
                    <span className="ui-faint">{items.length}</span>
                  </div>
                  <ul className="ui-list">
                    {items.map((i, idx) => (
                      <li key={`${i.name}-${idx}`}>
                        <div className="ui-row">
                          <strong>{i.name}</strong>
                          <span className="ui-faint">{i.category}</span>
                          <div className="ui-spacer" />
                          <span className="ui-badge">{PROCESSING[i.processing]}</span>
                        </div>
                        {i.reason && <p className="ui-small ui-muted" style={{ marginTop: "0.25rem" }}>{i.reason}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            <p className="ui-faint">Processing levels follow the NOVA classification idea; ratings are AI judgements for your profile.</p>
          </>
        )}
      </div>
    </div>
  );
}
