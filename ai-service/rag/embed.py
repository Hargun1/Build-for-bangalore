"""Gemini embeddings for the knowledge base (optional dense retrieval).

Build: ~3,000 passages in batches of 100 via batchEmbedContents, resumable, with
back-off on rate limits. Stored as float16 unit vectors (rag/data/embeddings.npy).
Query: one embedContent call per question; any failure makes the caller fall back
to keyword search, so chat never depends on the embedding API.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import time
from collections import OrderedDict
from pathlib import Path

import httpx

DATA = Path(__file__).resolve().parent / "data"
API = "https://generativelanguage.googleapis.com/v1beta/models"
MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")
DIM = int(os.getenv("EMBEDDING_DIM", "768"))
BATCH = 100


def _key() -> str:
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    return key


def passage_text(c: dict) -> str:
    also = f" (also called {', '.join(c['alsoCalled'])})" if c["alsoCalled"] else ""
    return f"{c['title']}{also}\n{c['text']}"


def _normalise(rows):
    import numpy as np

    arr = np.asarray(rows, dtype="float32")
    arr /= np.linalg.norm(arr, axis=1, keepdims=True) + 1e-12
    return arr


def build_embeddings(chunks: list[dict]) -> None:
    """One vector per topic (its first passage: title, synonyms and opening summary).

    The free tier allows ~1,000 embeddings a day, so per-topic vectors (about 1,000)
    fit in one day where per-passage vectors (about 3,000) would take three. Dense
    search picks topics; BM25 picks the best passage within them.
    """
    import numpy as np

    targets = [c for c in chunks if c["id"].endswith("-0")]
    partial = DATA / "embeddings.partial.json"
    done: dict[str, list[float]] = {}
    if partial.exists():
        saved = json.loads(partial.read_text())
        if isinstance(saved, list):  # older per-passage progress: keep the vectors that are first passages
            saved = {chunks[i]["id"]: v for i, v in enumerate(saved) if chunks[i]["id"].endswith("-0")}
        done = saved
    todo = [c for c in targets if c["id"] not in done]
    print(f"Embedding {len(targets)} topics with {MODEL} ({DIM} dims); {len(targets) - len(todo)} already done")
    with httpx.Client(timeout=120) as http:
        while todo:
            batch = todo[:BATCH]
            body = {
                "requests": [
                    {"model": f"models/{MODEL}", "content": {"parts": [{"text": passage_text(c)[:6000]}]}, "taskType": "RETRIEVAL_DOCUMENT", "outputDimensionality": DIM}
                    for c in batch
                ]
            }
            resp = http.post(f"{API}/{MODEL}:batchEmbedContents", headers={"x-goog-api-key": _key()}, json=body)
            if resp.status_code == 429:
                m = re.search(r"retry in\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+(?:\.\d+)?)s)?", resp.text, re.I)
                wait = 65.0
                if m and any(m.groups()):
                    h, mi, se = (float(g) if g else 0.0 for g in m.groups())
                    wait = h * 3600 + mi * 60 + se + 2
                if wait > 600 or "per day" in resp.text.lower() or "PerDay" in resp.text:
                    partial.write_text(json.dumps(done))
                    raise SystemExit(f"Daily embedding quota reached ({len(done)}/{len(targets)} topics); re-run later to resume.")
                print(f"  rate limited, waiting {wait:.0f}s")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            for c, e in zip(batch, resp.json()["embeddings"]):
                done[c["id"]] = e["values"]
            todo = todo[BATCH:]
            partial.write_text(json.dumps(done))
            print(f"  {len(done)}/{len(targets)}")
    ids = [c["id"] for c in targets]
    np.save(DATA / "embeddings.npy", _normalise([done[i] for i in ids]).astype("float16"))
    (DATA / "embeddings.ids.json").write_text(json.dumps(ids))
    (DATA / "embeddings.meta.json").write_text(json.dumps({"model": MODEL, "dim": DIM, "count": len(ids), "granularity": "topic"}))
    partial.unlink(missing_ok=True)
    print("Saved rag/data/embeddings.npy")


_query_cache: "OrderedDict[str, list[float]]" = OrderedDict()


async def embed_query(text: str, timeout: float = 8.0) -> list[float]:
    """Unit vector for a question. Raises on any failure (caller falls back to BM25)."""
    key = text.strip().lower()
    if key in _query_cache:
        _query_cache.move_to_end(key)
        return _query_cache[key]
    body = {"model": f"models/{MODEL}", "content": {"parts": [{"text": text[:2000]}]}, "taskType": "RETRIEVAL_QUERY", "outputDimensionality": DIM}
    async with httpx.AsyncClient(timeout=timeout) as http:
        resp = await http.post(f"{API}/{MODEL}:embedContent", headers={"x-goog-api-key": _key()}, json=body)
    resp.raise_for_status()
    vec = _normalise([resp.json()["embedding"]["values"]])[0].tolist()
    _query_cache[key] = vec
    if len(_query_cache) > 500:
        _query_cache.popitem(last=False)
    return vec


if __name__ == "__main__":
    asyncio.run(embed_query("test"))
