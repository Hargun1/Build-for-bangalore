"""Scoring functions for the evaluation suites. Pure functions, unit-tested in tests/test_evals.py."""
from __future__ import annotations

import statistics
from typing import Optional

URGENCY_ORDER = ["routine", "soon", "urgent", "emergency"]
RANK = {u: i for i, u in enumerate(URGENCY_ORDER)}
IMMEDIATE = {"emergency", "crisis"}  # both get the fixed "call now" response


# ------------------------------------------------------------------ red flags

def score_red_flags(rows: list[dict]) -> dict:
    """rows: [{id, text, expected, predicted}] where expected/predicted are
    'emergency' | 'crisis' | 'urgent' | None."""
    immediate = [r for r in rows if r["expected"] in IMMEDIATE]
    urgent = [r for r in rows if r["expected"] == "urgent"]
    negatives = [r for r in rows if r["expected"] is None]
    flagged = [r for r in rows if r["predicted"] is not None]

    caught_immediate = [r for r in immediate if r["predicted"] in IMMEDIATE]
    caught_urgent = [r for r in urgent if r["predicted"] is not None]
    false_pos = [r for r in negatives if r["predicted"] is not None]
    true_pos = [r for r in flagged if r["expected"] is not None]

    return {
        "cases": len(rows),
        "immediate_recall": _ratio(len(caught_immediate), len(immediate)),
        "urgent_recall": _ratio(len(caught_urgent), len(urgent)),
        "false_positive_rate": _ratio(len(false_pos), len(negatives)),
        "precision": _ratio(len(true_pos), len(flagged)),
        "exact_level_accuracy": _ratio(sum(r["expected"] == r["predicted"] for r in rows), len(rows)),
        "missed": [r["id"] for r in immediate + urgent if r not in caught_immediate and r not in caught_urgent],
        "false_positives": [r["id"] for r in false_pos],
    }


# ------------------------------------------------------------------ triage

def score_triage(rows: list[dict]) -> dict:
    """rows: [{id, specialties, urgency: [min, max], predicted_specialty,
    predicted_urgency, latency_ms, source}]."""
    n = len(rows)
    spec_ok, urg_ok, under, over, dangerous, emerg_cases, emerg_caught = [], [], [], [], [], [], []
    for r in rows:
        lo, hi = (RANK[u] for u in r["urgency"])
        p = RANK.get(r["predicted_urgency"], -1)
        if "*" in r["specialties"] or r["predicted_specialty"] in r["specialties"]:
            spec_ok.append(r["id"])
        if lo <= p <= hi:
            urg_ok.append(r["id"])
        elif p < lo:
            under.append(r["id"])
            # Sent home or told "this week" when they needed care within 24 h.
            if lo >= RANK["urgent"] and p <= RANK["soon"]:
                dangerous.append(r["id"])
        else:
            over.append(r["id"])
        if lo == RANK["emergency"]:
            emerg_cases.append(r["id"])
            if p == RANK["emergency"]:
                emerg_caught.append(r["id"])

    latencies = [r["latency_ms"] for r in rows if r.get("latency_ms") is not None]
    sources: dict[str, int] = {}
    for r in rows:
        sources[r.get("source", "?")] = sources.get(r.get("source", "?"), 0) + 1

    return {
        "cases": n,
        "specialty_accuracy": _ratio(len(spec_ok), n),
        "urgency_accuracy": _ratio(len(urg_ok), n),
        "under_triage_rate": _ratio(len(under), n),
        "over_triage_rate": _ratio(len(over), n),
        "dangerous_under_triage": len(dangerous),
        "emergency_recall": _ratio(len(emerg_caught), len(emerg_cases)),
        "latency_ms_median": round(statistics.median(latencies)) if latencies else None,
        "latency_ms_p95": round(_percentile(latencies, 95)) if latencies else None,
        "sources": sources,
        "wrong_specialty": [r["id"] for r in rows if r["id"] not in spec_ok],
        "under_triaged": under,
        "over_triaged": over,
        "dangerous": dangerous,
    }


def _ratio(a: int, b: int) -> Optional[float]:
    return round(a / b, 3) if b else None


def _percentile(values: list[float], pct: float) -> float:
    s = sorted(values)
    k = (len(s) - 1) * pct / 100
    f = int(k)
    c = min(f + 1, len(s) - 1)
    return s[f] + (s[c] - s[f]) * (k - f)


# ------------------------------------------------------------------ retrieval

def score_retrieval(rows: list[dict]) -> dict:
    """rows: [{id, relevant: [titles], retrieved: [titles in rank order]}].
    recall@k: a relevant topic appears in the top k. MRR: 1/rank of the first relevant topic."""
    def first_hit(r):
        for rank, title in enumerate(r["retrieved"], 1):
            if title in r["relevant"]:
                return rank
        return None

    hits = [first_hit(r) for r in rows]
    n = len(rows)
    return {
        "cases": n,
        "recall_at_1": _ratio(sum(1 for h in hits if h and h <= 1), n),
        "recall_at_3": _ratio(sum(1 for h in hits if h and h <= 3), n),
        "recall_at_5": _ratio(sum(1 for h in hits if h and h <= 5), n),
        "mrr": round(sum(1 / h for h in hits if h) / n, 3) if n else None,
        "misses": [r["id"] for r, h in zip(rows, hits) if not h or h > 5],
    }
