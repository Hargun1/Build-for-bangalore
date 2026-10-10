import re
from typing import Literal, Optional, get_args

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from ..context import SAFETY_RULES, UserContext, describe
from ..llm import LLMUnavailable, get_llm

router = APIRouter()


def loose(literal_type, default: str):
    """Before-validator: accepts 'Ultra-processed' or 'VEGETABLE' from a model and
    maps it onto the allowed lowercase values, falling back to a default."""
    allowed = set(get_args(literal_type))

    def _coerce(value):
        if isinstance(value, str):
            v = value.strip().lower().replace("-", "_").replace(" ", "_")
            if v in allowed:
                return v
        return default

    return _coerce


Group = Literal["vegetable", "fruit", "grain", "protein", "dairy", "fat", "sweet", "beverage", "mixed", "other"]
Confidence = Literal["high", "medium", "low"]
Processing = Literal["whole", "minimally_processed", "processed", "ultra_processed"]
Verdict = Literal["good", "moderate", "limit"]

MAX_IMAGE_CHARS = 7_000_000  # ~5 MB of image after base64


class ImageRequest(BaseModel):
    image: str = Field(min_length=100)
    context: Optional[UserContext] = None

    @field_validator("image")
    @classmethod
    def size_limit(cls, v: str) -> str:
        if len(v) > MAX_IMAGE_CHARS:
            raise ValueError("image is too large; resize it below 5 MB")
        return v


# ------------------------------------------------------------------ meal photo

class MealItem(BaseModel):
    name: str
    portion: str = ""
    grams: float = 0
    calories: float = 0
    proteinG: float = 0
    carbsG: float = 0
    fatG: float = 0
    fiberG: float = 0
    sugarG: float = 0
    sodiumMg: float = 0
    group: Group = "mixed"

    _group = field_validator("group", mode="before")(loose(Group, "mixed"))

    @field_validator("grams", "calories", "proteinG", "carbsG", "fatG", "fiberG", "sugarG", "sodiumMg", mode="before")
    @classmethod
    def numeric(cls, v):
        # Models sometimes answer "120 g" or "~250"; keep the number.
        if isinstance(v, str):
            m = re.search(r"-?\d+(\.\d+)?", v)
            return float(m.group()) if m else 0
        return v or 0


class MealVision(BaseModel):
    isFood: bool
    title: str = ""
    items: list[MealItem] = Field(default_factory=list)
    confidence: Confidence = "medium"
    advice: str = ""
    swaps: list[str] = Field(default_factory=list)

    _confidence = field_validator("confidence", mode="before")(loose(Confidence, "medium"))


def meal_score(t: dict, items: list[MealItem]) -> tuple[int, list[str]]:
    """0-10 meal score from the WHO healthy-diet guidance: free sugars < 10% of energy,
    fat < 30% of energy, salt < 5 g/day (2,000 mg sodium), plenty of fibre, vegetables and protein.
    A transparent heuristic, shown with its reasons; not a validated clinical index."""
    kcal = max(t["calories"], 1)
    protein_pct = t["proteinG"] * 4 / kcal
    sugar_pct = t["sugarG"] * 4 / kcal
    fat_pct = t["fatG"] * 9 / kcal
    score, why = 5.0, []
    if protein_pct >= 0.15:
        score += 1.5; why.append("good protein")
    elif protein_pct < 0.10:
        score -= 0.5; why.append("low protein")
    if t["fiberG"] >= 8:
        score += 1.5; why.append("high fibre")
    elif t["fiberG"] < 4:
        score -= 0.5; why.append("low fibre")
    if any(i.group in ("vegetable", "fruit") for i in items):
        score += 1; why.append("includes vegetables or fruit")
    if sugar_pct > 0.20:
        score -= 1.5; why.append("high sugar")
    elif sugar_pct > 0.10:
        score -= 0.5; why.append("some added sugar")
    if t["sodiumMg"] > 1200:
        score -= 1.5; why.append("very salty (over half the daily limit)")
    elif t["sodiumMg"] > 800:
        score -= 0.5; why.append("quite salty")
    if fat_pct > 0.40:
        score -= 1; why.append("high fat")
    if kcal > 1000:
        score -= 1; why.append("very large portion")
    return int(round(max(0, min(10, score)))), why


