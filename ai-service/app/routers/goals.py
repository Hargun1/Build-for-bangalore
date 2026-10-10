import re
from typing import Literal, Optional, get_args

from fastapi import APIRouter
from pydantic import BaseModel, Field, field_validator

from ..context import SAFETY_RULES, UserContext, describe
from ..llm import LLMUnavailable, get_llm

router = APIRouter()

Metric = Literal["steps", "sleepHours", "weightKg", "systolic", "waterLitres", "restingHeartRate", "habit"]
Category = Literal["fitness", "sleep", "weight", "nutrition", "heart", "stress", "hydration", "other"]


class PlanRequest(BaseModel):
    description: str = Field(min_length=3, max_length=400)
    weeks: Optional[int] = Field(default=None, ge=1, le=26)
    context: Optional[UserContext] = None
    recent: dict[str, Optional[float]] = Field(default_factory=dict)  # 7-day averages from the backend


class Milestone(BaseModel):
    week: int
    title: str
    target: str = ""


class Habit(BaseModel):
    title: str
    timeOfDay: str = "any"


class Plan(BaseModel):
    title: str
    description: str = ""
    category: Category = "other"
    metric: Metric = "habit"
    direction: Literal["atLeast", "atMost", "reach"] = "atLeast"
    dailyTarget: Optional[float] = None
    startValue: Optional[float] = None
    targetValue: Optional[float] = None
    unit: str = ""
    weeks: int = 4
    milestones: list[Milestone] = Field(default_factory=list)
    habits: list[Habit] = Field(default_factory=list)
    tips: list[str] = Field(default_factory=list)

    @field_validator("category", "metric", "direction", mode="before")
    @classmethod
    def coerce(cls, v, info):
        allowed = {"category": get_args(Category), "metric": get_args(Metric), "direction": ("atLeast", "atMost", "reach")}[info.field_name]
        default = {"category": "other", "metric": "habit", "direction": "atLeast"}[info.field_name]
        if isinstance(v, str):
            for option in allowed:
                if v.strip().lower() == option.lower():
                    return option
        return default


# Safety limits applied after the model answers (a model may suggest crash diets).
MAX_WEIGHT_LOSS_PER_WEEK = 1.0  # kg; NHS/WHO guidance is 0.5-1 kg per week
STEP_CEILING = 20000
SLEEP_RANGE = (6.5, 9.5)


def make_safe(plan: Plan, req: PlanRequest) -> tuple[Plan, list[str]]:
    notes = []
    plan.weeks = max(1, min(plan.weeks or req.weeks or 4, 26))
    if plan.metric == "weightKg":
        plan.direction = "reach"
        start = plan.startValue or req.recent.get("weightKg") or (req.context.weightKg if req.context else None)
        plan.startValue = start
        if start and plan.targetValue and start > plan.targetValue:
            floor = round(start - MAX_WEIGHT_LOSS_PER_WEEK * plan.weeks, 1)
            if plan.targetValue < floor:
                notes.append(f"Target adjusted to {floor} kg: losing more than {MAX_WEIGHT_LOSS_PER_WEEK:g} kg a week is not recommended.")
                plan.targetValue = floor
        plan.unit = "kg"
    elif plan.metric == "steps":
        plan.direction = "atLeast"
        if plan.dailyTarget:
            plan.dailyTarget = float(min(max(plan.dailyTarget, 2000), STEP_CEILING))
        plan.unit = "steps"
    elif plan.metric == "sleepHours":
        plan.direction = "atLeast"
        if plan.dailyTarget:
            plan.dailyTarget = float(min(max(plan.dailyTarget, SLEEP_RANGE[0]), SLEEP_RANGE[1]))
        plan.unit = "h"
    elif plan.metric in ("systolic", "restingHeartRate"):
        plan.direction = "atMost"
    elif plan.metric == "waterLitres":
        plan.direction = "atLeast"
        if plan.dailyTarget:
            plan.dailyTarget = float(min(max(plan.dailyTarget, 1.5), 4.0))
        plan.unit = "L"
    plan.milestones = [m for m in plan.milestones if 1 <= m.week <= plan.weeks][:12]
    plan.habits = plan.habits[:5]
    plan.tips = plan.tips[:5]
    return plan, notes


