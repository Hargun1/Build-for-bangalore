"""Rule-based red-flag detection for free-text symptoms.

Runs before any language model call, so emergency advice never depends on an
AI provider being up or on a model behaving well. Patterns cover common
English phrasing plus a few Hinglish forms seen in Indian users' messages.

Measured with evals/datasets/red_flags.jsonl (see evals/README.md). Design goal:
never miss an emergency or crisis (recall first), then keep false alarms low by
skipping general questions ("what are the risk factors for stroke?") and past
events ("my father had a heart attack in 2019"). Crisis phrases are never skipped.
"""
from __future__ import annotations

import re
from typing import Literal, Optional

from pydantic import BaseModel, field_validator


class RedFlag(BaseModel):
    level: str  # "emergency" | "urgent" | "crisis"
    title: str
    message: str
    actions: list[dict]


EMERGENCY_CALL = {"label": "Call 112 (emergency)", "href": "tel:112"}
AMBULANCE_CALL = {"label": "Call 108 (ambulance)", "href": "tel:108"}
TELE_MANAS = {"label": "Call Tele-MANAS 14416 (free, 24x7)", "href": "tel:14416"}

# "Within a sentence": up to N characters that don't cross . ? or !
def _near(n: int) -> str:
    return rf"[^.?!]{{0,{n}}}"


