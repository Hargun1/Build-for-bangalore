import { useState } from "react";
import AppShell from "../components/Shared/AppShell";
import MealAnalyzer from "../components/Grocery/MealAnalyzer";
import BarcodeLookup from "../components/Grocery/BarcodeLookup";
import GroceryScanner from "../components/Grocery/GroceryScanner";
import MealLog from "../components/Grocery/MealLog";
import ChatPanel from "../components/Chat/ChatPanel";

const TABS = [
  { id: "meal", label: "Meal photo" },
  { id: "barcode", label: "Barcode" },
  { id: "grocery", label: "Grocery bill" },
  { id: "log", label: "My meals" },
  { id: "ask", label: "Ask about food" },
];

export default function Grocery() {
  const [tab, setTab] = useState("meal");
  const [logVersion, setLogVersion] = useState(0);
  const logged = () => setLogVersion((v) => v + 1);

  return (
    <AppShell title="Nutrition" subtitle="Analyse a meal photo, check a packaged food by barcode, rate a grocery bill, and keep a food log that feeds your dashboard.">
      <div className="ui-tabs" role="tablist" style={{ marginBottom: "1rem" }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "meal" && <MealAnalyzer onLogged={logged} />}
      {tab === "barcode" && <BarcodeLookup onLogged={logged} />}
      {tab === "grocery" && <GroceryScanner />}
      {tab === "log" && <MealLog refreshKey={logVersion} />}
      {tab === "ask" && (
        <div className="ui-card">
          <ChatPanel mode="nutrition" height="calc(100vh - 300px)" />
        </div>
      )}
    </AppShell>
  );
}
