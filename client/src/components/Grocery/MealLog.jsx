import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../services/api";
import { deleteMeal, getMeals } from "../../services/healthService";
import { shortDay } from "../../utils/chartTheme";

export default function MealLog({ refreshKey }) {
  const [meals, setMeals] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    getMeals(7)
      .then((r) => setMeals(r.data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(load, [load, refreshKey]);

  const remove = async (id) => {
    try {
      await deleteMeal(id);
      setMeals((m) => m.filter((x) => x._id !== id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (error) return <div className="ui-alert ui-alert-error">{error}</div>;
  if (!meals) return <div className="ui-loading"><span className="ui-spinner" /> Loading meals…</div>;
  if (!meals.length) return <div className="ui-empty"><strong>No meals logged this week</strong>Analyse a meal photo or scan a barcode, then tap "Log".</div>;

  const byDay = meals.reduce((acc, m) => {
    (acc[m.day] = acc[m.day] || []).push(m);
    return acc;
  }, {});

  return (
    <div className="ui-stack">
      {Object.entries(byDay).map(([day, list]) => {
        const kcal = list.reduce((s, m) => s + (m.totals?.calories || 0), 0);
        const protein = list.reduce((s, m) => s + (m.totals?.proteinG || 0), 0);
        return (
          <div key={day} className="ui-card">
            <div className="ui-card-title">
              <h3>{shortDay(day)}</h3>
              <span className="ui-muted ui-small">{Math.round(kcal)} kcal · {Math.round(protein)} g protein</span>
            </div>
            <ul className="ui-list">
              {list.map((m) => (
                <li key={m._id} className="ui-row">
                  <span className="ui-badge">{m.mealType}</span>
                  <span>{m.title}</span>
                  <span className="ui-faint">{m.source === "barcode" ? "barcode" : "photo"}</span>
                  <div className="ui-spacer" />
                  <span className="ui-small">{Math.round(m.totals?.calories || 0)} kcal</span>
                  <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => remove(m._id)} aria-label={`Delete ${m.title}`}>Delete</button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
