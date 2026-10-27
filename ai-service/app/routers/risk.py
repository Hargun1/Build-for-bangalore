from typing import Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..context import SAFETY_RULES, UserContext, describe
from ..llm import LLMUnavailable, get_llm
from ..risk import RULE_RECOMMENDATIONS, RiskInputs, assess

router = APIRouter()


class AssessRequest(BaseModel):
    inputs: RiskInputs
    context: Optional[UserContext] = None
    explain: bool = True


class Recommendation(BaseModel):
    title: str
    detail: str
    priority: Literal["high", "medium", "low"] = "medium"
    relatedTo: str = "profile"


class Narrative(BaseModel):
    summary: str
    recommendations: list[Recommendation] = Field(default_factory=list)


def rule_based(scores) -> tuple[str, list[dict]]:
    flagged = [s for s in scores if s.level in ("high", "moderate")]
    flagged.sort(key=lambda s: 0 if s.level == "high" else 1)
    recs = []
    for s in flagged[:5]:
        title, detail = RULE_RECOMMENDATIONS[s.key]
        recs.append({"title": title, "detail": detail, "priority": "high" if s.level == "high" else "medium", "relatedTo": s.key})
    known_count = sum(s.level != "unknown" for s in scores)
    if not known_count:
        summary = "There is not enough information to calculate a risk score yet. Add your health details and readings first."
    elif not flagged:
        summary = ("The scores we could calculate are low risk, but some could not be calculated. Add the missing details for a fuller screening estimate."
                   if known_count < len(scores) else
                   "Everything we could score looks healthy. Keep logging your daily numbers so we can spot changes early.")
    else:
        names = ", ".join(s.label.lower() for s in flagged[:3])
        summary = f"Your scores point to {names} as the areas to work on first. These are screening estimates, not a diagnosis."
    return summary, recs


@router.post("/assess")
async def assess_risk(body: AssessRequest):
    result = assess(body.inputs)
    scores = result["scores"]
    summary, recs = rule_based(scores)
    source = "rules"

    known = [s for s in scores if s.level != "unknown"]
    if body.explain and known:
        facts = "\n".join(
            f"- {s.label}: {s.value}{(' ' + s.unit) if s.unit else ''}, level {s.level} ({s.method})"
            + (f"; factors: {', '.join(f.name + ' ' + f.detail for f in s.factors)}" if s.factors else "")
            for s in known
        )
        missing = sorted({m for s in scores for m in s.missing})
        prompt = (
            f"User: {describe(body.context)}\n\nComputed screening scores (already calculated; do not change any number):\n{facts}\n"
            + (f"\nNot yet provided: {', '.join(missing)}.\n" if missing else "")
            + "\nWrite a 2-3 sentence plain-language summary of what these scores mean together, then up to 4 "
            "personalised recommendations, most important first. Each must be a specific action this person can take this week. "
            "relatedTo must be one of: diabetes, heart, weight, bloodPressure, sleep, activity, stress, profile."
        )
        try:
            res = await get_llm().complete(
                [{"role": "system", "content": "You are a preventive-health coach. " + SAFETY_RULES}, {"role": "user", "content": prompt}],
                schema=Narrative,
                temperature=0.4,
                cache=True,
            )
            summary = res.data.summary.strip()[:800]
            recs = [
                {**r.model_dump(), "title": r.title[:90], "detail": r.detail[:450]}
                for r in res.data.recommendations[:5]
            ]
            source = res.source
        except LLMUnavailable:
            pass

    return {
        "scores": [s.model_dump() for s in scores],
        "wellnessScore": result["wellnessScore"],
        "summary": summary,
        "recommendations": recs,
        "aiSource": source,
    }
