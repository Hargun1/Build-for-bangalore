"""Finds the MedlinePlus passages most relevant to a question.

Two retrievers, fused by Reciprocal Rank Fusion when both are available:
  * BM25 keyword search: no API calls, always on. Title and "also called" words are
    weighted up, and Indian English / Hinglish terms are expanded ("sugar" -> diabetes,
    "loose motions" -> diarrhea) because the corpus uses US terminology.
  * Dense (embedding) search: optional, used when rag/data/embeddings.npy exists and
    an embedding API key is configured.
Measured with evals/datasets/retrieval.jsonl (recall@k, MRR).
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path
from typing import Optional

DATA = Path(__file__).resolve().parent / "data"

STOPWORDS = set(
    "a an and are as at be been but by can could do does for from had has have how i if in into is it its my me of on or "
    "our should so some such than that the their them then there these they this to was we were what when which who why "
    "will with would you your yours am being did doing having he her him his she about after again all also any because "
    "before between both each few further here more most no nor not only other own same too very just over under up down "
    "out off once while during get got feel feeling since days day week weeks month months year years ago lot lots".split()
)

# Everyday Indian English and Hinglish -> the words MedlinePlus uses.
EXPANSIONS: dict[str, str] = {
    "sugar": "diabetes blood glucose",
    "sugar level": "diabetes blood glucose",
    "bp": "blood pressure hypertension",
    "high bp": "high blood pressure hypertension",
    "low bp": "low blood pressure hypotension",
    "acidity": "heartburn gerd acid reflux indigestion",
    "gas": "gas bloating flatulence",
    "loose motion": "diarrhea",
    "loose motions": "diarrhea",
    "motions": "stool bowel movement",
    "piles": "hemorrhoids",
    "fits": "seizures epilepsy",
    "tb": "tuberculosis",
    "thyroid": "thyroid hypothyroidism hyperthyroidism",
    "periods": "menstruation menstrual period",
    "white discharge": "vaginal discharge vaginitis",
    "pimples": "acne",
    "hair fall": "hair loss",
    "dandruff": "dandruff seborrheic dermatitis",
    "body pain": "body aches pain",
    "weakness": "fatigue weakness",
    "giddiness": "dizziness vertigo",
    "breathlessness": "shortness of breath",
    "paralysis": "stroke paralysis",
    "cholesterol": "cholesterol ldl",
    "bukhar": "fever",
    "khansi": "cough",
    "sar dard": "headache",
    "sir dard": "headache",
    "kamar dard": "back pain",
    "chakkar": "dizziness vertigo",
    "ulti": "vomiting nausea",
    "dast": "diarrhea",
    "kabz": "constipation",
    "neend": "sleep insomnia",
    "motapa": "obesity weight",
    "pet dard": "abdominal pain",
    "ghutno": "knee pain",
    "jodo": "joint pain arthritis",
}
_EXPANSION_KEYS = sorted(EXPANSIONS, key=len, reverse=True)


# Indian English mostly uses British spelling; MedlinePlus uses American spelling.
BRITISH = [("haemo", "hemo"), ("anaem", "anem"), ("oesoph", "esoph"), ("oedem", "edem"), ("paed", "ped"), ("diarrhoea", "diarrhea"),
           ("foet", "fet"), ("colour", "color"), ("behaviour", "behavior"), ("tumour", "tumor"), ("labour", "labor"), ("ageing", "aging"),
           ("centre", "center"), ("fibre", "fiber"), ("litre", "liter"), ("programme", "program"), ("leukaem", "leukem"), ("ischaem", "ischem"),
           ("gynaec", "gynec"), ("orthopaed", "orthoped"), ("dyspnoea", "dyspnea"), ("apnoea", "apnea")]


def americanise(word: str) -> str:
    for uk, us in BRITISH:
        if uk in word:
            word = word.replace(uk, us)
    return word


def stem(word: str) -> str:
    for suffix, repl in (("ies", "y"), ("sses", "ss"), ("ing", ""), ("ed", ""), ("es", ""), ("s", "")):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: -len(suffix)] + repl
    return word


def tokenize(text: str) -> list[str]:
    return [stem(americanise(t)) for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in STOPWORDS and len(t) > 1]


# Idioms whose literal words point somewhere else ("loose motions" is diarrhea,
# not motion sickness): these are replaced. Everything else is appended, so the
# user's own words (e.g. "TB", "hair fall") still count.
REPLACE = {"loose motion", "loose motions", "motions"}


def expand_query(q: str) -> str:
    # Longest phrases first; a matched phrase is consumed so "loose motions"
    # doesn't also trigger the broader "motions" expansion.
    text = f" {re.sub(r'[^a-z0-9]+', ' ', q.lower())} "
    extra = []
    for k in _EXPANSION_KEYS:
        if f" {k} " in text:
            if k in REPLACE:
                text = text.replace(f" {k} ", f" {EXPANSIONS[k]} | ")
            else:
                extra.append(EXPANSIONS[k])
                text = text.replace(f" {k} ", f" {k} | ")
    out = text.replace("|", " ").strip()
    return f"{out} {' '.join(extra)}".strip() if (extra or out != q.lower()) else q


class BM25:
    def __init__(self, docs: list[list[str]], k1: float = 1.4, b: float = 0.75):
        self.k1, self.b = k1, b
        self.tf = [Counter(d) for d in docs]
        self.len = [len(d) for d in docs]
        self.avg = sum(self.len) / max(len(docs), 1)
        df: Counter = Counter()
        for d in self.tf:
            df.update(d.keys())
        n = len(docs)
        self.idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}
        self.postings: dict[str, list[int]] = defaultdict(list)
        for i, d in enumerate(self.tf):
            for t in d:
                self.postings[t].append(i)

    def search(self, query_tokens: list[str], k: int) -> list[tuple[int, float]]:
        scores: dict[int, float] = defaultdict(float)
        for t in set(query_tokens):
            idf = self.idf.get(t)
            if idf is None:
                continue
            for i in self.postings[t]:
                f = self.tf[i][t]
                scores[i] += idf * f * (self.k1 + 1) / (f + self.k1 * (1 - self.b + self.b * self.len[i] / self.avg))
        return sorted(scores.items(), key=lambda x: -x[1])[:k]


class Retriever:
    def __init__(self, chunks: list[dict], embeddings=None, embedding_rows=None):
        self.chunks = chunks
        # Title x3 and synonyms x2 so "what is HbA1c" finds the A1C topic.
        docs = [
            tokenize(c["title"]) * 3 + tokenize(" ".join(c["alsoCalled"])) * 2 + tokenize(" ".join(c["groups"])) + tokenize(c["text"])
            for c in chunks
        ]
        self.bm25 = BM25(docs)
        self.embeddings = embeddings  # numpy array (topics, d), L2-normalised, or None
        self.embedding_rows = embedding_rows  # chunk index for each embedding row

    @classmethod
    @lru_cache(maxsize=1)
    def load(cls) -> "Retriever":
        with open(DATA / "chunks.jsonl", encoding="utf-8") as fh:
            chunks = [json.loads(line) for line in fh]
        embeddings, rows = None, None
        path = DATA / "embeddings.npy"
        if path.exists() and (DATA / "embeddings.ids.json").exists():
            try:
                import numpy as np

                embeddings = np.load(path).astype("float32")
                index = {c["id"]: i for i, c in enumerate(chunks)}
                rows = [index[i] for i in json.loads((DATA / "embeddings.ids.json").read_text())]
            except Exception:  # numpy missing or files unreadable: BM25 only
                embeddings, rows = None, None
        return cls(chunks, embeddings, rows)

    def keyword_search(self, query: str, k: int = 20, expand: bool = True) -> list[tuple[int, float]]:
        q = expand_query(query) if expand else query
        return self.bm25.search(tokenize(q), k)

    def dense_search(self, query_vec, k: int = 20) -> list[tuple[int, float]]:
        import numpy as np

        sims = self.embeddings @ np.asarray(query_vec, dtype="float32")
        top = np.argsort(-sims)[:k]
        return [(self.embedding_rows[int(i)], float(sims[i])) for i in top]

    def search(self, query: str, k: int = 5, query_vec=None, expand: bool = True, per_topic: int = 2) -> list[dict]:
        rankings = [self.keyword_search(query, 30, expand)]
        if query_vec is not None and self.embeddings is not None:
            rankings.append(self.dense_search(query_vec, 30))
        fused = rrf(rankings)
        out, per = [], Counter()
        for idx, score in fused:
            c = self.chunks[idx]
            if per[c["url"]] >= per_topic:  # keep the sources varied
                continue
            per[c["url"]] += 1
            out.append({**c, "score": round(score, 4)})
            if len(out) == k:
                break
        return out


def rrf(rankings: list[list[tuple[int, float]]], k: int = 60) -> list[tuple[int, float]]:
    """Reciprocal Rank Fusion: combine ranked lists without calibrating their scores."""
    scores: dict[int, float] = defaultdict(float)
    for ranking in rankings:
        for rank, (idx, _) in enumerate(ranking):
            scores[idx] += 1 / (k + rank + 1)
    return sorted(scores.items(), key=lambda x: -x[1])


def search(query: str, k: int = 5, query_vec: Optional[list[float]] = None) -> list[dict]:
    return Retriever.load().search(query, k=k, query_vec=query_vec)
