"""Eval metrics, the CI safety gates, and the two-layer safety check."""
import asyncio
import json

import httpx
import pytest

from app import llm as llm_module
from app.config import ProviderConfig
from app.safety import assess_safety, combine, detect_red_flag
from evals.metrics import score_red_flags, score_triage
from evals.run import load, run_red_flags, run_triage


# ------------------------------------------------------------------ metric functions

def test_red_flag_metrics():
    rows = [
        {"id": "a", "expected": "emergency", "predicted": "emergency"},
        {"id": "b", "expected": "crisis", "predicted": "emergency"},  # still an immediate response
        {"id": "c", "expected": "emergency", "predicted": None},
        {"id": "d", "expected": None, "predicted": "urgent"},
        {"id": "e", "expected": None, "predicted": None},
    ]
    m = score_red_flags(rows)
    assert m["immediate_recall"] == pytest.approx(2 / 3, abs=0.001)
    assert m["false_positive_rate"] == 0.5
    assert m["missed"] == ["c"] and m["false_positives"] == ["d"]


def test_triage_metrics_flag_dangerous_under_triage():
    rows = [
        {"id": "a", "specialties": ["cardiology"], "urgency": ["urgent", "emergency"], "predicted_specialty": "cardiology", "predicted_urgency": "soon"},
        {"id": "b", "specialties": ["*"], "urgency": ["emergency", "emergency"], "predicted_specialty": "general", "predicted_urgency": "emergency"},
        {"id": "c", "specialties": ["dentistry"], "urgency": ["routine", "soon"], "predicted_specialty": "general", "predicted_urgency": "urgent"},
    ]
    m = score_triage(rows)
    assert m["dangerous"] == ["a"] and m["over_triaged"] == ["c"]
    assert m["emergency_recall"] == 1.0
    assert m["specialty_accuracy"] == pytest.approx(0.667, abs=0.001)


def test_datasets_are_well_formed():
    for case in load("triage"):
        assert case["text"] and case["specialties"] and len(case["urgency"]) == 2
    levels = {c["expected"] for c in load("red_flags") + load("red_flags_holdout")}
    assert levels <= {"emergency", "crisis", "urgent", None}


# ------------------------------------------------------------------ CI gates
# The rules must never regress on the cases they were built for.

def test_gate_rules_catch_every_emergency_and_crisis():
    m, _ = asyncio.run(run_red_flags("red_flags", "rules", 0))
    assert m["immediate_recall"] == 1.0, m["missed"]
    assert m["urgent_recall"] >= 0.8
    assert m["false_positive_rate"] <= 0.1, m["false_positives"]


def test_gate_no_dangerous_under_triage_without_ai():
    m, _ = asyncio.run(run_triage("rules", 0))
    assert m["dangerous_under_triage"] == 0, m["dangerous"]
    assert m["emergency_recall"] == 1.0


# ------------------------------------------------------------------ two-layer safety

def _classifier_client(level):
    def handler(request):
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps({"level": level, "reason": "test"})}}]})

    provider = ProviderConfig(name="gemini", base_url="https://gemini.test/v1", api_key="k", text_models=["m"], vision_models=[])
    return llm_module.LLMClient(providers=[provider], http=httpx.AsyncClient(transport=httpx.MockTransport(handler)), timeout=5)


def test_combine_takes_the_more_severe_verdict():
    urgent = detect_red_flag("fever and a stiff neck")
    assert combine(urgent, "emergency").level == "emergency"
    assert combine(urgent, None).level == "urgent"
    assert combine(None, "crisis").level == "crisis"
    assert combine(None, None) is None


def test_ai_layer_catches_what_rules_miss():
    text = "everything feels pointless and I've written goodbye letters"
    assert detect_red_flag(text) is None
    llm_module.set_llm(_classifier_client("crisis"))
    flag, source = asyncio.run(assess_safety(text))
    assert flag.level == "crisis" and source == "rules+ai"
    assert any("14416" in a["href"] for a in flag.actions)


def test_ai_layer_cannot_downgrade_a_rule_emergency():
    llm_module.set_llm(_classifier_client("none"))
    flag, source = asyncio.run(assess_safety("crushing chest pain going to my left arm"))
    assert flag.level == "emergency" and source == "rules"


def test_falls_back_to_rules_when_ai_is_down():
    llm_module.set_llm(llm_module.LLMClient(providers=[]))
    flag, source = asyncio.run(assess_safety("fever and a stiff neck"))
    assert flag.level == "urgent" and source == "rules (ai unavailable)"


def test_chat_uses_ai_safety_verdict():
    from fastapi.testclient import TestClient
    import main

    llm_module.set_llm(_classifier_client("emergency"))
    res = TestClient(main.app).post("/chat", json={"messages": [{"role": "user", "content": "my son hit his head, now he keeps vomiting and is very sleepy"}]})
    body = res.json()
    assert res.status_code == 200 and body["aiSource"] == "safety-ai"
    assert body["redFlag"]["level"] == "emergency" and "112" in body["reply"]