_RULES: list[tuple[str, str, str, list[str]]] = [
    # (level, title, message, patterns)
    (
        "crisis",
        "You don't have to go through this alone",
        "If you are thinking about ending your life or hurting yourself, please talk to someone right now. "
        "Tele-MANAS (14416) is free, confidential and open 24x7 in Indian languages. If you are in immediate danger, call 112.",
        [
            r"\b(kill\w*|hurt\w*|harm\w*|cut\w*)\s+myself\b",
            r"\b(end|ending|take|taking)\s+my\s+(own\s+)?life\b",
            r"\bend it all\b",
            r"\bsuicid",
            r"\bwant(ed)? to die\b",
            r"\b(don'?t|do not|no longer) want to (live|be alive|wake up)\b",
            r"\bno (reason|point) (to|in) (live|living|go on)\b",
            r"\bself[- ]?harm",
            rf"\b(take|taking|swallow\w*|took)\b{_near(25)}\b(all|whole|lots of|a lot of|bunch of|entire)\b{_near(25)}\b(pills|tablets|medicines?|bottle)\b",
            r"\boverdos(e|ing)\b",
            r"\bmar(na)? (jaana|jana)? ?chaht",
            r"\bjeena nahi?n? chaht",
        ],
    ),
    (
        "emergency",
        "Possible heart attack: get help now",
        "Chest pain or pressure, especially spreading to the arm, jaw or back, or with sweating or breathlessness, can be a heart attack. "
        "Call 112 or 108 now. Do not drive yourself. Sit and rest while you wait.",
        [
            rf"\bchest\b{_near(40)}\b(pain|pressure|tight\w*|heav\w*|hurt\w*|crush\w*|ache)\b",
            rf"\b(pain|pressure|tight\w*|heav\w*|crush\w*|tearing)\b{_near(30)}\bchest\b",
            r"\bseene? (mein|me|main) (dard|bhaari|bhari)",
            r"\bheart attack\b",
        ],
    ),
    (
        "emergency",
        "Possible stroke: act FAST",
        "Face drooping, arm weakness, slurred speech or a sudden severe headache are stroke warning signs. "
        "Note the time symptoms began and call 112 or 108 immediately; treatment works best within hours.",
        [
            rf"\bface\b{_near(25)}\bdroop", rf"\bdroop\w*\b{_near(25)}\bface\b",
            r"\bslurr", r"\b(can'?t|cannot|unable to) (lift|move|raise) (his|her|my|their) (right |left )?(arm|leg|hand)\b",
            rf"\b(one|left|right) side of (my|his|her|their|the) (body|face)\b{_near(30)}\b(numb|weak|droop|paraly)",
            r"\bsudden(ly)? (can'?t|cannot) (speak|talk|see|walk)\b",
            r"\bstroke\b",
            r"\bworst headache\b", r"\bthunderclap\b", r"\bsudden\w* (severe|very bad|terrible|excruciating) headache\b",
        ],
    ),
    (
        "emergency",
        "Sudden eye emergency",
        "Sudden loss of vision, or a chemical in the eye, needs emergency care. For chemicals, rinse the eye with clean running water "
        "for 15 minutes on the way. Call 112 or go to an emergency department now.",
        [
            rf"\bsudden\w*\b{_near(30)}\b(loss of|lost|losing|can'?t see out of|no) (vision|sight|eyesight)\b",
            rf"\bsudden\w*\b{_near(20)}\b(can'?t|cannot) see\b",
            rf"\bcurtain\b{_near(30)}\b(vision|eye|sight)\b", rf"\b(vision|eye|sight)\b{_near(40)}\bcurtain\b",
            rf"\b(chemical|acid|bleach|lime|chuna)\b{_near(30)}\beye", rf"\beye\b{_near(30)}\b(chemical|acid|bleach)\b",
        ],
    ),
    (
        "emergency",
        "Severe breathing difficulty",
        "Struggling to breathe, blue lips or being unable to speak in full sentences needs emergency care. Call 112 or 108 now.",
        [
            r"\b(can'?t|cannot|unable to|struggling to|hard to) breathe\b(?! through (my|the|his|her) nose)",
            r"\bsevere (shortness of breath|breathlessness)\b",
            rf"\b(shortness of breath|short of breath|breathless\w*)\b{_near(20)}\b(at rest|while resting|lying still)\b",
            rf"\blips?\b{_near(25)}\b(blue|bluish|purple)\b(?![^.?!]*\b(jamun|berr\w*|ink|lipstick|colou?r|candy))",
            r"\bsaans (nahi|nahin|nhi) (aa|le)",
            r"\bchoking\b",
            r"\b(can'?t|cannot|unable to) (finish|complete) (a |my |full )?sentences?\b",
        ],
    ),
    (
        "emergency",
        "Possible severe allergic reaction",
        "Swelling of the face, lips or throat, or a tight throat, can be anaphylaxis. Use an adrenaline auto-injector if you have one and call 112.",
        [
            rf"\b(throat|tongue|lips?)\b{_near(20)}\bswell", rf"\bswell\w*\b{_near(20)}\b(throat|tongue|lips)\b",
            rf"\bthroat\b{_near(20)}\b(tight|closing|closed)", r"\banaphyla",
        ],
    ),
    (
        "emergency",
        "This needs emergency care",
        "Loss of consciousness, a seizure, heavy bleeding, a severe head injury, a snake bite or danger signs in pregnancy need emergency care. "
        "Call 112 or 108 now.",
        [
            r"\b(unconscious|passed out|collapsed|not responding|unresponsive)\b",
            r"\bseizure\b", r"\b(having|had) a fit\b", r"\bfits? (aa|aya|aaya|aa raha|aa rahe)", r"\bconvuls",
            rf"\b(heavy|severe|uncontrolled|profuse)\b{_near(30)}\bbleed", rf"\bbleed\w*\b{_near(30)}\b(won'?t|will not|doesn'?t|does not|not) stop",
            r"\b(vomiting|throwing up|coughing up) (lots of |a lot of )?blood\b",
            r"\bhead injury\b",
            r"\bsnake ?bite\b", r"\bbitten by a snake\b",
            rf"\bpregnan\w*\b{_near(80)}\b(severe headache|blurr\w* vision|bleeding|fits?|seizure|swollen face)\b",
        ],
    ),
    (
        "urgent",
        "Please see a doctor today",
        "These symptoms need a doctor within the next few hours, not next week. If things get worse, call 112 or 108.",
        [
            r"\bstiff neck\b", rf"\bfever\b{_near(40)}\b(confus\w*|rash|stiff)", rf"\bconfus\w*\b{_near(40)}\bfever\b",
            rf"\b(baby|infant|newborn|\d+ (month|week)s? old)\b{_near(60)}\bfever\b", rf"\bfever\b{_near(40)}\b(baby|infant|newborn)\b",
            rf"\bdengue\b{_near(60)}\b(bleed\w*|platelet\w*|(severe|bad) (stomach|abdominal|belly) pain|vomit\w*)",
            rf"\brash\b{_near(40)}\b(doesn'?t|does not|won'?t) fade",
            r"\b(black|tarry) (tarry |black )?(stools?|poop|motion)",
            rf"\b(lower right|right lower)\b{_near(25)}\b(abdomen|abdominal|belly|stomach|side)\b",
            rf"\bpain\b{_near(40)}\b(in waves|comes in waves|coming in waves)\b",
            rf"\b(dog|cat|monkey|rat|stray|animal)\b{_near(25)}\bbit(e|ten)?\b", r"\bbitten by (a |an )?(dog|cat|monkey|rat|animal)\b",
            rf"\bswallowed\b{_near(30)}\b(coin|battery|magnet|pin|bleach|poison|chemical|kerosene)",
            rf"\bcalf\b{_near(40)}\b(swollen|swelling|red|painful)\b",
            rf"\b(testic\w*|testes|scrotum|scrotal)\b{_near(40)}\b(pain|swell\w*)", rf"\b(pain|swell\w*)\b{_near(40)}\b(testic\w*|testes|scrotum)\b",
            r"\b(not|haven'?t|hasn'?t|no) (passed|passing|peed) (any )?urine\b",
            rf"\bnumb\w*\b{_near(20)}\b(groin|saddle|buttocks)\b",
            rf"\bback pain\b{_near(80)}\b(trouble|can'?t|cannot|unable to) (pass\w*|control\w*) (urine|bladder|bowel)",
            rf"\bsudden\w*\b{_near(20)}\bhearing loss\b", rf"\bhearing loss\b{_near(30)}\bsudden",
            rf"\b(bent|deformed|out of place)\b{_near(40)}\b(can'?t|cannot) move\b", rf"\b(wrist|arm|leg|ankle|elbow)\b{_near(30)}\b(bent|deformed)\b",
            rf"\bsugar\b{_near(30)}\b[3-9]\d\d\b{_near(60)}\b(vomit\w*|drows\w*|confus\w*|breath\w*)",
            rf"\bburn\w*\b{_near(40)}\bblisters?\b",
            r"\bfainted\b",
        ],
    ),
]

