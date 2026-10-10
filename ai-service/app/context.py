from typing import Optional

from pydantic import BaseModel


class UserContext(BaseModel):
    """What the backend tells the AI about the user. Kept small and free of identifiers
    (no name, email or exact date of birth) so prompts never carry personal data."""

    age: Optional[int] = None
    sex: Optional[str] = None
    heightCm: Optional[float] = None
    weightKg: Optional[float] = None
    activityLevel: Optional[str] = None
    hasDiabetes: Optional[bool] = None
    onBpMedication: Optional[bool] = None
    smoker: Optional[bool] = None
    conditions: list[str] = []
    medications: list[str] = []
    allergies: list[str] = []
    diet: Optional[str] = None
    city: Optional[str] = "Bengaluru"


def describe(ctx: Optional[UserContext]) -> str:
    if ctx is None:
        return "No profile details shared."
    parts = []
    if ctx.age:
        parts.append(f"age {ctx.age}")
    if ctx.sex and ctx.sex != "other":
        parts.append(ctx.sex)
    if ctx.heightCm and ctx.weightKg:
        bmi = ctx.weightKg / (ctx.heightCm / 100) ** 2
        parts.append(f"BMI {bmi:.1f}")
    if ctx.activityLevel:
        parts.append(f"activity: {ctx.activityLevel}")
    if ctx.hasDiabetes:
        parts.append("has diabetes")
    if ctx.onBpMedication:
        parts.append("on blood-pressure medicine")
    if ctx.smoker:
        parts.append("smoker")
    if ctx.diet:
        parts.append(f"diet: {ctx.diet.replace('_', ' ')}")
    if ctx.conditions:
        parts.append("conditions: " + ", ".join(ctx.conditions[:8]))
    if ctx.medications:
        parts.append("medicines: " + ", ".join(ctx.medications[:8]))
    if ctx.allergies:
        parts.append("allergies: " + ", ".join(ctx.allergies[:8]))
    if ctx.city:
        parts.append(f"lives in {ctx.city}, India")
    return "; ".join(parts) if parts else "No profile details shared."


SAFETY_RULES = (
    "Rules: You give general wellness information, never a diagnosis or a prescription. "
    "Do not name prescription drug doses. Recommend seeing a doctor for anything persistent or worrying. "
    "Use Indian context: Indian foods, ₹, 112 for emergencies and 108 for ambulance. "
    "Be concise, warm and specific. Do not use emojis."
)
