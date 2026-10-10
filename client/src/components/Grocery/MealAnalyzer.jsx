import { useMemo, useState } from "react";
import { errorMessage } from "../../services/api";
import { analyzeMealPhoto, logMeal } from "../../services/healthService";
import SourceBadge from "../Shared/SourceBadge";
import PhotoPicker from "./PhotoPicker";

const KEYS = ["calories", "proteinG", "carbsG", "fatG", "fiberG", "sugarG", "sodiumMg"];
const r1 = (n) => Math.round(n * 10) / 10;

function defaultMealType() {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 19) return "snack";
  return "dinner";
}

function scoreBadge(score) {
  if (score >= 7) return "ui-badge-good";
  if (score >= 4) return "ui-badge-warn";
  return "ui-badge-bad";
}

export default function MealAnalyzer({ onLogged }) {
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [included, setIncluded] = useState([]);
  const [mealType, setMealType] = useState(defaultMealType);
  const [state, setState] = useState({ busy: false, error: "", saved: false });

  const analyze = async (img) => {
    setImage(img);
    setResult(null);
    setState({ busy: true, error: "", saved: false });
    try {
      const { data } = await analyzeMealPhoto(img);
      setResult(data);
      setIncluded(data.items ? data.items.map(() => true) : []);
      setState({ busy: false, error: "", saved: false });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err, "Couldn't analyse that photo."), saved: false });
    }
  };

  // Totals follow the items the user keeps ticked (e.g. untick the side they didn't eat).
  const totals = useMemo(() => {
    if (!result?.items) return null;
    const kept = result.items.filter((_, i) => included[i]);
    return Object.fromEntries(KEYS.map((k) => [k, r1(kept.reduce((s, it) => s + (it[k] || 0), 0))]));
  }, [result, included]);

  const save = async () => {
    const items = result.items.filter((_, i) => included[i]);
    if (!items.length) return;
    setState((s) => ({ ...s, busy: true, error: "" }));
    try {
      await logMeal({ mealType, title: result.title, items: items.map(({ group, ...rest }) => rest), healthScore: result.healthScore, source: "photo" });
      setState({ busy: false, error: "", saved: true });
      onLogged?.();
    } catch (err) {
      setState({ busy: false, error: errorMessage(err), saved: false });
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setState({ busy: false, error: "", saved: false });
  };

  return (
    <div className="ui-grid ui-grid-2" style={{ alignItems: "start" }}>
      <div className="ui-card ui-stack">
        <h2>Meal photo</h2>
        {image ? (
          <>
            <img src={image} alt="Your meal" className="ui-preview-img" />
            <div className="ui-row">
              <button className="ui-btn ui-btn-sm" onClick={reset} disabled={state.busy}>Use another photo</button>
              {state.error && <button className="ui-btn ui-btn-sm ui-btn-primary" onClick={() => analyze(image)}>Try again</button>}
            </div>
          </>
        ) : (
          <PhotoPicker title="Photograph your plate" hint="Top-down, good light, whole plate in frame. Works with Indian dishes." onPicked={analyze} />
        )}
        <p className="ui-faint">Photos are sent to an AI vision model for analysis and are not stored.</p>
      </div>

      <div className="ui-card ui-stack">
        {state.busy && !result && <div className="ui-loading"><span className="ui-spinner" /> Recognising food and estimating nutrients…</div>}
        {state.error && <div className="ui-alert ui-alert-error" role="alert">{state.error}</div>}
        {!state.busy && !result && !state.error && (
          <div className="ui-empty">
            <strong>Results appear here</strong>
            Each item with its portion, calories, protein, carbs, fat, fibre, sugar and salt, plus a meal score with reasons.
          </div>
        )}

        {result && !result.isFood && <div className="ui-alert ui-alert-warn">{result.message}</div>}

        {result?.isFood && totals && (
          <>
            <div className="ui-row">
              <h2 style={{ margin: 0 }}>{result.title}</h2>
              <div className="ui-spacer" />
              <SourceBadge source={result.aiSource} />
            </div>
            <div className="ui-row">
              <span className={`ui-badge ${scoreBadge(result.healthScore)}`}>Meal score {result.healthScore}/10</span>
              <span className="ui-badge">{result.confidence} confidence</span>
            </div>
            {result.scoreReasons?.length > 0 && <p className="ui-faint">Why: {result.scoreReasons.join(", ")}</p>}

            <div className="ui-grid ui-grid-4">
              <div className="ui-stat"><div className="ui-stat-label">Calories</div><div className="ui-stat-value">{Math.round(totals.calories)}<small>kcal</small></div></div>
              <div className="ui-stat"><div className="ui-stat-label">Protein</div><div className="ui-stat-value">{totals.proteinG}<small>g</small></div></div>
              <div className="ui-stat"><div className="ui-stat-label">Carbs</div><div className="ui-stat-value">{totals.carbsG}<small>g</small></div></div>
              <div className="ui-stat"><div className="ui-stat-label">Fat</div><div className="ui-stat-value">{totals.fatG}<small>g</small></div></div>
            </div>
            <p className="ui-faint">Fibre {totals.fiberG} g · sugar {totals.sugarG} g · sodium {Math.round(totals.sodiumMg)} mg</p>

            <div style={{ overflowX: "auto" }}>
              <table className="ui-table">
                <thead>
                  <tr><th>Eaten</th><th>Item</th><th>Portion</th><th className="num">kcal</th><th className="num">Protein g</th><th className="num">Carbs g</th></tr>
                </thead>
                <tbody>
                  {result.items.map((it, i) => (
                    <tr key={i} style={{ opacity: included[i] ? 1 : 0.45 }}>
                      <td>
                        <input type="checkbox" checked={included[i]} aria-label={`Include ${it.name}`} onChange={() => setIncluded((arr) => arr.map((v, j) => (j === i ? !v : v)))} />
                      </td>
                      <td>{it.name}</td>
                      <td className="ui-muted">{it.portion || `${Math.round(it.grams)} g`}</td>
                      <td className="num">{Math.round(it.calories)}</td>
                      <td className="num">{r1(it.proteinG)}</td>
                      <td className="num">{r1(it.carbsG)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result.advice && <div className="ui-alert ui-alert-info">{result.advice}</div>}
            {result.swaps?.length > 0 && (
              <div>
                <strong className="ui-small">Healthier swaps</strong>
                <ul className="ui-bullets" style={{ marginTop: "0.3rem" }}>{result.swaps.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            )}
            <p className="ui-faint">{result.disclaimer}</p>

            <div className="ui-row">
              <select className="ui-select" style={{ width: "auto" }} value={mealType} onChange={(e) => setMealType(e.target.value)} aria-label="Meal type">
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="snack">Snack</option>
                <option value="dinner">Dinner</option>
              </select>
              <button className="ui-btn ui-btn-primary" onClick={save} disabled={state.busy || state.saved || !included.some(Boolean)}>
                {state.saved ? "Logged ✓" : "Log this meal"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
