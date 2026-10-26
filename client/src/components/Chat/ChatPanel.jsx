import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp, MessageCircle, Square, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { errorMessage } from "../../services/api";
import { sendChat } from "../../services/healthService";
import { StreamUnsupported, streamChat } from "../../services/stream";
import SourceBadge from "../Shared/SourceBadge";
import RichText from "./RichText";
import "./ChatPanel.css";

const SUGGESTIONS = {
  general: ["I've had a headache for 3 days, what could it be?", "How can I sleep better with a night shift?", "Is 135/88 blood pressure a problem?", "Simple stretches for back pain at a desk job"],
  nutrition: ["High-protein vegetarian breakfast ideas", "What should I eat if my sugar is borderline?", "Is curd rice good for dinner?", "Healthy snacks under 150 kcal"],
};

const storageKey = (mode, accountId) => `pranexus-chat-${accountId}-${mode}`;
const load = (mode, accountId) => {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(mode, accountId)) || "[]");
  } catch {
    return [];
  }
};

/** Conversation UI shared by the Health chat page and the Nutrition Q&A tab. */
export default function ChatPanel(props) {
  const { user } = useAuth();
  return <AccountChatPanel key={`${user?.id}:${props.mode || "general"}`} {...props} accountId={user?.id || "anonymous"} />;
}

function AccountChatPanel({ mode = "general", height = "calc(100dvh - 280px)", accountId }) {
  const [messages, setMessages] = useState(() => load(mode, accountId));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(mode, accountId), JSON.stringify(messages.slice(-30)));
    } catch {
      /* storage unavailable */
    }
    const container = endRef.current?.parentElement;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, mode, accountId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Replaces the last message (the assistant reply being written).
  const updateLast = (patch) =>
    setMessages((m) => {
      const copy = m.slice();
      copy[copy.length - 1] = { ...copy[copy.length - 1], ...(typeof patch === "function" ? patch(copy[copy.length - 1]) : patch) };
      return copy;
    });

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user", content }];
    const history = next.slice(-12).map(({ role, content: c }) => ({ role, content: c }));
    setMessages([...next, { role: "assistant", content: "", streaming: true }]);
    setInput("");
    setError("");
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const finish = (data) =>
      updateLast({ content: data.reply, redFlag: data.redFlag, source: data.aiSource, sources: data.sources || [], streaming: false });

    try {
      // Words appear as they are generated; the final event carries the citation-checked text.
      const data = await streamChat(history, mode, {
        signal: controller.signal,
        onDelta: (piece) => updateLast((last) => ({ content: last.content + piece })),
        onFlag: (redFlag) => updateLast({ redFlag }),
      });
      finish(data);
    } catch (err) {
      if (err.name === "AbortError") {
        updateLast((last) => ({ content: last.content ? `${last.content} …(stopped)` : "(stopped)", streaming: false }));
      } else if (err instanceof StreamUnsupported) {
        try {
          finish((await sendChat(history, mode)).data); // no streaming available: plain request
        } catch (inner) {
          fail(inner);
        }
      } else {
        fail(err);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }

    function fail(err) {
      setError(err.response ? errorMessage(err, "The assistant couldn't answer right now.") : err.message);
      // Remove the empty reply and put the question back so it can be retried in one click.
      setMessages((m) => m.slice(0, -2));
      setInput(content);
    }
  };

  const stop = () => abortRef.current?.abort();

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
            <MessageCircle className="cp-empty-icon" />
            <h2>{mode === "nutrition" ? "Ask about food" : "How can I help today?"}</h2>
            <p className="ui-muted">General health information, grounded in your profile.</p>
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
            {!(m.streaming && !m.content) && (
              <div className={`cp-bubble ${m.streaming ? "cp-streaming" : ""}`}>
                {m.role === "assistant" ? <RichText text={m.content} sources={m.sources} /> : m.content}
              </div>
            )}
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

        {busy && messages[messages.length - 1]?.streaming && !messages[messages.length - 1].content && (
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
          {busy ? (
            <button type="button" className="ui-btn ui-icon-btn" onClick={stop} aria-label="Stop response" title="Stop response"><Square /></button>
          ) : (
            <button className="ui-btn ui-btn-primary ui-icon-btn" disabled={!input.trim()} aria-label="Send" title="Send"><ArrowUp /></button>
          )}
          {messages.length > 0 && (
            <button type="button" className="ui-btn ui-btn-ghost ui-icon-btn" onClick={() => setMessages([])} disabled={busy} aria-label="Clear conversation" title="Clear conversation">
              <Trash2 />
            </button>
          )}
        </div>
      </form>
      <p className="ui-faint" style={{ marginTop: "0.4rem" }}>General information only, not a diagnosis. In an emergency call 112.</p>
    </div>
  );
}
