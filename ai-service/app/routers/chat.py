import asyncio
import os
import json
import logging
import time
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..context import SAFETY_RULES, UserContext, describe
from ..llm import LLMUnavailable, get_llm
from ..safety import classify_with_llm, combine, detect_red_flag
from rag import CITE_RULES, cited, retrieve, sources_block

router = APIRouter()
logger = logging.getLogger("pranexus.chat")


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=30)
    mode: Literal["general", "nutrition"] = "general"
    context: Optional[UserContext] = None
    metricsSummary: Optional[str] = Field(default=None, max_length=600)


# System prompts live here, on the server. The old client sent its own system
# prompt, which let anyone turn the endpoint into a free general-purpose chatbot.
PROMPTS = {
    "general": (
        "You are PranexusAI's health assistant for people in India. Answer health, symptom, sleep, fitness, "
        "nutrition and wellbeing questions in clear everyday language, in 80-200 words unless asked for more. "
        "Use short paragraphs or a short list when it helps. Ask one clarifying question when the question is vague. "
        "When symptoms are described, say what commonly causes them, what can be done at home, and the specific "
        "warning signs that mean seeing a doctor. Politely decline topics unrelated to health. "
    ),
    "nutrition": (
        "You are PranexusAI's nutrition coach for people in India. Give practical food advice using everyday Indian "
        "foods (dal, roti, rice, idli, curd, sprouts, seasonal fruit and vegetables) and respect the user's diet type "
        "and allergies. Mention approximate portions. Keep answers to 80-180 words. Politely decline non-food topics. "
    ),
}


class Prepared(BaseModel):
    last_user: str
    messages: list[dict]
    passages: list[dict]
    retrieval: str


async def prepare(body: ChatRequest) -> Prepared:
    """Prompt + trusted passages, shared by /chat and /chat/stream so they can't drift apart."""
    last_user = next((m.content for m in reversed(body.messages) if m.role == "user"), "")
    system = PROMPTS[body.mode] + SAFETY_RULES + f"\n\nAbout this user: {describe(body.context)}"
    if body.metricsSummary:
        system += f"\nTheir recent logged data: {body.metricsSummary}"
    # Ground the answer in trusted passages (see rag/). Retrieval failing never blocks the answer.
    try:
        passages, retrieval = await retrieve(last_user, k=4)
    except Exception:
        passages, retrieval = [], "none"
    if passages:
        system += f"\n\n{CITE_RULES}\n\n{sources_block(passages)}"
    messages = [{"role": "system", "content": system}] + [m.model_dump() for m in body.messages[-12:]]
    return Prepared(last_user=last_user, messages=messages, passages=passages, retrieval=retrieval)


async def safe_classify(text: str) -> Optional[str]:
    try:
        return await classify_with_llm(text)
    except LLMUnavailable:
        return None


# Chat is latency-sensitive: minimal thinking halves the time to the first word.
CHAT_REASONING = os.getenv("GEMINI_CHAT_REASONING_EFFORT", "minimal")

UNAVAILABLE = "The AI assistant is unavailable right now. Please try again in a few minutes."


@router.post("")
async def chat(body: ChatRequest):
    last_user = next((m.content for m in reversed(body.messages) if m.role == "user"), "")
    red_flag = detect_red_flag(last_user)
    if red_flag and red_flag.level in ("emergency", "crisis"):
        # Answer immediately with fixed, vetted guidance; no model in the loop.
        return {"reply": red_flag.message, "redFlag": red_flag.model_dump(), "aiSource": "safety-rules"}

    prep = await prepare(body)

    async def answer():
        try:
            return await get_llm().complete(prep.messages, temperature=0.5, max_tokens=900)
        except LLMUnavailable:
            return None

    # Second safety layer runs at the same time as the answer, so it adds no waiting time.
    llm_level, res = await asyncio.gather(safe_classify(last_user), answer())
    flag = combine(red_flag, llm_level)
    if flag and flag.level in ("emergency", "crisis"):
        return {"reply": flag.message, "redFlag": flag.model_dump(), "aiSource": "safety-ai"}
    if res is None:
        raise HTTPException(status_code=503, detail=UNAVAILABLE)

    reply, sources = cited(res.text.strip(), prep.passages)
    return {
        "reply": reply,
        "sources": sources,
        "retrieval": prep.retrieval,
        "redFlag": flag.model_dump() if flag else None,
        "aiSource": res.source,
    }


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


_END = object()


@router.post("/stream")
async def chat_stream(body: ChatRequest):
    """Server-sent events: `delta` {text} as words arrive, then `done` with the final,
    citation-checked reply and sources, or `error`.

    Safety: nothing is shown until the AI safety classifier has answered (it runs in
    parallel with the model, and words that arrive meanwhile are held back). If it
    escalates to an emergency, the held-back answer is discarded and the fixed
    emergency guidance is sent instead.
    """
    last_user = next((m.content for m in reversed(body.messages) if m.role == "user"), "")
    red_flag = detect_red_flag(last_user)

    async def events():
        if red_flag and red_flag.level in ("emergency", "crisis"):
            yield sse("done", {"reply": red_flag.message, "redFlag": red_flag.model_dump(), "aiSource": "safety-rules", "sources": []})
            return

        t0 = time.perf_counter()
        ms = lambda: int((time.perf_counter() - t0) * 1000)  # noqa: E731
        prep = await prepare(body)
        timing = {"prepared": ms()}
        queue: asyncio.Queue = asyncio.Queue()
        meta: dict = {}

        async def produce():
            try:
                async for piece in get_llm().stream(prep.messages, temperature=0.5, max_tokens=900, meta=meta, reasoning=CHAT_REASONING):
                    timing.setdefault("model_first_token", ms())
                    await queue.put(piece)
                await queue.put(_END)
            except LLMUnavailable as exc:
                await queue.put(exc)

        producer = asyncio.create_task(produce())
        try:
            try:
                llm_level = await asyncio.wait_for(safe_classify(last_user), timeout=12)
            except asyncio.TimeoutError:
                llm_level = None  # rules still apply; don't hold the answer forever
            timing["safety_verdict"] = ms()
            flag = combine(red_flag, llm_level)
            if flag and flag.level in ("emergency", "crisis"):
                producer.cancel()
                yield sse("done", {"reply": flag.message, "redFlag": flag.model_dump(), "aiSource": "safety-ai", "sources": []})
                return
            if flag:
                yield sse("flag", {"redFlag": flag.model_dump()})

            text = ""
            while True:
                item = await queue.get()
                if item is _END:
                    break
                if isinstance(item, LLMUnavailable):
                    if text:
                        yield sse("error", {"message": "The answer was cut off. Please ask again.", "partial": True})
                    else:
                        yield sse("error", {"message": UNAVAILABLE})
                    return
                if not text:
                    timing["first_shown"] = ms()
                text += item
                yield sse("delta", {"text": item})

            timing["done"] = ms()
            # Where the wait goes: retrieval (prepared), model, safety gate (first_shown waits for both).
            logger.info("chat stream timing_ms=%s source=%s retrieval=%s", timing, meta.get("source"), prep.retrieval)
            reply, sources = cited(text.strip(), prep.passages)
            yield sse("done", {
                "reply": reply,
                "sources": sources,
                "retrieval": prep.retrieval,
                "redFlag": flag.model_dump() if flag else None,
                "aiSource": meta.get("source", "unknown"),
            })
        finally:
            producer.cancel()  # client went away or we finished early

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
