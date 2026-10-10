"""Provider-agnostic LLM client with automatic fallback.

One `complete()` call tries each configured provider in order (Gemini, Groq,
OpenRouter by default) and each provider's models in order, until one returns
a usable answer. When a JSON schema is given, the answer must parse and
validate against it, otherwise the next model is tried.

Failure handling:
  * 429 / 5xx / timeout  -> try the next model; a 429 also rests that provider for 60 s
  * 400                  -> retry once without `response_format` (some models reject it), then next model
  * 401 / 403            -> the key is wrong; disable that provider until restart
  * invalid JSON         -> one repair attempt on the same model, then next model
If everything fails, `LLMUnavailable` is raised and each endpoint decides on an
honest fallback (usually rule-based output labelled as such).
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Optional, Type

import httpx
from cachetools import TTLCache
from pydantic import BaseModel, ValidationError

from .config import ProviderConfig, get_settings

logger = logging.getLogger("pranexus.llm")


class LLMUnavailable(Exception):
    """Raised when no provider could produce a valid answer."""


@dataclass
class LLMResult:
    text: str
    data: Any
    provider: str
    model: str
    latency_ms: int

    @property
    def source(self) -> str:
        return f"{self.provider}:{self.model}"


@dataclass
class ProviderState:
    calls: int = 0
    failures: int = 0
    disabled_reason: str = ""
    resting_until: float = 0.0
    last_ok_at: float = 0.0
    last_error: str = ""
    # Free tiers count quota per model, so a 429 rests only that model.
    model_resting_until: dict = field(default_factory=dict)


_RETRY_TEXT = re.compile(r"retry in\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+(?:\.\d+)?)s)?", re.IGNORECASE)


def retry_after_seconds(resp: httpx.Response, default: float = 60.0) -> float:
    """How long a 429 asks us to wait: Retry-After header, Google's retryDelay, or "retry in 2h28m59s"."""
    header = resp.headers.get("retry-after")
    if header and header.replace(".", "", 1).isdigit():
        return min(float(header), 86400)
    text = resp.text or ""
    m = re.search(r'"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"', text)
    if m:
        return min(float(m.group(1)), 86400)
    m = _RETRY_TEXT.search(text)
    if m and any(m.groups()):
        h, mins, secs = (float(g) if g else 0.0 for g in m.groups())
        return min(h * 3600 + mins * 60 + secs, 86400)
    return default


_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)


def extract_json(text: str) -> Any:
    """Parses JSON from a model reply that may wrap it in prose or ``` fences."""
    if text is None:
        raise ValueError("empty reply")
    cleaned = _FENCE.sub("", text.strip()).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # Fall back to the outermost {...} or [...] block.
    for open_ch, close_ch in (("{", "}"), ("[", "]")):
        start, end = cleaned.find(open_ch), cleaned.rfind(close_ch)
        if start != -1 and end > start:
            try:
                return json.loads(cleaned[start : end + 1])
            except json.JSONDecodeError:
                continue
    raise ValueError("reply did not contain valid JSON")


def to_data_uri(image: str) -> str:
    """Accepts a data URI or bare base64 and returns a data URI the APIs accept."""
    image = image.strip()
    if image.startswith("data:image/"):
        return image
    # Sniff the format from the first bytes so PNGs are not mislabelled as JPEG.
    head = base64.b64decode(image[:32] + "=" * (-len(image[:32]) % 4), validate=False)
    mime = "image/png" if head.startswith(b"\x89PNG") else "image/webp" if b"WEBP" in head else "image/jpeg"
    return f"data:{mime};base64,{image}"


def schema_instructions(schema: Type[BaseModel]) -> str:
    return (
        "Respond with ONLY a JSON object, no markdown fences and no commentary. "
        "It must match this JSON Schema:\n" + json.dumps(schema.model_json_schema(), separators=(",", ":"))
    )


