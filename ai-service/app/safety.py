"""Rule-based red-flag detection for free-text symptoms.

Runs before any language model call, so emergency advice never depends on an
AI provider being up or on a model behaving well. Patterns cover common
English phrasing plus a few Hinglish forms seen in Indian users' messages.
"""
from __future__ import annotations

import re
from typing import Optional

from pydantic import BaseModel


class RedFlag(BaseModel):
    level: str  # "emergency" | "urgent" | "crisis"
    title: str
    message: str
    actions: list[dict]


EMERGENCY_CALL = {"label": "Call 112 (emergency)", "href": "tel:112"}
AMBULANCE_CALL = {"label": "Call 108 (ambulance)", "href": "tel:108"}
TELE_MANAS = {"label": "Call Tele-MANAS 14416 (free, 24x7)", "href": "tel:14416"}

_RULES: list[tuple[str, str, str, list[str]]] = [
    # (level, title, message, patterns)
    (
        "crisis",
        "You don't have to go through this alone",
        "If you are thinking about ending your life or hurting yourself, please talk to someone right now. "
        "Tele-MANAS (14416) is free, confidential and open 24x7 in Indian languages. If you are in immediate danger, call 112.",
        [r"\b(kill|end|hurt|harm)\s+(myself|my life)\b", r"\bsuicid", r"\bwant to die\b", r"\bself[- ]harm\b", r"\bno reason to live\b", r"\bmar(na)? jaana? chahta\b"],
    ),
    (
        "emergency",
        "Possible heart attack: get help now",
        "Chest pain or pressure, especially spreading to the arm, jaw or back, or with sweating or breathlessness, can be a heart attack. "
        "Call 112 or 108 now. Do not drive yourself. Sit and rest while you wait.",
        [r"\bchest (pain|pressure|tightness|heaviness)\b", r"\bpain in (my )?chest\b", r"\bseene? (mein|me) dard\b", r"\bheart attack\b"],
    ),
    (
        "emergency",
        "Possible stroke: act FAST",
        "Face drooping, arm weakness, or slurred speech are stroke signs. Note the time symptoms began and call 112 or 108 immediately; "
        "treatment works best within hours.",
        [r"\bface (is )?droop", r"\bslurred speech\b", r"\b(one|left|right) side (of my body )?(is )?(weak|numb)\b", r"\bsudden(ly)? (can'?t|cannot) (speak|talk|see)\b", r"\bstroke\b"],
    ),
    (
        "emergency",
        "Severe breathing difficulty",
        "Struggling to breathe, blue lips or being unable to speak in full sentences needs emergency care. Call 112 or 108 now.",
        [r"\b(can'?t|cannot|unable to) breathe\b", r"\bsevere (shortness of breath|breathlessness)\b", r"\bblue lips\b", r"\bsaans (nahi|nahin) aa\b", r"\bchoking\b"],
    ),
    (
        "emergency",
        "Possible severe allergic reaction",
        "Swelling of the face, lips or throat with trouble breathing can be anaphylaxis. Use an adrenaline auto-injector if you have one and call 112.",
        [r"\b(throat|tongue|lips?) (is |are )?swell", r"\banaphyla"],
    ),
    (
        "emergency",
        "This needs emergency care",
        "Loss of consciousness, a seizure, heavy bleeding or a severe head injury needs emergency care. Call 112 or 108 now.",
        [r"\b(unconscious|passed out|fainted and)\b", r"\bseizure\b", r"\bfit(s)? (aa|aya)\b", r"\b(heavy|severe|uncontrolled) bleeding\b", r"\bvomiting blood\b", r"\bhead injury\b"],
    ),
    (
        "urgent",
        "Please see a doctor today",
        "High fever with a stiff neck, confusion, or a rash that doesn't fade when pressed, or any high fever in an infant, needs a doctor today.",
        [r"\bstiff neck\b", r"\bfever\b.*\b(confus|rash|stiff)", r"\bbaby\b.*\bfever\b", r"\bdengue\b.*\b(bleed|platelet)"],
    ),
]

_COMPILED = [(lvl, title, msg, [re.compile(p, re.IGNORECASE) for p in pats]) for lvl, title, msg, pats in _RULES]


def detect_red_flag(text: str) -> Optional[RedFlag]:
    if not text:
        return None
    for level, title, message, patterns in _COMPILED:
        if any(p.search(text) for p in patterns):
            if level == "crisis":
                actions = [TELE_MANAS, EMERGENCY_CALL]
            elif level == "emergency":
                actions = [EMERGENCY_CALL, AMBULANCE_CALL]
            else:
                actions = [{"label": "Find a clinic nearby", "href": "/appointments"}]
            return RedFlag(level=level, title=title, message=message, actions=actions)
    return None
