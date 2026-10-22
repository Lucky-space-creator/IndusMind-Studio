from __future__ import annotations

import json
import re
from decimal import Decimal

from app.core.logging import get_logger
from app.core.providers import get_llm
from app.core.text import tokenize
from app.models.graph import RELATION_TYPES, CandidateEdge

log = get_logger(__name__)

_CANONICAL = {"REF", "REPLACE", "SUPPLEMENT", "PRECEDE", "SAME_DEVICE", "SAME_FAULT"}

_BATCH_CHARS = 3000
_SEG_CONTENT_CHARS = 300

_SYSTEM_PROMPT = (
    "你是工业设备知识文档的关联分析助手。仅识别文档片段之间的关系，"
    "绝不涉及设备、备件、工单等实体。"
    "可选关系类型：REF(引用)、REPLACE(替代)、SUPPLEMENT(补充)、"
    "PRECEDE(前置)、SAME_DEVICE(同设备)、SAME_FAULT(同故障)。"
    "只输出 JSON 数组，每个元素形如 "
    '{"fromRefId":1,"toRefId":2,"relationType":"SUPPLEMENT","confidence":0.8}，'
    "refId 必须来自给定片段 id，不要输出任何解释。"
)


def _canonical(relation_type: str) -> str | None:
    if not relation_type:
        return None
    key = relation_type.strip().lower().replace(" ", "_").replace("-", "_")
    mapped = RELATION_TYPES.get(key)
    if mapped:
        return mapped
    upper = relation_type.strip().upper()
    if upper in _CANONICAL:
        return upper
    return None


def _parse_json_array(text: str) -> list[dict]:
    if not text:
        return []
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if not match:
        return []
    try:
        data = json.loads(match.group(0))
    except Exception:
        return []
    return data if isinstance(data, list) else []


def _to_edge(raw: dict, valid_ids: set[int]) -> CandidateEdge | None:
    try:
        from_ref = int(raw.get("fromRefId"))
        to_ref = int(raw.get("toRefId"))
    except (TypeError, ValueError):
        return None
    if from_ref == to_ref or from_ref not in valid_ids or to_ref not in valid_ids:
        return None
    relation = _canonical(str(raw.get("relationType", "")))
    if not relation:
        return None
    confidence = raw.get("confidence")
    try:
        confidence = Decimal(str(round(float(confidence), 4)))
    except (TypeError, ValueError):
        confidence = Decimal("0.5")
    return CandidateEdge(
        fromRefId=from_ref,
        fromNodeType="segment",
        toRefId=to_ref,
        toNodeType="segment",
        relationType=relation,
        confidence=confidence,
        source="auto",
    )


def _heuristic_edges(segments: list[dict]) -> list[CandidateEdge]:
    tokens = {int(seg["segmentId"]): set(tokenize(seg.get("content") or "")) for seg in segments}
    ids = list(tokens.keys())
    edges: list[CandidateEdge] = []
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            left, right = ids[i], ids[j]
            overlap = tokens[left] & tokens[right]
            if len(overlap) >= 3:
                confidence = Decimal(str(min(0.4 + 0.05 * len(overlap), 0.75)))
                edges.append(
                    CandidateEdge(
                        fromRefId=left,
                        fromNodeType="segment",
                        toRefId=right,
                        toNodeType="segment",
                        relationType="SAME_FAULT",
                        confidence=confidence,
                        source="auto",
                    )
                )
    return edges


def _extract_batch(segments: list[dict]) -> list[CandidateEdge]:
    valid_ids = {int(seg["segmentId"]) for seg in segments}
    catalog = "\n".join(
        f"[{seg['segmentId']}] {seg.get('chapter') or ''} {(seg.get('content') or '')[:_SEG_CONTENT_CHARS]}"
        for seg in segments
    )
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": f"片段集合：\n{catalog}\n\n请输出候选关系 JSON 数组。"},
    ]
    text = get_llm().chat(messages, temperature=0.0)
    raw_edges = _parse_json_array(text)
    return [edge for edge in (_to_edge(item, valid_ids) for item in raw_edges) if edge]


def _batches(segments: list[dict]) -> list[list[dict]]:
    batches: list[list[dict]] = []
    current: list[dict] = []
    size = 0
    for seg in segments:
        length = len(seg.get("content") or "") + len(seg.get("chapter") or "")
        if current and size + length > _BATCH_CHARS:
            batches.append(current)
            current = []
            size = 0
        current.append(seg)
        size += length
    if current:
        batches.append(current)
    return batches


def extract_candidates(kb_id: int, segments: list[dict]) -> list[CandidateEdge]:
    if len(segments) < 2:
        return []
    edges: list[CandidateEdge] = []
    seen: set[tuple[int, int, str]] = set()
    llm_failed = False
    for index, batch in enumerate(_batches(segments)):
        if len(batch) < 2:
            continue
        try:
            for edge in _extract_batch(batch):
                key = (edge.from_ref_id, edge.to_ref_id, edge.relation_type)
                if key not in seen:
                    seen.add(key)
                    edges.append(edge)
        except Exception as exc:
            llm_failed = True
            log.warning("候选边抽取 LLM 调用失败（批 %s）：%s", index, exc)
    if edges:
        return edges
    log.info("LLM 未产出有效候选边，使用启发式 kb=%s failed=%s", kb_id, llm_failed)
    return _heuristic_edges(segments)