import { useState, useRef, useEffect } from "react";
import "./HealthChat.css";
import { askHealthQuestion } from "../services/healthService";

const SYSTEM_PROMPT = `You are a helpful health assistant. Provide clear, concise medical information and guidance. 
Keep responses brief and actionable. Always recommend consulting a doctor for serious concerns.
Do not use emojis. Be professional but warm.`;

export default function HealthChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await askHealthQuestion({
        question: input.trim(),
        history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        systemPrompt: SYSTEM_PROMPT,
      });

      const data = response.data || {};

      const composedText = data.answer
        || [
          data.description,
          data.generalAdvice,
          data.disclaimer,
        ].filter(Boolean).join("\n\n");

      const assistantText = composedText || "I couldn't generate a response right now. Please try again.";

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: assistantText,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "Sorry, health chat is temporarily unavailable. Please try again shortly.",
        },
      ]);
      console.warn("Health chat request failed:", error?.message || error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="header-left">
          <h1>Health Assistant</h1>
          <span className="status">Online</span>
        </div>
        {messages.length > 0 && (
          <button className="clear-btn" onClick={clearChat}>
            Clear
          </button>
        )}
      </header>

      <main className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <h2>How can I help you today?</h2>
            <p>Ask me anything about your health, symptoms, medications, or wellness.</p>
            <div className="suggestions">
              {[
                "I have a persistent headache",
                "What's a healthy sleep schedule?",
                "Side effects of ibuprofen",
                "Tips for managing stress",
              ].map((suggestion, i) => (
                <button
                  key={i}
                  className="suggestion-btn"
                  onClick={() => setInput(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-content">
              {message.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message assistant">
            <div className="message-content loading">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      <footer className="chat-input-area">
        <div className="input-container">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            disabled={isLoading}
          />
          <button
            className="send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
        <p className="disclaimer">
          This is not medical advice. Consult a healthcare professional for diagnosis.
        </p>
      </footer>
    </div>
  );
}
