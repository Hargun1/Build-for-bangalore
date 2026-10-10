import asyncio
import json

import httpx
import pytest
from pydantic import BaseModel

from app.config import ProviderConfig
from app.llm import LLMClient, LLMUnavailable, extract_json, to_data_uri


class Answer(BaseModel):
    value: int


def provider(name, models=("m1",), vision=()):
    return ProviderConfig(name=name, base_url=f"https://{name}.test/v1", api_key="k", text_models=list(models), vision_models=list(vision))


def reply(text, status=200):
    return httpx.Response(status, json={"choices": [{"message": {"content": text}}]})


def client_with(handler, providers):
    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return LLMClient(providers=providers, http=http, timeout=5)


def run(coro):
    return asyncio.run(coro)


def test_falls_back_to_next_provider_on_rate_limit():
    seen = []

    def handler(request):
        seen.append(request.url.host)
        if request.url.host == "gemini.test":
            return httpx.Response(429, json={"error": "quota"})
        return reply("hello from groq")

    c = client_with(handler, [provider("gemini"), provider("groq")])
    res = run(c.complete([{"role": "user", "content": "hi"}]))
    assert res.provider == "groq" and res.text == "hello from groq"
    assert seen == ["gemini.test", "groq.test"]
    # Gemini rests for 60 s after a 429, so the next call skips it.
    assert [p.name for p in c.available_providers()] == ["groq"]


def test_bad_key_disables_provider():
    def handler(request):
        return httpx.Response(401) if request.url.host == "gemini.test" else reply("ok")

    c = client_with(handler, [provider("gemini", models=("a", "b")), provider("groq")])
    assert run(c.complete([{"role": "user", "content": "hi"}])).provider == "groq"
    assert c.state["gemini"].disabled_reason.startswith("HTTP 401")


def test_tries_next_model_within_provider_on_server_error():
    def handler(request):
        model = json.loads(request.content)["model"]
        return httpx.Response(500) if model == "m1" else reply("from m2")

    c = client_with(handler, [provider("gemini", models=("m1", "m2"))])
    assert run(c.complete([{"role": "user", "content": "hi"}])).model == "m2"


def test_json_schema_is_validated_and_repaired_once():
    calls = []

    def handler(request):
        calls.append(json.loads(request.content))
        return reply("not json at all") if len(calls) == 1 else reply('```json\n{"value": 7}\n```')

    c = client_with(handler, [provider("gemini")])
    res = run(c.complete([{"role": "user", "content": "give"}], schema=Answer))
    assert res.data.value == 7
    assert len(calls) == 2 and "corrected JSON" in calls[1]["messages"][-1]["content"]


def test_drops_response_format_when_model_rejects_it():
    calls = []

    def handler(request):
        body = json.loads(request.content)
        calls.append("response_format" in body)
        return httpx.Response(400, json={"error": "unsupported"}) if "response_format" in body else reply('{"value": 1}')

    c = client_with(handler, [provider("gemini")])
    assert run(c.complete([{"role": "user", "content": "x"}], schema=Answer)).data.value == 1
    assert calls == [True, False]


def test_raises_when_nothing_configured():
    empty = ProviderConfig(name="gemini", base_url="https://x", api_key="", text_models=["m"], vision_models=[])
    c = LLMClient(providers=[empty], http=httpx.AsyncClient())
    with pytest.raises(LLMUnavailable, match="No AI provider is configured"):
        run(c.complete([{"role": "user", "content": "hi"}]))


def test_images_only_go_to_vision_capable_providers():
    hosts = []

    def handler(request):
        hosts.append(request.url.host)
        body = json.loads(request.content)
        parts = body["messages"][-1]["content"]
        assert parts[1]["image_url"]["url"].startswith("data:image/png;base64,")
        return reply("a plate of idli")

    png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    c = client_with(handler, [provider("groq"), provider("gemini", vision=("v1",))])
    res = run(c.complete([{"role": "user", "content": "what is this"}], images=[png_b64]))
    assert res.provider == "gemini" and hosts == ["gemini.test"]


def test_extract_json_handles_prose_and_fences():
    assert extract_json('Sure! {"a": 1} hope that helps') == {"a": 1}
    assert extract_json("```json\n[1, 2]\n```") == [1, 2]
    with pytest.raises(ValueError):
        extract_json("no json here")


def test_to_data_uri_keeps_existing_uri():
    assert to_data_uri("data:image/jpeg;base64,abc") == "data:image/jpeg;base64,abc"


def test_rate_limit_rests_only_that_model():
    calls = []

    def handler(request):
        model = json.loads(request.content)["model"]
        calls.append(model)
        if model == "flash":
            return httpx.Response(429, text="Quota exceeded. Please retry in 2h28m59s.")
        return reply(f"from {model}")

    c = client_with(handler, [provider("gemini", models=("flash", "lite"))])
    assert run(c.complete([{"role": "user", "content": "hi"}])).model == "lite"
    # Second call skips the resting model without spending a request on it.
    assert run(c.complete([{"role": "user", "content": "hi again"}])).model == "lite"
    assert calls == ["flash", "lite", "lite"]
    resting = c.status()[0]["restingModels"]
    assert 8900 < resting["flash"] <= 8939


def test_retry_after_parsing():
    from app.llm import retry_after_seconds

    assert retry_after_seconds(httpx.Response(429, headers={"retry-after": "30"})) == 30
    assert retry_after_seconds(httpx.Response(429, text='{"retryDelay": "41s"}')) == 41
    assert retry_after_seconds(httpx.Response(429, text="Please retry in 1m5s")) == 65
    assert retry_after_seconds(httpx.Response(429, text="slow down")) == 60
