"""Retrieval-augmented answers grounded in MedlinePlus (see rag/retriever.py)."""
from __future__ import annotations

import re

from .retriever import Retriever

SOURCE_LABEL = "MedlinePlus, National Library of Medicine"


async def retrieve(query: str, k: int = 4) -> tuple[list[dict], str]:
    """Top passages for a question and the method used ("hybrid" or "keyword")."""
    r = Retriever.load()
    vec, method = None, "keyword"
    if r.embeddings is not None:
        try:
            from .embed import embed_query

            vec = await embed_query(query, timeout=4.0)
            method = "hybrid"
        except Exception:
            vec = None  # embedding API down or rate-limited: keyword search still works
    return r.search(query, k=k, query_vec=vec), method


def sources_block(passages: list[dict]) -> str:
    lines = ["Trusted reference passages (MedlinePlus, U.S. National Library of Medicine):"]
    for i, p in enumerate(passages, 1):
        lines.append(f"[{i}] {p['title']}: {p['text']}")
    return "\n".join(lines)


CITE_RULES = (
    "Use the reference passages for medical facts when they are relevant, and cite them inline with their number, "
    "like [1] or [2][3], right after the sentence they support. Only cite a passage that actually supports the sentence. "
    "If the passages don't cover the question, answer from general knowledge without citations. Never invent a citation number."
)


def cited(reply: str, passages: list[dict]) -> tuple[str, list[dict]]:
    """Keeps only citation numbers that exist, and returns the sources actually cited, in order."""
    nums = []
    for m in re.finditer(r"\[(\d{1,2})\]", reply):
        n = int(m.group(1))
        if 1 <= n <= len(passages) and n not in nums:
            nums.append(n)
    # Drop references to passages that don't exist (e.g. [7] when 4 were given).
    clean = re.sub(r"\[(\d{1,2})\]", lambda m: m.group(0) if 1 <= int(m.group(1)) <= len(passages) else "", reply)
    sources = [{"n": n, "title": passages[n - 1]["title"], "url": passages[n - 1]["url"], "source": SOURCE_LABEL} for n in nums]
    return clean, sources
