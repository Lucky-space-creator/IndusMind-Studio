from __future__ import annotations

import json
import re
from decimal import Decimal

from app.models.common import Citation


def format_evidence(segments: list[dict]) -> str:
    lines: list[str] = []
    for index, seg in enumerate(segments, start=1):
        chapter = seg.get("chapter") or "-"
        page = seg.get("page_no") if seg.get("page_no") is not None else "-"
        content = (seg.get("content") or "").strip()
        lines.append(f"[{index}] segmentId={seg.get('segment_id')} 章节={chapter} 页码={page}\n{content}")
    return "\n\n".join(lines)


def build_citations(segments: list[dict], *, doc_names: dict[int, str] | None = None) -> list[Citation]:
    names = doc_names or {}
    citations: list[Citation] = []
    for seg in segments:
        doc_id = seg.get("doc_id")
        score = seg.get("score")
        citations.append(
            Citation(
                docId=int(doc_id) if doc_id is not None else None,
                segmentId=int(seg["segment_id"]) if seg.get("segment_id") is not None else None,
                docName=names.get(int(doc_id)) if doc_id is not None else None,
                chapter=seg.get("chapter"),
                pageNo=seg.get("page_no"),
                score=Decimal(str(round(float(score), 4))) if score is not None else None,
            )
        )
    return citations


def parse_json_object(text: str) -> dict:
    if not text:
        return {}
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {}
    try:
        data = json.loads(match.group(0))
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}