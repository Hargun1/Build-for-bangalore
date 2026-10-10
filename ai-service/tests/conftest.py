import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Tests never use real keys or the network.
for key in ("GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "AI_INTERNAL_TOKEN"):
    os.environ[key] = ""


@pytest.fixture(autouse=True)
def fresh_settings():
    from app import llm
    from app.config import get_settings

    get_settings.cache_clear()
    llm.set_llm(None)
    yield
    get_settings.cache_clear()
    llm.set_llm(None)
