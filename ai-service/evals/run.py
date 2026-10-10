"""Evaluation runner.

    python -m evals.run --suite red_flags
    python -m evals.run --suite triage --mode rules
    python -m evals.run --suite triage --mode ai --delay 4     # needs an AI key in .env

Writes evals/reports/<suite>-<mode>.json and .md. The datasets are written and
labelled by the developer (not clinician-reviewed); see evals/README.md.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))
load_dotenv(ROOT.parent / ".env")

from app import llm as llm_module  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.routers.triage import TriageRequest, triage  # noqa: E402
from app.safety import assess_safety, detect_red_flag  # noqa: E402
from evals.metrics import score_red_flags, score_triage  # noqa: E402

DATA = ROOT / "datasets"
REPORTS = ROOT / "reports"


def load(name: str) -> list[dict]:
    with open(DATA / f"{name}.jsonl", encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


async def run_red_flags(dataset: str, mode: str, delay: float) -> tuple[dict, list[dict]]:
    if mode == "ai" and not any(p.enabled for p in get_settings().providers):
        raise SystemExit("No AI key found in ai-service/.env; set GEMINI_API_KEY (or GROQ/OPENROUTER) for --mode ai.")
    rows = []
    for case in load(dataset):
        if mode == "rules":
            flag, source = detect_red_flag(case["text"]), "rules"
        else:
            flag, source = await assess_safety(case["text"])
            if source == "rules+ai" and delay:
                await asyncio.sleep(delay)
        rows.append({**case, "predicted": flag.level if flag else None, "source": source})
    return score_red_flags(rows), rows


async def run_triage(mode: str, delay: float) -> tuple[dict, list[dict]]:
    if mode == "rules":
        # A client with no providers forces the keyword fallback path.
        llm_module.set_llm(llm_module.LLMClient(providers=[]))
    elif not any(p.enabled for p in get_settings().providers):
        raise SystemExit("No AI key found in ai-service/.env; set GEMINI_API_KEY (or GROQ/OPENROUTER) for --mode ai.")

    rows = []
    cases = load("triage")
    for i, case in enumerate(cases, 1):
        started = time.perf_counter()
        out = await triage(TriageRequest(symptoms=case["text"]))
        latency = (time.perf_counter() - started) * 1000
        rows.append({
            **case,
            "predicted_specialty": out["specialty"],
            "predicted_urgency": out["urgency"],
            "source": out["aiSource"],
            "latency_ms": round(latency),
        })
        print(f"  [{i}/{len(cases)}] {case['id']} -> {out['specialty']}/{out['urgency']} ({out['aiSource']}, {latency:.0f} ms)", flush=True)
        if delay and mode == "ai" and out["aiSource"] not in ("safety-rules", "keywords"):
            await asyncio.sleep(delay)  # stay inside free-tier rate limits
    return score_triage(rows), rows


def write_report(suite: str, mode: str, metrics: dict, rows: list[dict]) -> Path:
    REPORTS.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    base = REPORTS / f"{suite}-{mode}"
    with open(f"{base}.json", "w", encoding="utf-8") as fh:
        json.dump({"suite": suite, "mode": mode, "ran_at": stamp, "metrics": metrics, "rows": rows}, fh, indent=2, ensure_ascii=False)

    by_id = {r["id"]: r for r in rows}
    lines = [f"# Eval: {suite} ({mode})", "", f"Run {stamp} on {metrics['cases']} cases.", "", "| Metric | Value |", "| --- | --- |"]
    for k, v in metrics.items():
        if isinstance(v, (int, float)) or v is None:
            shown = f"{v:.1%}" if isinstance(v, float) and k not in ("latency_ms_median", "latency_ms_p95") else v
            lines.append(f"| {k} | {shown} |")
    if "sources" in metrics:
        lines.append(f"| answered by | {', '.join(f'{s} ({n})' for s, n in metrics['sources'].items())} |")
    lines.append("")
    for key in ("missed", "false_positives", "dangerous", "under_triaged", "over_triaged", "wrong_specialty"):
        ids = metrics.get(key) or []
        if not ids:
            continue
        lines += [f"## {key.replace('_', ' ').capitalize()} ({len(ids)})", ""]
        for i in ids:
            r = by_id[i]
            detail = (
                f"expected {r.get('expected')}, got {r.get('predicted')}"
                if suite.startswith("red_flags")
                else f"expected {'/'.join(r['specialties'])} {r['urgency'][0]}-{r['urgency'][1]}, got {r['predicted_specialty']} {r['predicted_urgency']}"
            )
            lines.append(f"- `{i}` {r['text']}: {detail}")
        lines.append("")
    path = Path(f"{base}.md")
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--suite", choices=["red_flags", "red_flags_holdout", "triage"], required=True)
    ap.add_argument("--mode", choices=["rules", "ai"], default="rules")
    ap.add_argument("--delay", type=float, default=4.0, help="seconds between AI calls (free-tier rate limits)")
    args = ap.parse_args()

    if args.suite.startswith("red_flags"):
        metrics, rows = asyncio.run(run_red_flags(args.suite, args.mode, args.delay))
        mode = args.mode
    else:
        metrics, rows = asyncio.run(run_triage(args.mode, args.delay))
        mode = args.mode

    path = write_report(args.suite, mode, metrics, rows)
    print(json.dumps({k: v for k, v in metrics.items() if not isinstance(v, list)}, indent=2))
    print(f"Report: {path}")


if __name__ == "__main__":
    main()
