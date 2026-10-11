import { API_BASE, tokenStore } from "./api";

export class StreamUnsupported extends Error {}

/**
 * POST /api/chat/stream and read the server-sent events as they arrive.
 * Calls onDelta(text) for each new piece and onFlag(redFlag) for an early warning
 * banner; resolves with the final `done` payload. Rejects with the server's message
 * on an `error` event, or StreamUnsupported if the endpoint can't stream at all.
 */
export async function streamChat(messages, mode, { onDelta, onFlag, signal } = {}) {
  const token = tokenStore.get();
  let res;
  try {
    res = await fetch(`${API_BASE}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ messages, mode }),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new StreamUnsupported("network");
  }

  if (res.status === 401) {
    tokenStore.clear();
    window.dispatchEvent(new Event("auth:expired"));
    throw new Error("Your session has expired. Please sign in again.");
  }
  if (!res.ok || !res.body || !(res.headers.get("content-type") || "").includes("text/event-stream")) {
    let message = "";
    try {
      message = (await res.json()).message;
    } catch {
      /* not JSON */
    }
    if (res.status === 404 || !res.body) throw new StreamUnsupported(message || "no stream");
    throw new Error(message || "The assistant couldn't answer right now.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary;
    // Events are separated by a blank line.
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      let event = "message";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      const payload = JSON.parse(data);
      if (event === "delta") onDelta?.(payload.text);
      else if (event === "flag") onFlag?.(payload.redFlag);
      else if (event === "done") return payload;
      else if (event === "error") throw new Error(payload.message);
    }
  }
  throw new Error("The answer was cut off. Please ask again.");
}
