"""PranexusAI health-intelligence service.

Stateless FastAPI app called only by the Node backend. It owns:
  * the shared LLM client (free providers with fallback), app/llm.py
  * deterministic, published risk scores, app/risk.py
  * rule-based red-flag detection that runs before any model, app/safety.py
"""
from dotenv import load_dotenv

# Must run before anything reads environment variables.
load_dotenv()

import logging  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402

from fastapi import Depends, FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.llm import get_llm  # noqa: E402
from app.routers import chat, exposome, goals, labs, nutrition, risk, triage, vision  # noqa: E402
from app.security import require_internal_token  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("pranexus")


@asynccontextmanager
async def lifespan(app: FastAPI):
    configured = [p.name for p in get_settings().providers if p.enabled]
    if configured:
        logger.info("AI providers configured: %s", ", ".join(configured))
    else:
        logger.warning("No AI provider key set (GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY). AI features will use rule-based fallbacks.")
    if not get_settings().internal_token:
        logger.warning("AI_INTERNAL_TOKEN not set: this service accepts requests from anyone. Set it in production.")
    yield
    await get_llm().aclose()


app = FastAPI(title="PranexusAI health-intelligence service", version="2.0.0", lifespan=lifespan)

if get_settings().cors_origins:
    app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins, allow_methods=["POST", "GET"], allow_headers=["*"])

protected = [Depends(require_internal_token)]
app.include_router(risk.router, prefix="/risk", tags=["Risk"], dependencies=protected)
app.include_router(chat.router, prefix="/chat", tags=["Chat"], dependencies=protected)
app.include_router(vision.router, prefix="/vision", tags=["Vision"], dependencies=protected)
app.include_router(labs.router, prefix="/labs", tags=["Labs"], dependencies=protected)
app.include_router(nutrition.router, prefix="/nutrition", tags=["Nutrition"], dependencies=protected)
app.include_router(goals.router, prefix="/goals", tags=["Goals"], dependencies=protected)
app.include_router(exposome.router, prefix="/exposome", tags=["Exposome"], dependencies=protected)
app.include_router(triage.router, prefix="/triage", tags=["Triage"], dependencies=protected)


@app.get("/")
def root():
    return {"service": "PranexusAI health-intelligence service", "status": "running", "health": "/health"}


@app.get("/health")
def health():
    providers = get_llm().status()
    try:
        from rag.retriever import Retriever

        r = Retriever.load()
        kb = {
            "source": "MedlinePlus (U.S. National Library of Medicine)",
            "topics": len({c["url"] for c in r.chunks}),
            "passages": len(r.chunks),
            "embeddedTopics": 0 if r.embeddings is None else int(r.embeddings.shape[0]),
        }
    except Exception as exc:  # knowledge base missing: chat still works, without citations
        kb = {"error": str(exc)}
    return {
        "status": "ok",
        "aiReady": any(p["configured"] and not p["disabledReason"] for p in providers),
        "providers": providers,
        "knowledgeBase": kb,
    }
