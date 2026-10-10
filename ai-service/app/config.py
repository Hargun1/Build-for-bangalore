"""Settings read from environment variables.

Values are read when `get_settings()` is called (not at import time), so a
`.env` file loaded in main.py is always seen. That import-order bug is what
silently disabled every AI call in the original version of this service.
"""
import os
from dataclasses import dataclass, field
from functools import lru_cache


def _csv(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    base_url: str
    api_key: str
    text_models: list[str]
    vision_models: list[str]
    extra_headers: dict = field(default_factory=dict)

    @property
    def enabled(self) -> bool:
        return bool(self.api_key) and not self.api_key.startswith("your_")


@dataclass(frozen=True)
class Settings:
    providers: list[ProviderConfig]
    internal_token: str
    timeout_seconds: float
    cors_origins: list[str]


def _provider_table() -> dict[str, ProviderConfig]:
    # All three providers expose an OpenAI-compatible /chat/completions endpoint
    # and have a free tier. Model lists are overridable without code changes,
    # because free model IDs change often.
    return {
        "gemini": ProviderConfig(
            name="gemini",
            base_url="https://generativelanguage.googleapis.com/v1beta/openai",
            api_key=os.getenv("GEMINI_API_KEY", ""),
            text_models=_csv("GEMINI_MODELS", "gemini-3.8-flash,gemini-3.5-flash-lite"),
            vision_models=_csv("GEMINI_VISION_MODELS", "gemini-3.8-flash,gemini-3.5-flash-lite"),
        ),
        "groq": ProviderConfig(
            name="groq",
            base_url="https://api.groq.com/openai/v1",
            api_key=os.getenv("GROQ_API_KEY", ""),
            text_models=_csv("GROQ_MODELS", "llama-3.3-70b-versatile,openai/gpt-oss-120b"),
            vision_models=_csv("GROQ_VISION_MODELS", ""),
        ),
        "openrouter": ProviderConfig(
            name="openrouter",
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY", ""),
            text_models=_csv("OPENROUTER_MODELS", "google/gemma-4-31b-it:free,nvidia/nemotron-3-super-120b-a12b:free"),
            vision_models=_csv("OPENROUTER_VISION_MODELS", "google/gemma-4-31b-it:free"),
            extra_headers={"X-Title": "PranexusAI"},
        ),
    }


@lru_cache
def get_settings() -> Settings:
    table = _provider_table()
    order = _csv("LLM_PROVIDER_ORDER", "gemini,groq,openrouter")
    providers = [table[name] for name in order if name in table]
    return Settings(
        providers=providers,
        internal_token=os.getenv("AI_INTERNAL_TOKEN", ""),
        timeout_seconds=float(os.getenv("LLM_TIMEOUT_SECONDS", "40")),
        cors_origins=_csv("CORS_ORIGINS", ""),
    )