TEMPLATES = [
    (r"\bstep|walk|run|jog|fit|exercise|active\b", dict(title="Walk more every day", category="fitness", metric="steps", dailyTarget=8000,
     habits=[Habit(title="10-minute walk after lunch"), Habit(title="Take the stairs once")], tips=["Walk while on phone calls.", "Park or get off the bus one stop early."])),
    (r"\bsleep|insomnia|tired|rest\b", dict(title="Sleep 7.5 hours a night", category="sleep", metric="sleepHours", dailyTarget=7.5,
     habits=[Habit(title="Screens off 30 min before bed", timeOfDay="night"), Habit(title="Same wake-up time", timeOfDay="morning")], tips=["Keep the bedroom dark and cool.", "No caffeine after 3 pm."])),
    (r"\bweight|kg|fat|slim|lose\b", dict(title="Lose weight steadily", category="weight", metric="weightKg",
     habits=[Habit(title="Half the plate vegetables"), Habit(title="No sugary drinks")], tips=["Weigh yourself at the same time each week.", "Aim for 0.5 kg per week."])),
    (r"\bwater|hydrat|drink\b", dict(title="Drink enough water", category="hydration", metric="waterLitres", dailyTarget=2.5,
     habits=[Habit(title="A glass of water on waking", timeOfDay="morning")], tips=["Keep a 1 L bottle at your desk."])),
    (r"\bbp|blood pressure|hypertension|salt\b", dict(title="Bring blood pressure down", category="heart", metric="systolic", dailyTarget=130,
     habits=[Habit(title="Measure BP each morning", timeOfDay="morning"), Habit(title="No extra salt at the table")], tips=["Limit pickles, papad and namkeen.", "Walk 30 minutes a day."])),
]


def template_plan(req: PlanRequest) -> Plan:
    text = req.description.lower()
    for pattern, fields in TEMPLATES:
        if re.search(pattern, text):
            plan = Plan(**fields, weeks=req.weeks or 4)
            break
    else:
        plan = Plan(title=req.description[:60].strip().capitalize(), category="other", metric="habit", weeks=req.weeks or 4,
                    habits=[Habit(title=req.description[:60])], tips=["Tick off the habit each day to build a streak."])
    if plan.metric == "weightKg":
        start = req.recent.get("weightKg") or (req.context.weightKg if req.context else None)
        if start:
            plan.startValue = start
            plan.targetValue = round(start - 0.5 * plan.weeks, 1)
    plan.milestones = [Milestone(week=w, title=f"Week {w} check-in") for w in range(1, plan.weeks + 1)]
    return plan


@router.post("/plan")
async def goal_plan(body: PlanRequest):
    recent = ", ".join(f"{k} {v:g}" for k, v in body.recent.items() if v is not None) or "no recent logs"
    prompt = (
        f"User: {describe(body.context)}\nTheir last 7 days (averages): {recent}\n\nGoal in their words: \"{body.description}\"\n"
        + (f"Duration: {body.weeks} weeks.\n" if body.weeks else "")
        + "\nTurn this into a realistic, measurable plan. Choose the ONE metric we can track automatically from their logs: "
        "steps (daily steps), sleepHours, weightKg, systolic (blood pressure), waterLitres, restingHeartRate; or 'habit' when none fits. "
        "direction: atLeast (daily value must be >= dailyTarget), atMost (<= dailyTarget), or reach (move from startValue to targetValue, used for weight). "
        "Start from their current level and progress gradually. Give one milestone per week (week numbers from 1), 2-4 small daily habits, "
        "and 3 practical tips that fit life in an Indian city. " + SAFETY_RULES
    )
    notes: list[str] = []
    try:
        res = await get_llm().complete([{"role": "user", "content": prompt}], schema=Plan, temperature=0.4, max_tokens=2000)
        plan, notes = make_safe(res.data, body)
        source = res.source
    except LLMUnavailable:
        plan, notes = make_safe(template_plan(body), body)
        source = "template"
    return {"plan": plan.model_dump(), "safetyNotes": notes, "planSource": source}
