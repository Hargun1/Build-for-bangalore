"""Builds the knowledge base the health chat cites.

Source: MedlinePlus health topic summaries (U.S. National Library of Medicine).
NLM-written summaries are public domain; attribution "Source: MedlinePlus,
National Library of Medicine" is shown with every citation. Copyrighted parts of
MedlinePlus (A.D.A.M. encyclopedia, drug monographs) are not used.

    python -m rag.build                     # latest XML -> rag/data/chunks.jsonl
    python -m rag.build --embed             # also compute embeddings (needs GEMINI_API_KEY)
"""
from __future__ import annotations

import argparse
import html
import io
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

import httpx

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
INDEX_PAGE = "https://medlineplus.gov/xml.html"
MAX_CHARS = 900


def latest_zip_url() -> str:
    page = httpx.get(INDEX_PAGE, timeout=30, follow_redirects=True).text
    links = sorted(set(re.findall(r"https://medlineplus\.gov/xml/mplus_topics_compressed_\d{4}-\d{2}-\d{2}\.zip", page)))
    if not links:
        raise SystemExit("Could not find the MedlinePlus topics file on " + INDEX_PAGE)
    return links[-1]


def html_to_text(fragment: str) -> str:
    text = re.sub(r"<li[^>]*>", "\n- ", fragment)
    text = re.sub(r"</(p|ul|ol|h\d)>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n", text).strip()


def chunk(text: str, limit: int = MAX_CHARS) -> list[str]:
    """Splits on paragraph/list boundaries so a chunk never cuts a sentence."""
    parts, current = [], ""
    for para in text.split("\n"):
        para = para.strip()
        if not para:
            continue
        if current and len(current) + len(para) + 1 > limit:
            parts.append(current)
            current = para
        else:
            current = f"{current}\n{para}" if current else para
    if current:
        parts.append(current)
    return parts


def parse(xml_bytes: bytes) -> list[dict]:
    root = ET.fromstring(xml_bytes)
    chunks = []
    for t in root.findall("health-topic"):
        if t.get("language") != "English":
            continue
        summary = t.find("full-summary")
        if summary is None or not (summary.text or "").strip():
            continue
        title = t.get("title")
        also = [a.text.strip() for a in t.findall("also-called") if a.text]
        groups = [g.text.strip() for g in t.findall("group") if g.text]
        for i, part in enumerate(chunk(html_to_text(summary.text))):
            chunks.append({
                "id": f"mp-{t.get('id')}-{i}",
                "title": title,
                "url": t.get("url"),
                "alsoCalled": also,
                "groups": groups,
                "text": part,
                "source": "MedlinePlus, National Library of Medicine",
            })
    return chunks


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", help="local zip path instead of downloading")
    ap.add_argument("--embed", action="store_true", help="also build embeddings (needs GEMINI_API_KEY)")
    args = ap.parse_args()

    if args.zip:
        raw = Path(args.zip).read_bytes()
        url = args.zip
    else:
        url = latest_zip_url()
        print(f"Downloading {url}")
        raw = httpx.get(url, timeout=120, follow_redirects=True).content
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        xml_bytes = z.read(z.namelist()[0])

    chunks = parse(xml_bytes)
    DATA.mkdir(exist_ok=True)
    with open(DATA / "chunks.jsonl", "w", encoding="utf-8") as fh:
        for c in chunks:
            fh.write(json.dumps(c, ensure_ascii=False) + "\n")
    (DATA / "SOURCE.txt").write_text(
        f"Built from {url}\nMedlinePlus health topic summaries (U.S. National Library of Medicine), public domain.\n"
        f"Topics: {len({c['url'] for c in chunks})}, chunks: {len(chunks)}\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(chunks)} chunks from {len({c['url'] for c in chunks})} topics")

    if args.embed:
        from rag.embed import build_embeddings

        build_embeddings(chunks)


if __name__ == "__main__":
    sys.path.insert(0, str(ROOT.parent))
    main()