_COMPILED = [(lvl, title, msg, [re.compile(p, re.IGNORECASE) for p in pats]) for lvl, title, msg, pats in _RULES]

# A general question ("what are the risk factors for stroke?") or a past event
# ("had a seizure last year") is not an emergency now, unless the message also
# says something is happening now.
_QUESTION = re.compile(r"^\s*(what|how|why|which|is|are|can|could|should|does|do|tell me)\b", re.IGNORECASE)
_INFO_TOPIC = re.compile(r"\b(risk|prevent\w*|causes?|symptoms of|signs of|what (is|are)|diet|lower|reduce|avoid)\b", re.IGNORECASE)
_HISTORY = re.compile(
    r"\b((\d+|a few|few|two|three|four|five|six|several|many) (years?|months?) ago|last year|in (19|20)\d\d|history of|recovered)\b",
    re.IGNORECASE,
)
_HAPPENING_NOW = re.compile(
    r"\b(right now|is having|am having|are having|happening now|currently|since (this|last|yesterday|\d)|minutes? ago|an hour ago|hours ago|tonight|this morning|suddenly)\b",
    re.IGNORECASE,
)


def _not_current(text: str) -> bool:
    if _HAPPENING_NOW.search(text):
        return False
    informational = bool(_QUESTION.search(text) and _INFO_TOPIC.search(text))
    return informational or bool(_HISTORY.search(text))


def detect_red_flag(text: str) -> Optional[RedFlag]:
    if not text:
        return None
    skip_physical = _not_current(text)
    for level, title, message, patterns in _COMPILED:
        if level != "crisis" and skip_physical:
            continue
        if any(p.search(text) for p in patterns):
            if level == "crisis":
                actions = [TELE_MANAS, EMERGENCY_CALL]
            elif level == "emergency":
                actions = [EMERGENCY_CALL, AMBULANCE_CALL]
            else:
                actions = [{"label": "Find a clinic nearby", "href": "/appointments"}]
            return RedFlag(level=level, title=title, message=message, actions=actions)
    return None


