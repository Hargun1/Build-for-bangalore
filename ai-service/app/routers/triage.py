import asyncio
import re
from typing import Literal, Optional, get_args

from fastapi import APIRouter
from pydantic import BaseModel, Field, field_validator

from ..context import SAFETY_RULES, UserContext, describe
from ..llm import LLMUnavailable, get_llm
from ..safety import classify_with_llm, combine, detect_red_flag

router = APIRouter()

# Kept in sync with OpenStreetMap healthcare:speciality values the backend searches for.
Specialty = Literal[
    "general", "cardiology", "dermatology", "otolaryngology", "gastroenterology", "gynaecology", "neurology",
    "ophthalmology", "orthopaedics", "paediatrics", "psychiatry", "pulmonology", "urology", "dentistry",
    "endocrinology", "nephrology",
]
Urgency = Literal["emergency", "urgent", "soon", "routine"]


class TriageRequest(BaseModel):
    symptoms: str = Field(min_length=3, max_length=1500)
    context: Optional[UserContext] = None


class Triage(BaseModel):
    specialty: Specialty = "general"
    urgency: Urgency = "routine"
    summary: str
    selfCare: list[str] = Field(default_factory=list)
    seeDoctorIf: list[str] = Field(default_factory=list)
    questionsForDoctor: list[str] = Field(default_factory=list)

    @field_validator("specialty", "urgency", mode="before")
    @classmethod
    def coerce(cls, v, info):
        allowed = get_args(Specialty) if info.field_name == "specialty" else get_args(Urgency)
        v = str(v).strip().lower()
        aliases = {"ent": "otolaryngology", "gp": "general", "general physician": "general", "orthopedics": "orthopaedics",
                   "pediatrics": "paediatrics", "gynecology": "gynaecology", "dental": "dentistry", "dentist": "dentistry"}
        v = aliases.get(v, v)
        return v if v in allowed else ("general" if info.field_name == "specialty" else "soon")


KEYWORDS: list[tuple[str, str]] = [
    (r"skin|rash|acne|itch|eczema|hair fall", "dermatology"),
    (r"tooth|teeth|gum|dental", "dentistry"),
    (r"eye|vision|blurr", "ophthalmology"),
    (r"ear|throat|sinus|tonsil|nose", "otolaryngology"),
    (r"chest|palpitation|heart|bp|blood pressure", "cardiology"),
    (r"cough|wheez|asthma|breath", "pulmonology"),
    (r"stomach|acidity|diarrh|constipat|vomit|liver", "gastroenterology"),
    (r"period|pregnan|pcos|vaginal", "gynaecology"),
    (r"headache|migraine|numb|seizure|dizz", "neurology"),
    (r"back pain|knee|joint|fracture|sprain|shoulder", "orthopaedics"),
    (r"anxiety|depress|panic|stress|sleepless", "psychiatry"),
    (r"urine|kidney stone|prostate", "urology"),
    (r"thyroid|diabet|sugar", "endocrinology"),
    (r"child|baby|infant|kid", "paediatrics"),
]


def keyword_triage(text: str) -> dict:
    t = text.lower()
    specialty = next((s for pattern, s in KEYWORDS if re.search(pattern, t)), "general")
    return {
        "specialty": specialty,
        "urgency": "soon",
        "summary": "Based on keywords in your description. A general physician can also assess this and refer you if needed.",
        "selfCare": [],
        "seeDoctorIf": ["Symptoms get worse or last more than a few days", "You develop a high fever, severe pain or breathing trouble"],
        "questionsForDoctor": [],
    }


@router.post("")
async def triage(body: TriageRequest):
    flag = detect_red_flag(body.symptoms)
    if flag and flag.level in ("emergency", "crisis"):
        return {"specialty": "general", "urgency": "emergency", "summary": flag.message, "selfCare": [], "seeDoctorIf": [],
                "questionsForDoctor": [], "redFlag": flag.model_dump(), "aiSource": "safety-rules"}

    prompt = (
        f"Patient: {describe(body.context)}\nSymptoms in their words: \"{body.symptoms}\"\n\n"
        "Act as a triage nurse. Choose which kind of doctor they should see (specialty) and how soon.\n"
        "Urgency guide; be calibrated, most problems are not urgent:\n"
        "- emergency: could be life-threatening now (go to an emergency department now).\n"
        "- urgent (within 24 h): sudden severe pain, high fever in a baby, spreading infection, animal bite, new weakness or "
        "numbness, sudden vision or hearing loss, symptoms getting rapidly worse.\n"
        "- soon (within a week): new symptoms that are stable, infections without danger signs, a new lump, abnormal test results.\n"
        "- routine: long-standing, mild or stable problems (weeks to months), check-ups, vaccines, skin, hair, acne, "
        "irregular periods, snoring, mild chronic joint or back pain.\n"
        "Do not choose 'urgent' just to be cautious; it sends people to doctors needlessly. A separate safety check catches emergencies.\n"
        "Summarise in 2 sentences what the doctor "
        "will likely want to check, without diagnosing. Add up to 3 safe self-care steps, up to 3 warning signs that mean "
        "they should go sooner, and up to 3 questions to ask the doctor. " + SAFETY_RULES
    )
    async def classify():
        try:
            return await classify_with_llm(body.symptoms)
        except LLMUnavailable:
            return None

    async def plan():
        try:
            return await get_llm().complete([{"role": "user", "content": prompt}], schema=Triage, temperature=0.2)
        except LLMUnavailable:
            return None

    llm_level, res = await asyncio.gather(classify(), plan())
    flag = combine(flag, llm_level)
    if flag and flag.level in ("emergency", "crisis"):
        return {"specialty": "general", "urgency": "emergency", "summary": flag.message, "selfCare": [], "seeDoctorIf": [],
                "questionsForDoctor": [], "redFlag": flag.model_dump(), "aiSource": "safety-ai"}

    if res is not None:
        out = res.data.model_dump()
        source = res.source
    else:
        out = keyword_triage(body.symptoms)
        source = "keywords"
    if flag:  # "urgent" flags raise the floor
        out["urgency"] = "urgent" if out["urgency"] in ("soon", "routine") else out["urgency"]
        out["redFlag"] = flag.model_dump()
    return {**out, "aiSource": source}
