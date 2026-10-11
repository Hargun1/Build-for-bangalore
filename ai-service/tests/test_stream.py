"""Streaming chat: the LLM client's stream(), and the /chat/stream SSE endpoint's safety gate."""
import asyncio
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app import llm as llm_module
from app.config import ProviderConfig


def sse_body(pieces, metadata_chunk=True):
    lines = []
    for i, p in enumerate(pieces):
        lines.append("data: " + json.dumps({"choices": [{"delta": {"content": p}}]}))
        if metadata_chunk and i == 0:
            # Gemini sends chunks that only carry a "thought signature", no text.
            lines.append("data: " + json.dumps({"choices": [{"delta": {"extra_content": {"google": {"thought_signature": "x"}}}}]}))
    lines.append("data: [DONE]")
    return ("\n\n".join(lines) + "\n\n").encode()


def make_client(handler, models=("m1",)):
    provider = ProviderConfig(name="gemini", base_url="https://g.test/v1", api_key="k", text_models=list(models), vision_models=[])
    return llm_module.LLMClient(providers=[provider], http=httpx.AsyncClient(transport=httpx.MockTransport(handler)), timeout=5)


async def collect(client, meta=None):
    return [p async for p in client.stream([{"role": "user", "content": "hi"}], meta=meta)]


def test_stream_yields_text_pieces_and_skips_metadata():
    c = make_client(lambda req: httpx.Response(200, content=sse_body(["Drink ", "ORS ", "often."])))
    meta = {}
    assert asyncio.run(collect(c, meta)) == ["Drink ", "ORS ", "often."]
    assert meta["source"] == "gemini:m1"


def test_stream_falls_back_before_the_first_word():
    def handler(req):
        model = json.loads(req.content)["model"]
        if model == "flash":
            return httpx.Response(429, text="retry in 30s")
        return httpx.Response(200, content=sse_body(["from lite"]))

    c = make_client(handler, models=("flash", "lite"))
    meta = {}
    assert asyncio.run(collect(c, meta)) == ["from lite"]
    assert meta["source"] == "gemini:lite"
    assert "flash" in c.status()[0]["restingModels"]


def test_stream_overrides_reasoning_and_retries_without_it_on_400():
    seen = []

    def handler(req):
        body = json.loads(req.content)
        seen.append(body.get("reasoning_effort"))
        if "reasoning_effort" in body:
            return httpx.Response(400, json={"error": {"message": "INVALID_ARGUMENT"}})
        return httpx.Response(200, content=sse_body(["ok"]))

    provider = ProviderConfig(name="gemini", base_url="https://g.test/v1", api_key="k", text_models=["m1"], vision_models=[], extra_body={"reasoning_effort": "low"})
    c = llm_module.LLMClient(providers=[provider], http=httpx.AsyncClient(transport=httpx.MockTransport(handler)), timeout=5)
    out = asyncio.run(_collect_with(c, reasoning="minimal"))
    assert out == ["ok"]
    assert seen == ["minimal", None]  # override sent first, then the same model without extras


async def _collect_with(client, **kw):
    return [p async for p in client.stream([{"role": "user", "content": "hi"}], **kw)]


def test_stream_raises_when_no_model_starts():
    c = make_client(lambda req: httpx.Response(500, text="boom"))
    with pytest.raises(llm_module.LLMUnavailable):
        asyncio.run(collect(c))


# ------------------------------------------------------------------ endpoint

def events(response_text):
    out = []
    for block in response_text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line)
        out.append((lines["event"], json.loads(lines["data"])))
    return out


def endpoint_client(verdict, pieces):
    def handler(req):
        body = json.loads(req.content)
        if body.get("stream"):
            return httpx.Response(200, content=sse_body(pieces))
        # Non-streamed call = the safety classifier.
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps({"level": verdict})}}]})

    llm_module.set_llm(make_client(handler))
    import main

    return TestClient(main.app)


def test_stream_endpoint_sends_deltas_then_cited_reply():
    client = endpoint_client("none", ["Dengue spreads through mosquitoes ", "[1]. Rest well."])
    res = client.post("/chat/stream", json={"messages": [{"role": "user", "content": "how does dengue spread"}]})
    assert res.headers["content-type"].startswith("text/event-stream")
    evs = events(res.text)
    assert [e for e, _ in evs] == ["delta", "delta", "done"]
    done = evs[-1][1]
    assert done["reply"].startswith("Dengue spreads") and done["sources"][0]["title"] == "Dengue"
    assert done["aiSource"] == "gemini:m1"


def test_stream_endpoint_never_shows_text_when_ai_flags_emergency():
    client = endpoint_client("emergency", ["Probably just ", "gas, relax."])
    res = client.post("/chat/stream", json={"messages": [{"role": "user", "content": "my son hit his head and keeps vomiting"}]})
    evs = events(res.text)
    assert [e for e, _ in evs] == ["done"]
    assert evs[0][1]["aiSource"] == "safety-ai" and "112" in evs[0][1]["reply"]
    assert "gas" not in res.text


def test_stream_endpoint_rule_emergency_needs_no_model():
    llm_module.set_llm(llm_module.LLMClient(providers=[]))
    import main

    res = TestClient(main.app).post("/chat/stream", json={"messages": [{"role": "user", "content": "crushing chest pain to my left arm"}]})
    evs = events(res.text)
    assert evs == [("done", evs[0][1])] and evs[0][1]["aiSource"] == "safety-rules"


def test_stream_endpoint_reports_unavailable():
    llm_module.set_llm(llm_module.LLMClient(providers=[]))
    import main

    res = TestClient(main.app).post("/chat/stream", json={"messages": [{"role": "user", "content": "how much water should I drink"}]})
    evs = events(res.text)
    assert evs[-1][0] == "error" and "unavailable" in evs[-1][1]["message"]
