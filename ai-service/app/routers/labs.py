"""Lab report reader: the model copies the printed table; app/labs.py decides what it means."""
import re
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from rag.retriever import Retriever

from ..labs import BY_KEY, CATALOG, evaluate
from ..llm import LLMUnavailable, get_llm
from .vision import MAX_IMAGE_CHARS

router = APIRouter()

Sex = Optional[str]


class LabRequest(BaseModel):
    images: list[str] = Field(min_length=1, max_length=4)  # photos or rendered PDF pages
    sex: Sex = None

    @field_validator("images")
    @classmethod
    def size_limit(cls, v: list[str]) -> list[str]:
        if sum(len(i) for i in v) > MAX_IMAGE_CHARS * 2:
            raise ValueError("the pages are too large together; use fewer or smaller pages")
        if any(len(i) < 100 for i in v):
            raise ValueError("an image is empty")
        return v


class PrintedRow(BaseModel):
    name: str
    key: str = "other"
    value: str = ""
    unit: str = ""
    refRange: str = ""

    @field_validator("value", "unit", "refRange", "key", mode="before")
    @classmethod
    def text(cls, v):
        return "" if v is None else str(v)


class PrintedReport(BaseModel):
    isLabReport: bool
    labName: str = ""
    reportDate: str = ""
    tests: list[PrintedRow] = Field(default_factory=list)


class EvaluateRequest(BaseModel):
    tests: list[PrintedRow] = Field(min_length=1, max_length=120)
    sex: Sex = None


KEYS = ", ".join(f"{t.key} ({t.name})" for t in CATALOG)
PROMPT = (
    "These are pages of a medical lab report. Copy the results table exactly as printed.\n"
    "For every test result row give: name (as printed), value (exactly as printed, including < or >; "
    "keep the digits exactly, do not round, convert or calculate), unit (as printed), refRange (the reference / "
    "normal range text as printed, or empty), and key: one of [" + KEYS + "] if the row is clearly that test, "
    "otherwise 'other'.\n"
    "Rules: never guess a value you cannot read clearly; skip that row instead. Skip headings, patient details, "
    "comments and method names. Do not include interpretations. Set reportDate to the sample collection or report "
    "date in YYYY-MM-DD if printed, else empty. labName: the laboratory's name if printed. Set isLabReport false if "
    "these pages are not a lab test report."
)


def _date(s: str) -> str:
    m = re.match(r"^\d{4}-\d{2}-\d{2}$", (s or "").strip())
    return m.group(0) if m else ""


def attach_sources(tests: list[dict]) -> None:
    """One MedlinePlus passage per out-of-range test, from the local knowledge base (no API call)."""
    retriever = Retriever.load()
    cache: dict[str, Optional[dict]] = {}
    for r in tests:
        if r["status"] not in ("high", "low") or not r["key"]:
            continue
        topic = BY_KEY[r["key"]].topic
        if topic not in cache:
            hits = retriever.search(topic, k=1)
            cache[topic] = {"title": hits[0]["title"], "url": hits[0]["url"], "text": hits[0]["text"][:400]} if hits else None
        r["source"] = cache[topic]


def summarise(result: dict) -> str:
    c = result["counts"]
    judged = c["normal"] + c["high"] + c["low"]
    if not judged:
        return "No results could be checked against a range."
    off = [r["display"] for r in result["tests"] if r["status"] in ("high", "low")]
    if not off:
        return f"All {judged} checked results are within range."
    shown = ", ".join(off[:5]) + (f" and {len(off) - 5} more" if len(off) > 5 else "")
    return f"{len(off)} of {judged} checked results are outside the range: {shown}."


def finish(result: dict) -> dict:
    attach_sources(result["tests"])
    result["summary"] = summarise(result)
    result["disclaimer"] = (
        "Values were read from your report by AI and checked by code against the lab's printed range "
        "(or a standard adult range when none is printed). Compare with the original and talk to your doctor before acting on them."
    )
    return result


@router.post("/read")
async def read_report(body: LabRequest):
    try:
        res = await get_llm().complete([{"role": "user", "content": PROMPT}], schema=PrintedReport, images=body.images, temperature=0, max_tokens=4000)
    except LLMUnavailable as exc:
        raise HTTPException(status_code=503, detail="The report reader is unavailable right now. Please try again shortly.") from exc
    data: PrintedReport = res.data
    if not data.isLabReport or not data.tests:
        return {"isLabReport": False, "message": "This doesn't look like a lab report, or the text is too blurry to read. Try a flat, well-lit photo of the results page.", "aiSource": res.source}
    result = evaluate([r.model_dump() for r in data.tests[:120]], body.sex)
    return {"isLabReport": True, "labName": data.labName.strip()[:80], "reportDate": _date(data.reportDate), "aiSource": res.source, **finish(result)}


@router.post("/evaluate")
async def evaluate_rows(body: EvaluateRequest):
    """Re-checks rows after the user corrects them. Pure code, no AI call."""
    return finish(evaluate([r.model_dump() for r in body.tests], body.sex))