class LLMClient:
    def __init__(self, providers: Optional[list[ProviderConfig]] = None, http: Optional[httpx.AsyncClient] = None, timeout: Optional[float] = None):
        settings = get_settings()
        self.providers = providers if providers is not None else settings.providers
        self.timeout = timeout or settings.timeout_seconds
        self._http = http
        self.state: dict[str, ProviderState] = {p.name: ProviderState() for p in self.providers}
        self._cache: TTLCache = TTLCache(maxsize=256, ttl=600)

    @property
    def http(self) -> httpx.AsyncClient:
        if self._http is None:
            self._http = httpx.AsyncClient(timeout=self.timeout)
        return self._http

    async def aclose(self) -> None:
        if self._http is not None:
            await self._http.aclose()

    def ready_models(self, p: ProviderConfig, vision: bool = False) -> list[str]:
        now = time.time()
        resting = self.state[p.name].model_resting_until
        return [m for m in (p.vision_models if vision else p.text_models) if resting.get(m, 0) <= now]

    def available_providers(self, vision: bool = False) -> list[ProviderConfig]:
        now = time.time()
        out = []
        for p in self.providers:
            st = self.state[p.name]
            if p.enabled and not st.disabled_reason and st.resting_until <= now and self.ready_models(p, vision):
                out.append(p)
        return out

    def status(self) -> list[dict]:
        rows = []
        for p in self.providers:
            st = self.state[p.name]
            rows.append(
                {
                    "provider": p.name,
                    "configured": p.enabled,
                    "textModels": p.text_models,
                    "visionModels": p.vision_models,
                    "calls": st.calls,
                    "failures": st.failures,
                    "disabledReason": st.disabled_reason or None,
                    "restingForSeconds": max(0, int(st.resting_until - time.time())),
                    "restingModels": {m: int(t - time.time()) for m, t in st.model_resting_until.items() if t > time.time()},
                    "lastError": st.last_error or None,
                    "lastOkAt": int(st.last_ok_at) or None,
                }
            )
        return rows

    async def complete(
        self,
        messages: list[dict],
        *,
        schema: Optional[Type[BaseModel]] = None,
        images: Optional[list[str]] = None,
        temperature: float = 0.3,
        max_tokens: int = 1500,
        cache: bool = False,
    ) -> LLMResult:
        vision = bool(images)
        msgs = self._build_messages(messages, schema, images)

        cache_key = None
        if cache:
            raw = json.dumps([msgs, schema.__name__ if schema else None, temperature], sort_keys=True)
            cache_key = hashlib.sha256(raw.encode()).hexdigest()
            if cache_key in self._cache:
                return self._cache[cache_key]

        providers = self.available_providers(vision=vision)
        if not providers:
            raise LLMUnavailable("No AI provider is configured" if not any(p.enabled for p in self.providers) else "All AI providers are resting or disabled")

        errors: list[str] = []
        for provider in providers:
            for model in self.ready_models(provider, vision):
                if self.state[provider.name].disabled_reason:
                    break
                try:
                    result = await self._try_model(provider, model, msgs, schema, temperature, max_tokens)
                except _SkipProvider as exc:
                    errors.append(f"{provider.name}: {exc}")
                    break
                except _TryNext as exc:
                    errors.append(f"{provider.name}/{model}: {exc}")
                    continue
                if cache_key:
                    self._cache[cache_key] = result
                return result
        raise LLMUnavailable("; ".join(errors[-4:]) or "no provider answered")

    def _build_messages(self, messages, schema, images):
        msgs = [dict(m) for m in messages]
        if schema is not None:
            instr = schema_instructions(schema)
            if msgs and msgs[0]["role"] == "system":
                msgs[0]["content"] = f"{msgs[0]['content']}\n\n{instr}"
            else:
                msgs.insert(0, {"role": "system", "content": instr})
        if images:
            # Attach images to the last user message as OpenAI-style content parts.
            for i in range(len(msgs) - 1, -1, -1):
                if msgs[i]["role"] == "user":
                    text = msgs[i]["content"]
                    parts = [{"type": "text", "text": text}]
                    parts += [{"type": "image_url", "image_url": {"url": to_data_uri(img)}} for img in images]
                    msgs[i] = {"role": "user", "content": parts}
                    break
        return msgs

    async def _post(self, provider: ProviderConfig, payload: dict) -> httpx.Response:
        headers = {"Authorization": f"Bearer {provider.api_key}", "Content-Type": "application/json", **provider.extra_headers}
        return await self.http.post(f"{provider.base_url}/chat/completions", headers=headers, json=payload, timeout=self.timeout)

    async def _try_model(self, provider, model, msgs, schema, temperature, max_tokens) -> LLMResult:
        st = self.state[provider.name]
        payload = {"model": model, "messages": msgs, "temperature": temperature, "max_tokens": max_tokens, **provider.extra_body}
        optional_keys = ["response_format", *provider.extra_body.keys()]
        if schema is not None:
            payload["response_format"] = {"type": "json_object"}

        started = time.perf_counter()
        repaired = False
        dropped_format = False
        while True:
            st.calls += 1
            try:
                resp = await self._post(provider, payload)
            except httpx.TimeoutException:
                self._fail(st, "timeout")
                raise _TryNext("timeout")
            except httpx.HTTPError as exc:
                self._fail(st, f"network: {exc.__class__.__name__}")
                raise _TryNext("network error")

            if resp.status_code in (401, 403):
                st.disabled_reason = f"HTTP {resp.status_code}: check the API key"
                self._fail(st, st.disabled_reason)
                logger.error("Provider %s rejected the API key (%s)", provider.name, resp.status_code)
                raise _SkipProvider(st.disabled_reason)
            if resp.status_code == 429:
                wait = retry_after_seconds(resp)
                st.model_resting_until[model] = time.time() + wait
                self._fail(st, f"{model} rate limited (429), resting {int(wait)}s")
                raise _TryNext(f"rate limited for {int(wait)}s")
            if resp.status_code == 400 and not dropped_format and any(k in payload for k in optional_keys):
                # Some models reject JSON mode or extra fields: retry once without them.
                for k in optional_keys:
                    payload.pop(k, None)
                dropped_format = True
                continue
            if resp.status_code >= 400:
                self._fail(st, f"HTTP {resp.status_code}: {resp.text[:160]}")
                raise _TryNext(f"HTTP {resp.status_code}")

            try:
                body = resp.json()
                text = body["choices"][0]["message"].get("content") or ""
            except (ValueError, KeyError, IndexError, TypeError):
                self._fail(st, "malformed response body")
                raise _TryNext("malformed response")
            if isinstance(text, list):  # some providers return content parts
                text = "".join(part.get("text", "") for part in text if isinstance(part, dict))
            if not text.strip():
                self._fail(st, "empty reply")
                raise _TryNext("empty reply")

            data: Any = None
            if schema is not None:
                try:
                    data = schema.model_validate(extract_json(text))
                except (ValueError, ValidationError) as exc:
                    if repaired:
                        self._fail(st, "invalid JSON after repair")
                        raise _TryNext("invalid JSON")
                    repaired = True
                    payload["messages"] = msgs + [
                        {"role": "assistant", "content": text[:4000]},
                        {"role": "user", "content": f"That was not valid for the schema ({str(exc)[:300]}). Reply again with only the corrected JSON object."},
                    ]
                    continue

            st.last_ok_at = time.time()
            st.last_error = ""
            latency = int((time.perf_counter() - started) * 1000)
            logger.info("LLM ok provider=%s model=%s latency_ms=%d", provider.name, model, latency)
            return LLMResult(text=text, data=data, provider=provider.name, model=model, latency_ms=latency)

    @staticmethod
    def _fail(st: ProviderState, reason: str) -> None:
        st.failures += 1
        st.last_error = reason
        logger.warning("LLM attempt failed: %s", reason)


class _TryNext(Exception):
    pass


class _SkipProvider(Exception):
    pass


_client: Optional[LLMClient] = None


def get_llm() -> LLMClient:
    global _client
    if _client is None:
        _client = LLMClient()
    return _client


def set_llm(client: Optional[LLMClient]) -> None:
    """Used by tests to inject a client with a mocked transport."""
    global _client
    _client = client
