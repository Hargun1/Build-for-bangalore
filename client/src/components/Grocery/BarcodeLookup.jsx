import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../../services/api";
import { logMeal, lookupBarcode } from "../../services/healthService";
import SourceBadge from "../Shared/SourceBadge";

// Official Nutri-Score colours; the letter is always shown too.
const NUTRI = { a: "#038141", b: "#85BB2F", c: "#FECB02", d: "#EE8100", e: "#E63E11" };
const NOVA = { 1: "Unprocessed or minimally processed", 2: "Processed culinary ingredient", 3: "Processed food", 4: "Ultra-processed food" };
const NUTRIENT_LABELS = {
  "energy-kcal": ["Energy", "kcal"],
  proteins: ["Protein", "g"],
  carbohydrates: ["Carbohydrates", "g"],
  sugars: ["  of which sugars", "g"],
  fat: ["Fat", "g"],
  "saturated-fat": ["  of which saturated", "g"],
  fiber: ["Fibre", "g"],
  salt: ["Salt", "g"],
};
const VERDICT = { good: ["ui-badge-good", "Good choice"], okay: ["ui-badge-warn", "In moderation"], limit: ["ui-badge-bad", "Limit"] };

function CameraScanner({ onCode, onClose }) {
  const videoRef = useRef(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [error, setError] = useState("");

  useEffect(() => {
    let controls;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints({ video: { facingMode: "environment" } }, videoRef.current, (result) => {
          if (result && !cancelled) {
            cancelled = true;
            controls?.stop();
            onCodeRef.current(result.getText());
          }
        });
      } catch (err) {
        setError(err?.name === "NotAllowedError" ? "Camera permission was denied. Type the number instead." : "Couldn't open the camera on this device. Type the number instead.");
      }
    })();
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="ui-stack">
      {error ? (
        <div className="ui-alert ui-alert-warn">{error}</div>
      ) : (
        <video ref={videoRef} className="ui-preview-img" muted playsInline aria-label="Camera preview for barcode scanning" />
      )}
      <p className="ui-faint">Hold the barcode flat and steady, about 15 cm from the camera.</p>
      <button className="ui-btn ui-btn-sm" onClick={onClose}>Stop camera</button>
    </div>
  );
}