@router.post("/meal")
async def analyze_meal(body: ImageRequest):
    prompt = (
        f"User: {describe(body.context)}\n\n"
        "Look at this photo. If it is not food, set isFood false and leave items empty. Otherwise list every food item "
        "you can see (Indian dishes by their usual names, e.g. 'masala dosa', 'dal tadka', 'jeera rice'). For each, "
        "estimate the portion in grams and the nutrients for that portion, using typical Indian home or restaurant recipes. "
        "Set confidence low if the photo is unclear. In 'advice', write 2-3 sentences on how this meal fits this user "
        "(mention their conditions if relevant). In 'swaps', give up to 3 simple healthier swaps. " + SAFETY_RULES
    )
    try:
        res = await get_llm().complete([{"role": "user", "content": prompt}], schema=MealVision, images=[body.image], temperature=0.2, max_tokens=2000)
    except LLMUnavailable as exc:
        raise HTTPException(status_code=503, detail="Food recognition is unavailable right now. Please try again shortly.") from exc

    data: MealVision = res.data
    if not data.isFood or not data.items:
        return {"isFood": False, "message": "We couldn't find food in this photo. Try a clear, top-down photo of the plate.", "aiSource": res.source}

    keys = ["calories", "proteinG", "carbsG", "fatG", "fiberG", "sugarG", "sodiumMg"]
    totals = {k: round(sum(max(0.0, getattr(i, k)) for i in data.items), 1) for k in keys}
    score, reasons = meal_score(totals, data.items)
    return {
        "isFood": True,
        "title": data.title or ", ".join(i.name for i in data.items[:3]),
        "items": [i.model_dump() for i in data.items],
        "totals": totals,
        "healthScore": score,
        "scoreReasons": reasons,
        "confidence": data.confidence,
        "advice": data.advice,
        "swaps": data.swaps[:3],
        "aiSource": res.source,
        "disclaimer": "Nutrient values are AI estimates from a photo and can be off by 20-30%.",
    }


# ------------------------------------------------------------------ grocery photo

class GroceryItem(BaseModel):
    name: str
    category: str = "other"
    processing: Processing = "processed"
    verdict: Verdict = "moderate"
    reason: str = ""

    _processing = field_validator("processing", mode="before")(loose(Processing, "processed"))
    _verdict = field_validator("verdict", mode="before")(loose(Verdict, "moderate"))


class GroceryVision(BaseModel):
    isGrocery: bool
    items: list[GroceryItem] = Field(default_factory=list)
    summary: str = ""
    missing: list[str] = Field(default_factory=list)


VERDICT_POINTS = {"good": 1.0, "moderate": 0.5, "limit": 0.0}


@router.post("/grocery")
async def analyze_grocery(body: ImageRequest):
    prompt = (
        f"User: {describe(body.context)}\n\n"
        "This photo shows groceries, a shopping list, a bill/receipt, or products. Read every food item you can see "
        "(read handwriting and receipt abbreviations; expand them to plain names). For each: category (vegetable, fruit, "
        "grain, pulse, dairy, meat, snack, beverage, oil, sweet, other), processing level using the NOVA idea "
        "(whole, minimally_processed, processed, ultra_processed), a verdict for THIS user (good, moderate, limit) and a "
        "one-line reason. Set isGrocery false if there is no food. 'summary': 2 sentences on the basket overall. "
        "'missing': up to 3 food groups worth adding. " + SAFETY_RULES
    )
    try:
        res = await get_llm().complete([{"role": "user", "content": prompt}], schema=GroceryVision, images=[body.image], temperature=0.2, max_tokens=2500)
    except LLMUnavailable as exc:
        raise HTTPException(status_code=503, detail="Grocery recognition is unavailable right now. Please try again shortly.") from exc

    data: GroceryVision = res.data
    if not data.isGrocery or not data.items:
        return {"isGrocery": False, "message": "We couldn't read any food items. Try a sharper photo with better light.", "aiSource": res.source}
    items = data.items[:40]
    score = round(sum(VERDICT_POINTS[i.verdict] for i in items) / len(items) * 100)
    return {
        "isGrocery": True,
        "items": [i.model_dump() for i in items],
        "score": score,
        "counts": {v: sum(1 for i in items if i.verdict == v) for v in VERDICT_POINTS},
        "summary": data.summary,
        "missing": data.missing[:3],
        "aiSource": res.source,
    }
