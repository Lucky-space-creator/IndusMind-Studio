from __future__ import annotations

from decimal import Decimal

from app.core.config import settings
from app.core.logging import get_logger
from app.core.providers import get_reranker
from app.models.rag import SegmentHit
from app.rag import repository
from app.rag.embedding import embed_query

log = get_logger(__name__)

_STRICTNESS_THRESHOLD = {
    "loose": 0.0,
    "normal": 0.15,
    "strict": 0.35,
}


def _normalize(scores: dict[int, float]) -> dict[int, float]:
    if not scores:
        return {}
    values = list(scores.values())
    low, high = min(values), max(values)
    if high - low < 1e-9:
        return {key: 1.0 for key in scores}
    return {key: (value - low) / (high - low) for key, value in scores.items()}


def search(
    query: str,
    *,
    kb_ids: list[int] | None,
    top_k: int | None,
    strictness: str | None,
) -> list[SegmentHit]:
    limit = top_k or settings.rag_top_k
    pool = max(limit * 3, limit + 5)
    if kb_ids is not None and len(kb_ids) == 0:
        # 调用方已明确「无可用知识库」：直接返回空，避免降级为全库检索
        log.info("知识检索跳过：kb_ids 为空（无授权知识库）")
        return []
    query_vector = embed_query(query)
    vector_hits = repository.vector_search(query_vector, kb_ids=kb_ids, top_k=pool) if query_vector else []
    keyword_hits = repository.keyword_search(query, kb_ids=kb_ids, top_k=pool)

    merged: dict[int, dict] = {}
    vector_scores: dict[int, float] = {}
    keyword_scores: dict[int, float] = {}

    def _merge(hit: dict, bucket: dict[int, float]) -> None:
        segment_id = int(hit["segment_id"])
        merged.setdefault(
            segment_id,
            {
                "segment_id": segment_id,
                "doc_id": int(hit["doc_id"]),
                "content": hit.get("content") or "",
                "chapter": hit.get("chapter"),
                "page_no": hit.get("page_no"),
            },
        )
        bucket[segment_id] = float(hit.get("score") or 0.0)

    for hit in vector_hits:
        _merge(hit, vector_scores)
    for hit in keyword_hits:
        _merge(hit, keyword_scores)

    if not merged:
        return []

    vector_norm = _normalize(vector_scores)
    keyword_norm = _normalize(keyword_scores)
    scored: list[tuple[int, float]] = []
    for segment_id in merged:
        score = (
            settings.rag_vector_weight * vector_norm.get(segment_id, 0.0)
            + settings.rag_keyword_weight * keyword_norm.get(segment_id, 0.0)
        )
        scored.append((segment_id, round(score, 6)))
    scored.sort(key=lambda item: item[1], reverse=True)

    shortlist = scored[: max(limit * 2, limit)]
    reranker = get_reranker()
    if reranker.enabled and shortlist:
        documents = [merged[segment_id]["content"] for segment_id, _ in shortlist]
        ranked = reranker.rerank(query, documents, top_n=limit)
        reranked: list[tuple[int, float]] = []
        for index, relevance in ranked:
            if 0 <= index < len(shortlist):
                segment_id = shortlist[index][0]
                reranked.append((segment_id, round(float(relevance), 6)))
        if reranked:
            shortlist = reranked

    threshold = _STRICTNESS_THRESHOLD.get((strictness or "normal").lower(), 0.15)
    results: list[SegmentHit] = []
    for segment_id, score in shortlist:
        if score < threshold:
            continue
        info = merged[segment_id]
        results.append(
            SegmentHit(
                segment_id=info["segment_id"],
                doc_id=info["doc_id"],
                doc_name=None,
                chapter=info.get("chapter"),
                page_no=info.get("page_no"),
                content=info.get("content") or "",
                score=Decimal(str(score)),
            )
        )
        if len(results) >= limit:
            break
    return results