# ---------------------------------------------------------------- second layer: AI classifier
#
# Keyword rules are fast and work offline, but they only catch phrasings someone
# thought of. On a held-out set of new phrasings the rules alone caught 2 of 12
# emergencies (evals/reports/red_flags_holdout-rules-v1.md). So, when an AI
# provider is available, a classifier reads the message for meaning and the more
# severe of the two verdicts wins.

SEVERITY = {None: 0, "urgent": 1, "emergency": 2, "crisis": 3}

GENERIC = {
    "crisis": _RULES[0][1:3],
    "emergency": (
        "This may be an emergency",
        "What you describe may need emergency care. Call 112 or 108 now, or go to the nearest emergency department. "
        "If someone is with you, ask them to stay until help arrives.",
    ),
    "urgent": _RULES[-1][1:3],
}

CLASSIFIER_PROMPT = (
    "You are a medical safety triage filter. Read the user's message and classify ONLY the situation happening now:\n"
    "- crisis: any sign of suicidal thoughts, self-harm, or intent to die (including indirect hints like goodbye letters or "
    "'everyone would be better off without me').\n"
    "- emergency: anything that could be life-threatening right now (chest pain/pressure, stroke signs, severe breathing "
    "trouble, loss of consciousness, seizure, heavy bleeding, severe allergic reaction, head injury with vomiting or drowsiness, "
    "poisoning).\n"
    "- urgent: needs a doctor within 24 hours (e.g. fever in an infant under 3 months, animal bite, black stools, fever with "
    "rash or purple spots, severe pain).\n"
    "- none: general questions, past events, mild symptoms, or figures of speech ('this exam will kill me').\n"
    "When unsure between two levels, choose the more severe one."
)


class SafetyVerdict(BaseModel):
    level: Literal["crisis", "emergency", "urgent", "none"] = "none"
    reason: str = ""

    @field_validator("level", mode="before")
    @classmethod
    def norm(cls, v):
        v = str(v).strip().lower()
        return v if v in ("crisis", "emergency", "urgent", "none") else "urgent"


def _flag_for(level: str) -> RedFlag:
    title, message = GENERIC[level]
    if level == "crisis":
        actions = [TELE_MANAS, EMERGENCY_CALL]
    elif level == "emergency":
        actions = [EMERGENCY_CALL, AMBULANCE_CALL]
    else:
        actions = [{"label": "Find a clinic nearby", "href": "/appointments"}]
    return RedFlag(level=level, title=title, message=message, actions=actions)


async def classify_with_llm(text: str) -> Optional[str]:
    """Returns crisis / emergency / urgent / None, or raises LLMUnavailable."""
    from .llm import get_llm  # local import keeps the rules usable without the LLM stack

    res = await get_llm().complete(
        [{"role": "system", "content": CLASSIFIER_PROMPT}, {"role": "user", "content": text[:2000]}],
        schema=SafetyVerdict,
        temperature=0,
        max_tokens=200,
        cache=True,
    )
    return None if res.data.level == "none" else res.data.level


def combine(rule_flag: Optional[RedFlag], llm_level: Optional[str]) -> Optional[RedFlag]:
    """The more severe verdict wins; a rule-based flag keeps its specific wording."""
    rule_level = rule_flag.level if rule_flag else None
    if SEVERITY[llm_level] > SEVERITY[rule_level]:
        return _flag_for(llm_level)
    return rule_flag


async def assess_safety(text: str, use_llm: bool = True) -> tuple[Optional[RedFlag], str]:
    """Rules first; if they don't already say emergency/crisis, ask the classifier.
    Returns (flag, source) where source is 'rules', 'rules+ai' or 'rules (ai unavailable)'."""
    from .llm import LLMUnavailable

    rule_flag = detect_red_flag(text)
    if not use_llm or (rule_flag and rule_flag.level in ("emergency", "crisis")):
        return rule_flag, "rules"
    try:
        llm_level = await classify_with_llm(text)
    except LLMUnavailable:
        return rule_flag, "rules (ai unavailable)"
    return combine(rule_flag, llm_level), "rules+ai"
