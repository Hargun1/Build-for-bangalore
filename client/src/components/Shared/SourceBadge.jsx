/**
 * Shows where an answer came from, so AI output is never confused with rules or templates.
 * `source` is what the backend returns: "gemini:gemini-3.8-flash", "rules", "template",
 * "keywords", "safety-rules", ...
 */
export default function SourceBadge({ source }) {
  if (!source) return null;
  const [provider, model] = String(source).split(":");
  const labels = {
    rules: "Rule-based (AI unavailable)",
    template: "Template plan (AI unavailable)",
    keywords: "Keyword match (AI unavailable)",
    "safety-rules": "Safety rules",
    unavailable: "AI unavailable",
  };
  if (labels[provider]) {
    return <span className={`ui-badge ${provider === "safety-rules" ? "ui-badge-bad" : "ui-badge-warn"}`}>{labels[provider]}</span>;
  }
  const names = { gemini: "Gemini", groq: "Groq", openrouter: "OpenRouter" };
  return (
    <span className="ui-badge ui-badge-info" title={model ? `Model: ${model}` : undefined}>
      AI · {names[provider] || provider}
    </span>
  );
}
