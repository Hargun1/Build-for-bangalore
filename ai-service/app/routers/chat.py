from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..context import SAFETY_RULES, UserContext, describe
from ..llm import LLMUnavailable, get_llm
from ..safety import detect_red_flag

router = APIRouter()


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


@router.post("")
async def chat(body: ChatRequest):
    last_user = next((m.content for m in reversed(body.messages) if m.role == "user"), "")
    red_flag = detect_red_flag(last_user)

    if red_flag and red_flag.level in ("emergency", "crisis"):
        # Answer immediately with fixed, vetted guidance; no model in the loop.
        return {"reply": red_flag.message, "redFlag": red_flag.model_dump(), "aiSource": "safety-rules"}

    system = PROMPTS[body.mode] + SAFETY_RULES + f"\n\nAbout this user: {describe(body.context)}"
    if body.metricsSummary:
        system += f"\nTheir recent logged data: {body.metricsSummary}"

    messages = [{"role": "system", "content": system}] + [m.model_dump() for m in body.messages[-12:]]
    try:
        res = await get_llm().complete(messages, temperature=0.5, max_tokens=900)
    except LLMUnavailable as exc:
        raise HTTPException(status_code=503, detail="The AI assistant is unavailable right now. Please try again in a few minutes.") from exc

    return {
        "reply": res.text.strip(),
        "redFlag": red_flag.model_dump() if red_flag else None,
        "aiSource": res.source,
    }
