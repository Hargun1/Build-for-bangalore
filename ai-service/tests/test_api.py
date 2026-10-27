import os

import pytest
from fastapi.testclient import TestClient

from app.safety import detect_red_flag


@pytest.fixture
def client():
    import main

    return TestClient(main.app)


@pytest.mark.parametrize("text,level", [
    ("I have crushing chest pain going to my left arm", "emergency"),
    ("my dad's face is drooping and his speech is slurred", "emergency"),
    ("I can't breathe properly", "emergency"),
    ("I want to kill myself", "crisis"),
    ("fever and a stiff neck since morning", "urgent"),
    ("seene mein dard ho raha hai", "emergency"),
])
def test_red_flags(text, level):
    assert detect_red_flag(text).level == level


def test_no_red_flag_for_ordinary_question():
    assert detect_red_flag("what should I eat for better sleep?") is None


def test_health_reports_no_ai_without_keys(client):
    body = client.get("/health").json()
    assert body["aiReady"] is False and {p["provider"] for p in body["providers"]} == {"gemini", "groq", "openrouter"}


def test_health_does_not_call_resting_models_ready(client, monkeypatch):
    import main

    class RestingClient:
        def status(self):
            return [{"provider": "gemini", "configured": True, "availableTextModels": []}]

    monkeypatch.setattr(main, "get_llm", lambda: RestingClient())
    assert client.get("/health").json()["aiReady"] is False


def test_internal_token_enforced(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("AI_INTERNAL_TOKEN", "s3cret")
    get_settings.cache_clear()
    assert client.post("/risk/assess", json={"inputs": {}}).status_code == 401
    assert client.post("/risk/assess", json={"inputs": {}}, headers={"X-Internal-Token": "s3cret"}).status_code == 200


def test_risk_assess_falls_back_to_rules(client):
    res = client.post("/risk/assess", json={"inputs": {"heightCm": 170, "weightKg": 85, "avgSteps": 3000}})
    body = res.json()
    assert res.status_code == 200 and body["aiSource"] == "rules"
    assert {r["relatedTo"] for r in body["recommendations"]} == {"weight", "activity"}


def test_risk_without_data_does_not_claim_healthy(client):
    body = client.post("/risk/assess", json={"inputs": {}}).json()
    assert body["wellnessScore"] is None
    assert "not enough information" in body["summary"]


def test_risk_with_one_low_score_does_not_claim_whole_profile_healthy(client):
    body = client.post("/risk/assess", json={"inputs": {"avgSleepHours": 8}}).json()
    assert "some could not be calculated" in body["summary"]


def test_chat_answers_emergencies_without_ai(client):
    res = client.post("/chat", json={"messages": [{"role": "user", "content": "severe chest pain and sweating"}]})
    body = res.json()
    assert res.status_code == 200 and body["redFlag"]["level"] == "emergency" and body["aiSource"] == "safety-rules"


def test_chat_returns_503_when_ai_unavailable(client):
    res = client.post("/chat", json={"messages": [{"role": "user", "content": "how much water should I drink?"}]})
    assert res.status_code == 503


def test_goal_plan_template_fallback_is_safe(client):
    res = client.post("/goals/plan", json={"description": "lose 10 kg", "weeks": 4, "recent": {"weightKg": 90}})
    plan = res.json()["plan"]
    assert res.json()["planSource"] == "template" and plan["metric"] == "weightKg"
    assert plan["targetValue"] == 88.0  # 0.5 kg/week x 4 weeks


def test_triage_keyword_fallback(client):
    body = client.post("/triage", json={"symptoms": "itchy red rash on my arm for a week"}).json()
    assert body["specialty"] == "dermatology" and body["aiSource"] == "keywords"


def test_product_review_rules_without_ai(client):
    product = {"name": "Choco cookies", "nutriScore": "e", "novaGroup": 4, "per100g": {"sugars": 35, "salt": 0.6}}
    body = client.post("/nutrition/product-review", json={"product": product}).json()
    assert body["verdict"] == "limit" and any("sugar" in c.lower() for c in body["cons"])


def test_vision_needs_ai(client):
    res = client.post("/vision/meal", json={"image": "a" * 200})
    assert res.status_code == 503


@pytest.mark.parametrize("text,level", [
    ("My heart races and skips beats, no chest pain", None),
    ("cough for a week without any breathing difficulty", None),
    ("chest pain but no fever", "emergency"),
])
def test_negated_symptoms_are_not_red_flags(text, level):
    flag = detect_red_flag(text)
    assert (flag.level if flag else None) == level
