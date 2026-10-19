from __future__ import annotations

from app.agents.common import build_citations, format_evidence
from app.agents.prompts import SINGLE_AGENT_SYSTEM
from app.core.logging import get_logger
from app.core.providers import get_llm
from app.models.chat import ChatResponse
from app.models.graph import GraphQueryRequest
from app.rag import repository, retriever

log = get_logger(__name__)

_NOT_COVERED = "现有知识库未覆盖该问题，请补充相关文档或换一种问法。"


def _hit_to_dict(hit) -> dict:
    return {
        "segment_id": hit.segment_id,
        "doc_id": hit.doc_id,
        "content": hit.content,
        "chapter": hit.chapter,
        "page_no": hit.page_no,
        "score": float(hit.score) if hit.score is not None else None,
    }


def _expand_via_graph(evidence: list[dict]) -> list[dict]:
    if not evidence:
        return []
    from app.graphrag.query import query as graph_query

    extra_ids: list[int] = []
    for seg in evidence[:3]:
        try:
            related = graph_query(
                GraphQueryRequest(
                    nodeRefId=seg["segment_id"],
                    nodeType="segment",
                    relationTypes=["SUPPLEMENT", "SAME_FAULT", "REF", "PRECEDE"],
                    depth=1,
                )
            )
        except Exception as exc:
            log.warning("图关系扩展失败，跳过：%s", exc)
            return []
        for node in related:
            if node.node_type == "segment" and node.ref_id not in extra_ids:
                extra_ids.append(node.ref_id)
    if not extra_ids:
        return []
    try:
        rows = repository.fetch_segments(extra_ids)
    except Exception as exc:
        log.warning("扩展片段回读失败：%s", exc)
        return []
    known = {seg["segment_id"] for seg in evidence}
    extra = []
    for row in rows:
        row = dict(row)
        if row["segment_id"] in known:
            continue
        row["score"] = 0.0
        extra.append(row)
    return extra


def answer(
    question: str,
    *,
    kb_ids: list[int] | None = None,
    strictness: str | None = None,
    trace_id: str = "",
) -> ChatResponse:
    try:
        hits = retriever.search(question, kb_ids=kb_ids, top_k=None, strictness=strictness)
    except Exception as exc:
        log.warning("RAG 检索失败，按未命中处理：%s", exc)
        hits = []

    evidence = [_hit_to_dict(hit) for hit in hits]
    if evidence:
        evidence.extend(_expand_via_graph(evidence))

    if not evidence:
        return ChatResponse(answer=_NOT_COVERED, citations=[], hit=False, traceId=trace_id)

    context = format_evidence(evidence)
    messages = [
        {"role": "system", "content": SINGLE_AGENT_SYSTEM},
        {"role": "user", "content": f"【证据】\n{context}\n\n【问题】{question}"},
    ]
    try:
        answer_text = get_llm().chat(messages, temperature=0.2)
    except Exception as exc:
        log.warning("单 Agent 生成失败，返回证据摘要：%s", exc)
        top = evidence[0]
        answer_text = (
            f"根据检索到的资料（{top.get('chapter') or '文档'}）："
            f"{(top.get('content') or '')[:200]}。模型服务暂不可用，未能生成完整回答。"
        )
    if not answer_text:
        answer_text = _NOT_COVERED
        hit = False
    else:
        hit = True
    citations = build_citations(evidence)
    return ChatResponse(answer=answer_text, citations=citations, hit=hit, traceId=trace_id)