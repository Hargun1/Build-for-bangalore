import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, Camera, ScanBarcode, ReceiptText, MessageCircle, Check } from "lucide-react";
import AppShell from "../components/Shared/AppShell";
import MealAnalyzer from "../components/Grocery/MealAnalyzer";
import BarcodeLookup from "../components/Grocery/BarcodeLookup";
import GroceryScanner from "../components/Grocery/GroceryScanner";
import MealLog from "../components/Grocery/MealLog";
import ChatPanel from "../components/Chat/ChatPanel";

const TABS = [
  { id: "log", label: "Food diary", icon: BookOpen },
  { id: "meal", label: "Meal photo", icon: Camera },
  { id: "barcode", label: "Barcode", icon: ScanBarcode },
  { id: "grocery", label: "Groceries", icon: ReceiptText },
  { id: "ask", label: "Food questions", icon: MessageCircle },
];

export default function Grocery() {
  const [params, setParams] = useSearchParams();
  const candidate = params.get("tab") || "log";
  const tab = TABS.some((t) => t.id === candidate) ? candidate : "log";
  const [logVersion, setLogVersion] = useState(0);
  const [saved, setSaved] = useState(false);
  const logged = () => { setLogVersion((v) => v + 1); setSaved(true); setParams({ tab: "log" }); };
  return <AppShell title="Food & nutrition" subtitle="Your meals, one day at a time."
    actions={tab !== "meal" && <button className="ui-btn ui-btn-primary" onClick={() => setParams({ tab: "meal" })}><Camera /> Add a meal</button>}>
    <div className="ui-tabs" role="tablist" aria-label="Nutrition views" style={{ marginBottom: 24 }}>{TABS.map(({ id, label, icon: Icon }) => <button key={id} role="tab" id={`food-tab-${id}`} aria-controls="food-panel" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => { setParams({ tab: id }); setSaved(false); }}><Icon />{label}</button>)}</div>
    {saved && <div className="ui-alert ui-row" role="status" style={{ marginBottom: 20 }}><Check /> Meal saved to your diary.</div>}
    <div id="food-panel" role="tabpanel" aria-labelledby={`food-tab-${tab}`}>
      {tab === "meal" && <MealAnalyzer onLogged={logged} />}
      {tab === "barcode" && <BarcodeLookup onLogged={logged} />}
      {tab === "grocery" && <GroceryScanner />}
      {tab === "log" && <MealLog refreshKey={logVersion} />}
      {tab === "ask" && <ChatPanel mode="nutrition" height="calc(100dvh - 340px)" />}
    </div>
  </AppShell>;
}
