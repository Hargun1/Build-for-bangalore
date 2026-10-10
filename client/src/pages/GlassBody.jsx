import { useState } from "react";
import AppShell from "../components/Shared/AppShell";
import GlassBodyViewer from "../components/GlassBody/GlassBodyViewer";
import GlassBodyViewerFemale from "../components/GlassBody/GlassBodyViewerFemale";
import { useOrganInsights } from "../components/GlassBody/organInsights";
import { useAuth } from "../context/AuthContext";

export default function GlassBody() {
  const { user } = useAuth();
  const [body, setBody] = useState(user?.gender === "female" ? "female" : "male");
  const insights = useOrganInsights();

  return (
    <AppShell
      title="Your body"
      subtitle="Click an organ to see your own related numbers. Colours come from your latest risk analysis, logs and air quality."
      actions={
        <div className="ui-tabs" role="tablist" aria-label="Body model">
          <button role="tab" aria-selected={body === "male"} className={body === "male" ? "active" : ""} onClick={() => setBody("male")}>Male model</button>
          <button role="tab" aria-selected={body === "female"} className={body === "female" ? "active" : ""} onClick={() => setBody("female")}>Female model</button>
        </div>
      }
    >
      {!insights.loading && !insights.analysedAt && (
        <div className="ui-alert ui-alert-info" style={{ marginBottom: "0.75rem" }}>
          Run the risk analysis on your dashboard to colour the organs. Until then they show blue (no data).
        </div>
      )}
      <div style={{ position: "relative", height: "calc(100vh - 200px)", minHeight: 480, borderRadius: 14, overflow: "hidden", border: "1px solid var(--ui-border)" }}>
        {body === "male" ? <GlassBodyViewer insights={insights} /> : <GlassBodyViewerFemale insights={insights} />}
      </div>
      <p className="ui-faint" style={{ marginTop: "0.6rem" }}>
        3D models from Sketchfab under CC BY 4.0 by adimed, 3DRT STUDIOS, DEGUIDER, ElliotSS, Ruslan Gadzhiev, Safiya and neshallads.{" "}
        <a href="https://github.com/Hargun1/Build-for-bangalore#data-and-credits" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>Full credits</a>
      </p>
    </AppShell>
  );
}
