import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../services/api";
import { sendChat } from "../../services/healthService";
import SourceBadge from "../Shared/SourceBadge";
import RichText from "./RichText";
import "./ChatPanel.css";

const SUGGESTIONS = {
  general: ["I've had a headache for 3 days, what could it be?", "How can I sleep better with a night shift?", "Is 135/88 blood pressure a problem?", "Simple stretches for back pain at a desk job"],
  nutrition: ["High-protein vegetarian breakfast ideas", "What should I eat if my sugar is borderline?", "Is curd rice good for dinner?", "Healthy snacks under 150 kcal"],
};

const storageKey = (mode) => `pranexus-chat-${mode}`;
const load = (mode) => {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(mode)) || "[]");
  } catch {
    return [];
  }
};

/** Conversation UI shared by the Health chat page and the Nutrition Q&A tab. */
export default function ChatPanel({ mode = "general", height = "calc(100vh - 230px)" }) {
  const [messages, setMessages] = useState(() => load(mode));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(mode), JSON.stringify(messages.slice(-30)));
    } catch {
      /* storage unavailable */
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, mode]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setError("");
    setBusy(true);
    try {
      const history = next.slice(-12).map(({ role, content: c }) => ({ role, content: c }));
      const { data } = await sendChat(history, mode);
      setMessages((m) => [...m, { role: "assistant", content: data.reply, redFlag: data.redFlag, source: data.aiSource, sources: data.sources || [] }]);
    } catch (err) {
      setError(errorMessage(err, "The assistant couldn't answer right now."));
      // Put the question back so the user can retry with one click.
      setMessages((m) => m.slice(0, -1));
      setInput(content);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="cp" style={{ height }}>
      <div className="cp-messages" aria-live="polite">
        {messages.length === 0 && (
          <div className="cp-empty">
            <h2>{mode === "nutrition" ? "Ask about food" : "How can I help today?"}</h2>
            <p className="ui-muted">Answers use your profile and recent logs. Warning signs of an emergency are always checked first.</p>
            <div className="cp-suggestions">
              {SUGGESTIONS[mode].map((s) => (
                <button key={s} type="button" className="ui-btn ui-btn-sm" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`cp-msg cp-${m.role}`}>
            {m.redFlag && (
              <div className={`ui-alert ${m.redFlag.level === "urgent" ? "ui-alert-warn" : "ui-alert-emergency"}`} role="alert" style={{ marginBottom: "0.5rem" }}>
                <strong>{m.redFlag.title}</strong>
                <div className="ui-row" style={{ marginTop: "0.5rem" }}>
                  {m.redFlag.actions.map((a) =>
                    a.href.startsWith("/") ? (
                      <Link key={a.label} to={a.href} className="ui-btn ui-btn-sm">{a.label}</Link>
                    ) : (
                      <a key={a.label} href={a.href} className="ui-btn ui-btn-danger ui-btn-sm">{a.label}</a>
                    )
                  )}
                </div>
              </div>
            )}
            <div className="cp-bubble">{m.role === "assistant" ? <RichText text={m.content} sources={m.sources} /> : m.content}</div>
            {m.sources?.length > 0 && (
              <div className="cp-sources">
                <span className="ui-faint">Sources</span>
                <ol>
                  {m.sources.map((s) => (
                    <li key={s.n} value={s.n}>
                      <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> <span className="ui-faint">· MedlinePlus (NIH)</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {m.role === "assistant" && m.source && (
              <div className="cp-meta">
                <SourceBadge source={m.source} />
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="cp-msg cp-assistant">
            <div className="cp-bubble cp-typing" aria-label="Assistant is typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="ui-alert ui-alert-error" role="alert" style={{ margin: "0 0 0.5rem" }}>
          {error}
        </div>
      )}

      <form
        className="cp-input"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          className="ui-textarea"
          rows={2}
          value={input}
          maxLength={4000}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={mode === "nutrition" ? "Ask about a food, diet or meal…" : "Describe a symptom or ask a health question…"}
          aria-label="Your message"
        />
        <div className="ui-stack" style={{ gap: "0.4rem" }}>
          <button className="ui-btn ui-btn-primary" disabled={busy || !input.trim()}>Send</button>
          {messages.length > 0 && (
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setMessages([])} disabled={busy}>
              Clear
            </button>
          )}
        </div>
      </form>
      <p className="ui-faint" style={{ marginTop: "0.4rem" }}>General information only, not a diagnosis. In an emergency call 112.</p>
    </div>
  );
}
