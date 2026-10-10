"""Retrieval-augmented chat: retriever behaviour, citation handling, and a CI gate on retrieval quality."""
import asyncio
import json

import httpx
import pytest

from app import llm as llm_module
from app.config import ProviderConfig
from rag import cited
from rag.retriever import Retriever, americanise, expand_query, rrf, tokenize
from evals.run import run_retrieval


def test_indian_terms_are_expanded():
    assert "diarrhea" in expand_query("loose motions since morning")
    assert "hypertension" in expand_query("how to reduce high bp")
    assert "hemorrhoids" in expand_query("piles pain")
    assert expand_query("knee pain") == "knee pain"


def test_british_spelling_matches_american_corpus():
    assert americanise("haemoglobin") == "hemoglobin"
    assert tokenize("diarrhoea") == tokenize("diarrhea")


def test_rrf_rewards_agreement_between_rankers():
    fused = rrf([[(1, 9.0), (2, 5.0)], [(2, 0.9), (3, 0.8)]])
    assert fused[0][0] == 2


@pytest.mark.parametrize("query,title", [
    ("what is HbA1c", "A1C"),
    ("acidity after meals", "Heartburn"),
    ("dengue warning signs", "Dengue"),
])
def test_retriever_finds_the_right_topic(query, title):
    assert title in [r["title"] for r in Retriever.load().search(query, k=3)]


def test_gate_retrieval_recall():
    m, _ = asyncio.run(run_retrieval("expanded"))
    assert m["recall_at_5"] >= 0.85, m["misses"]


def test_cited_keeps_only_real_citations():
    passages = [{"title": "Dengue", "url": "https://medlineplus.gov/dengue.html"}, {"title": "Fever", "url": "https://medlineplus.gov/fever.html"}]
    text, sources = cited("Drink fluids [2]. Watch for bleeding [1][1]. Rest [7].", passages)
    assert [s["n"] for s in sources] == [2, 1]
    assert "[7]" not in text and sources[0]["title"] == "Fever"


def test_chat_returns_cited_sources():
    from fastapi.testclient import TestClient
    import main

    def handler(request):
        body = json.loads(request.content)
        system = body["messages"][0]["content"]
        if "safety triage filter" in system:
            content = json.dumps({"level": "none"})
        else:
            assert "[1] Dengue" in system  # passages reached the model
            content = "Dengue spreads through mosquito bites [1]. Watch for bleeding gums and see a doctor."
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})

    provider = ProviderConfig(name="gemini", base_url="https://g.test/v1", api_key="k", text_models=["m"], vision_models=[])
    llm_module.set_llm(llm_module.LLMClient(providers=[provider], http=httpx.AsyncClient(transport=httpx.MockTransport(handler)), timeout=5))
    res = TestClient(main.app).post("/chat", json={"messages": [{"role": "user", "content": "what are dengue warning signs"}]})
    body = res.json()
    assert res.status_code == 200 and body["sources"][0]["title"] == "Dengue"
    assert body["sources"][0]["url"].startswith("https://medlineplus.gov/")
    assert body["retrieval"] in ("keyword", "hybrid")