export default function BarcodeLookup({ onLogged }) {
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [data, setData] = useState(null);
  const [grams, setGrams] = useState("");
  const [state, setState] = useState({ busy: false, error: "", logged: false });

  const lookup = async (raw) => {
    const digits = String(raw).replace(/\D/g, "");
    setCode(digits);
    setScanning(false);
    if (digits.length < 8) {
      setState({ busy: false, error: "A barcode has 8 to 14 digits.", logged: false });
      return;
    }
    setState({ busy: true, error: "", logged: false });
    setData(null);
    try {
      const res = await lookupBarcode(digits);
      setData(res.data);
      const serving = parseFloat(res.data.product.servingSize);
      setGrams(Number.isFinite(serving) ? String(serving) : "100");
      setState({ busy: false, error: "", logged: false });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err), logged: false });
    }
  };

  const decodeImage = async (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const result = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
      lookup(result.getText());
    } catch {
      setState({ busy: false, error: "No barcode found in that photo. Try a closer, sharper shot or type the number.", logged: false });
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const logServing = async () => {
    const g = Number(grams);
    const per = data.product.per100g;
    if (!g || g <= 0) return;
    const f = g / 100;
    const n = (key) => Math.round((per[key] || 0) * f * 10) / 10;
    try {
      await logMeal({
        mealType: "snack",
        title: data.product.name,
        source: "barcode",
        items: [{
          name: `${data.product.brand ? `${data.product.brand} ` : ""}${data.product.name}`.slice(0, 80),
          portion: `${g} g`,
          grams: g,
          calories: n("energy-kcal"),
          proteinG: n("proteins"),
          carbsG: n("carbohydrates"),
          fatG: n("fat"),
          fiberG: n("fiber"),
          sugarG: n("sugars"),
          sodiumMg: Math.round((per.sodium != null ? per.sodium : (per.salt || 0) / 2.5) * f * 1000),
        }],
      });
      setState((s) => ({ ...s, logged: true }));
      onLogged?.();
    } catch (err) {
      setState((s) => ({ ...s, error: errorMessage(err) }));
    }
  };

  const p = data?.product;
  const review = data?.review;

  return (
    <div className="ui-grid ui-grid-2" style={{ alignItems: "start" }}>
      <div className="ui-card ui-stack">
        <h2>Scan a packaged food</h2>
        {scanning ? (
          <CameraScanner onCode={lookup} onClose={() => setScanning(false)} />
        ) : (
          <>
            <button className="ui-btn ui-btn-primary ui-btn-lg" onClick={() => setScanning(true)}>Scan with camera</button>
            <label className="ui-btn">
              Scan from a photo
              <input type="file" accept="image/*" hidden onChange={(e) => { decodeImage(e.target.files[0]); e.target.value = ""; }} />
            </label>
          </>
        )}
        <form className="ui-row" onSubmit={(e) => { e.preventDefault(); lookup(code); }}>
          <input className="ui-input" style={{ flex: 1 }} inputMode="numeric" placeholder="or type the barcode, e.g. 8901058851298" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={14} aria-label="Barcode number" />
          <button className="ui-btn" disabled={state.busy}>Look up</button>
        </form>
        <p className="ui-faint">
          Label data comes from <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>Open Food Facts</a>, a free database maintained by volunteers. Some Indian products may be missing.
        </p>
      </div>

      <div className="ui-card ui-stack">
        {state.busy && <div className="ui-loading"><span className="ui-spinner" /> Looking up the product…</div>}
        {state.error && <div className="ui-alert ui-alert-error" role="alert">{state.error}</div>}
        {!p && !state.busy && !state.error && <div className="ui-empty"><strong>Product details appear here</strong>Nutri-Score, processing level, allergens, additives, nutrients and a review for you.</div>}

        {p && (
          <>
            <div className="ui-row" style={{ alignItems: "flex-start" }}>
              {p.image && <img src={p.image} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 72, height: 72, objectFit: "contain", borderRadius: 8, background: "#fff" }} />}
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0 }}>{p.name}</h2>
                <div className="ui-faint">{[p.brand, p.quantity].filter(Boolean).join(" · ")}</div>
                <div className="ui-row" style={{ marginTop: "0.5rem" }}>
                  {p.nutriScore ? (
                    <span className="ui-badge" style={{ background: NUTRI[p.nutriScore], color: p.nutriScore === "c" ? "#222" : "#fff", borderColor: "transparent" }}>Nutri-Score {p.nutriScore.toUpperCase()}</span>
                  ) : (
                    <span className="ui-badge">Nutri-Score not available</span>
                  )}
                  {p.novaGroup && <span className={`ui-badge ${p.novaGroup === 4 ? "ui-badge-bad" : p.novaGroup === 3 ? "ui-badge-warn" : "ui-badge-good"}`} title={NOVA[p.novaGroup]}>NOVA {p.novaGroup}: {NOVA[p.novaGroup]}</span>}
                </div>
              </div>
            </div>

            {review && (
              <div className="ui-alert ui-alert-info">
                <div className="ui-row" style={{ marginBottom: "0.3rem" }}>
                  <span className={`ui-badge ${VERDICT[review.verdict]?.[0]}`}>{VERDICT[review.verdict]?.[1]}</span>
                  <strong style={{ margin: 0 }}>{review.headline}</strong>
                  <div className="ui-spacer" />
                  <SourceBadge source={review.aiSource} />
                </div>
                {review.forYou && <p style={{ marginTop: "0.3rem" }}>{review.forYou}</p>}
                <div className="ui-grid ui-grid-2" style={{ marginTop: "0.5rem", gap: "0.5rem" }}>
                  {review.pros?.length > 0 && <div><strong className="ui-small">Good</strong><ul className="ui-bullets">{review.pros.map((x) => <li key={x}>{x}</li>)}</ul></div>}
                  {review.cons?.length > 0 && <div><strong className="ui-small">Watch out</strong><ul className="ui-bullets">{review.cons.map((x) => <li key={x}>{x}</li>)}</ul></div>}
                </div>
                {review.alternatives?.length > 0 && <p className="ui-small" style={{ marginTop: "0.5rem" }}>Try instead: {review.alternatives.join(", ")}</p>}
              </div>
            )}

            {p.allergens.length > 0 && <div className="ui-alert ui-alert-warn"><strong>Allergens</strong>{p.allergens.join(", ")}</div>}

            <table className="ui-table">
              <thead><tr><th>Per 100 g</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {Object.entries(NUTRIENT_LABELS).filter(([k]) => p.per100g[k] != null).map(([k, [label, unit]]) => (
                  <tr key={k}><td style={{ whiteSpace: "pre" }}>{label}</td><td className="num">{p.per100g[k]} {unit}</td></tr>
                ))}
              </tbody>
            </table>
            {p.additives.length > 0 && <p className="ui-faint">Additives: {p.additives.join(", ")}</p>}

            <div className="ui-row">
              <label className="ui-field" style={{ width: 130 }}>
                <span>Amount eaten (g)</span>
                <input className="ui-input" type="number" min="1" max="2000" value={grams} onChange={(e) => setGrams(e.target.value)} />
              </label>
              <button className="ui-btn ui-btn-primary" style={{ alignSelf: "flex-end" }} onClick={logServing} disabled={state.logged || !Number(grams) || p.per100g["energy-kcal"] == null}>
                {state.logged ? "Logged ✓" : "Log it as a snack"}
              </button>
            </div>
            <a className="ui-faint" href={p.sourceUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>View or correct this product on Open Food Facts</a>
          </>
        )}
      </div>
    </div>
  );
}
