from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..context import SAFETY_RULES, UserContext, describe
from ..llm import LLMUnavailable, get_llm

router = APIRouter()


class AdviceRequest(BaseModel):
    """Environment facts the backend already computed from Open-Meteo data."""

    aqi: Optional[float] = None
    aqiCategory: str = ""
    dominantPollutant: str = ""
    temperatureC: Optional[float] = None
    feelsLikeC: Optional[float] = None
    humidity: Optional[float] = None
    uvIndex: Optional[float] = None
    bestWindow: Optional[str] = None  # e.g. "06:00-08:00"
    alerts: list[str] = Field(default_factory=list)
    context: Optional[UserContext] = None


class Advice(BaseModel):
    headline: str
    tips: list[str] = Field(default_factory=list)


@router.post("/advice")
async def advice(body: AdviceRequest):
    facts = (
        f"Air quality (India CPCB AQI): {body.aqi} ({body.aqiCategory}), main pollutant {body.dominantPollutant or 'unknown'}. "
        f"Temperature {body.temperatureC} °C, feels like {body.feelsLikeC} °C, humidity {body.humidity}%, UV index {body.uvIndex}. "
        f"Best time to be outdoors today: {body.bestWindow or 'not computed'}. Alerts: {'; '.join(body.alerts) or 'none'}."
    )
    prompt = (
        f"User: {describe(body.context)}\nToday's conditions where they are: {facts}\n\n"
        "Write a one-sentence headline and 3 short, specific tips for today (exercise timing, mask, hydration, "
        "sun protection, ventilation) tailored to this person's health. " + SAFETY_RULES
    )
    try:
        res = await get_llm().complete([{"role": "user", "content": prompt}], schema=Advice, temperature=0.3, cache=True)
        return {"headline": res.data.headline, "tips": res.data.tips[:4], "aiSource": res.source}
    except LLMUnavailable:
        return {"headline": None, "tips": [], "aiSource": "unavailable"}
