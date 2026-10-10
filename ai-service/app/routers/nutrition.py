from typing import Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field, field_validator

from ..context import SAFETY_RULES, UserContext, describe
from ..llm import LLMUnavailable, get_llm

router = APIRouter()


class ProductFacts(BaseModel):
    """Facts the backend already fetched from Open Food Facts (real label data)."""

    name: str
    brand: str = ""
    nutriScore: Optional[str] = None  # a-e
    novaGroup: Optional[int] = None  # 1-4
    per100g: dict[str, Optional[float]] = Field(default_factory=dict)
    ingredients: str = ""
    allergens: list[str] = Field(default_factory=list)
    additives: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)


class ReviewRequest(BaseModel):
    product: ProductFacts
    context: Optional[UserContext] = None


class Review(BaseModel):
    verdict: Literal["good", "okay", "limit"] = "okay"
    headline: str
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)
    forYou: str = ""
    alternatives: list[str] = Field(default_factory=list)

    @field_validator("verdict", mode="before")
    @classmethod
    def norm(cls, v):
        v = str(v).strip().lower()
        return v if v in ("good", "okay", "limit") else "okay"


def rule_review(p: ProductFacts) -> dict:
    """Verdict straight from the label when no AI is available: Nutri-Score first, then NOVA."""
    n = (p.nutriScore or "").lower()
    if n in ("a", "b"):
        verdict = "good"
    elif n in ("d", "e") or p.novaGroup == 4:
        verdict = "limit"
    else:
        verdict = "okay"
    per = p.per100g
    pros, cons = [], []
    if (per.get("proteins") or 0) >= 10:
        pros.append(f"High protein ({per['proteins']:g} g per 100 g)")
    if (per.get("fiber") or 0) >= 6:
        pros.append(f"High fibre ({per['fiber']:g} g per 100 g)")
    if (per.get("sugars") or 0) >= 22.5:
        cons.append(f"High sugar ({per['sugars']:g} g per 100 g)")
    if (per.get("salt") or 0) >= 1.5:
        cons.append(f"High salt ({per['salt']:g} g per 100 g)")
    if (per.get("saturated-fat") or 0) >= 5:
        cons.append(f"High saturated fat ({per['saturated-fat']:g} g per 100 g)")
    if p.novaGroup == 4:
        cons.append("Ultra-processed (NOVA group 4)")
    headline = {"good": "A reasonable everyday choice", "okay": "Fine in moderation", "limit": "Best kept as an occasional treat"}[verdict]
    return {"verdict": verdict, "headline": headline, "pros": pros, "cons": cons, "forYou": "", "alternatives": []}


@router.post("/product-review")
async def product_review(body: ReviewRequest):
    p = body.product
    facts = (
        f"Product: {p.name} ({p.brand})\nNutri-Score: {p.nutriScore or 'unknown'}; NOVA group: {p.novaGroup or 'unknown'}\n"
        f"Per 100 g: {', '.join(f'{k} {v:g}' for k, v in p.per100g.items() if v is not None)}\n"
        f"Ingredients: {p.ingredients[:900] or 'not listed'}\nAllergens: {', '.join(p.allergens) or 'none listed'}\n"
        f"Additives: {', '.join(p.additives[:15]) or 'none listed'}"
    )
    prompt = (
        f"User: {describe(body.context)}\n\nLabel data from Open Food Facts:\n{facts}\n\n"
        "Review this packaged food for this specific user, using only the label data above. Give a verdict "
        "(good, okay, limit), a one-line headline, up to 3 pros and 3 cons citing the numbers, a 'forYou' sentence "
        "about their conditions, allergies or diet (say clearly if an allergen or non-veg ingredient conflicts with their profile), "
        "and up to 3 healthier alternatives commonly sold in India. " + SAFETY_RULES
    )
    try:
        res = await get_llm().complete([{"role": "user", "content": prompt}], schema=Review, temperature=0.2, cache=True)
        return {**res.data.model_dump(), "aiSource": res.source}
    except LLMUnavailable:
        return {**rule_review(p), "aiSource": "rules"}
