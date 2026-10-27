"""Private, quota-bounded checks of individual AI providers."""

from typing import Literal

from fastapi import APIRouter

from app.llm import get_llm

router = APIRouter()


@router.post("/providers/{provider}/check")
async def check_provider(provider: Literal["gemini", "groq", "openrouter"]):
    return await get_llm().probe_provider(provider)
