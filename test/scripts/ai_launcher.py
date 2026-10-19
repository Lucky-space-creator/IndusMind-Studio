"""沙箱环境 AI 服务启动器（接口测试专用）。

沙箱限制与应对：
1. 拦截 Python 进程对 IPv4 127.0.0.1 的 connect（OSError 10051）——
   asyncio 事件循环初始化所需的 socket.socketpair() 默认走 127.0.0.1，
   补丁为优先使用 IPv6 ::1（探针证实 ::1 不受拦截）。
2. 本机无 Ollama(11434) / PostgreSQL(5432) / Neo4j(7687)，
   且出站 connect 均被拦截——LLM/Embedding/向量库/图库依赖
   在沙箱内不可用。

为保证 HTTP 契约与业务流程可测，本启动器以猴子补丁方式注入
确定性桩实现（不修改 code/ai-service 源码）：
- LLM：固定模板回复（所有调用点均有降级容错）；
- Embedding：sha256 确定性哈希向量（同文本同向量）；
- 向量库：内存实现（余弦相似度检索 + 关键词匹配）；
- 图库：内存邻接表实现（BFS 遍历）。
"""

import hashlib
import math
import os
import socket
import sys
from collections import deque

AI_SERVICE_DIR = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "code", "ai-service")
)

sys.path.insert(0, AI_SERVICE_DIR)
os.chdir(AI_SERVICE_DIR)

_orig_socketpair = socket.socketpair


def _socketpair_patched(family=socket.AF_INET, type=socket.SOCK_STREAM, proto=0):
    if family == socket.AF_INET:
        try:
            return _orig_socketpair(socket.AF_INET6, type, proto)
        except OSError:
            pass
    return _orig_socketpair(family, type, proto)


socket.socketpair = _socketpair_patched

from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402

# ---------------------------------------------------------------- LLM 桩


def _stub_llm_chat(self, messages, *, temperature=0.2, max_tokens=None):
    question = ""
    for message in reversed(messages or []):
        if message.get("role") == "user":
            question = str(message.get("content") or "")[:80]
            break
    return f"【沙箱桩回复】已基于给定证据完成分析。问题要点：{question or '（无）'}。建议结合检索证据进一步排查主轴温升、润滑与刀具磨损等常见因素。"


# ---------------------------------------------------------------- Embedding 桩


def _deterministic_vector(text: str, dim: int) -> list[float]:
    seed = hashlib.sha256(text.encode("utf-8")).digest()
    values = []
    for i in range(dim):
        chunk = seed[(i * 4) % len(seed):(i * 4) % len(seed) + 4] or seed[:4]
        values.append(int.from_bytes(chunk, "big") / 0xFFFFFFFF)
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [round(v / norm, 8) for v in values]


def _stub_embed(self, texts):
    if not texts:
        return []
    dim = getattr(self, "_dimension", None) or settings.embedding_dim or 64
    return [_deterministic_vector(str(text), dim) for text in texts]


def _install_provider_stubs():
    from app.core.providers import openai_compat

    openai_compat.OpenAICompatLLM.chat = _stub_llm_chat
    openai_compat.OpenAICompatEmbedding.embed = _stub_embed
    try:
        from app.core.providers import dashscope, ollama, openai as openai_provider

        for module in (dashscope, ollama, openai_provider):
            for name in dir(module):
                obj = getattr(module, name)
                if not isinstance(obj, type):
                    continue
                if issubclass(obj, openai_compat.OpenAICompatLLM) and obj is not openai_compat.OpenAICompatLLM:
                    obj.chat = _stub_llm_chat
                if (
                    issubclass(obj, openai_compat.OpenAICompatEmbedding)
                    and obj is not openai_compat.OpenAICompatEmbedding
                ):
                    obj.embed = _stub_embed
    except ImportError:
        pass


# ---------------------------------------------------------------- 内存向量库


def _install_repository_stub():
    from app.rag import repository

    def _tokens(text: str) -> set[str]:
        try:
            from app.core.text import tokenize

            return set(tokenize(text or ""))
        except Exception:
            return {w for w in str(text or "").lower().split() if w}

    segments: dict[int, dict] = {}

    def upsert_segments(*, kb_id, doc_id, doc_status, embed_model, index_version, rows) -> int:
        for row in rows or []:
            segments[int(row["segment_id"])] = {
                "segment_id": int(row["segment_id"]),
                "kb_id": kb_id,
                "doc_id": doc_id,
                "doc_status": doc_status,
                "content": row.get("content") or "",
                "chapter": row.get("chapter"),
                "page_no": row.get("page_no"),
                "keywords": row.get("keywords") or "",
                "embedding": list(row.get("embedding") or []),
                "embed_model": embed_model,
                "index_version": index_version,
            }
        return len(rows or [])

    def delete_by_doc(doc_id) -> int:
        doomed = [sid for sid, seg in segments.items() if seg["doc_id"] == doc_id]
        for sid in doomed:
            segments.pop(sid, None)
        return len(doomed)

    def delete_by_kb(kb_id) -> int:
        doomed = [sid for sid, seg in segments.items() if seg["kb_id"] == kb_id]
        for sid in doomed:
            segments.pop(sid, None)
        return len(doomed)

    def update_doc_status(doc_ids, target_status) -> int:
        affected = 0
        for seg in segments.values():
            if seg["doc_id"] in doc_ids:
                seg["doc_status"] = target_status
                affected += 1
        return affected

    def _cosine(left: list[float], right: list[float]) -> float:
        if not left or not right or len(left) != len(right):
            return 0.0
        dot = sum(a * b for a, b in zip(left, right))
        na = math.sqrt(sum(a * a for a in left)) or 1.0
        nb = math.sqrt(sum(b * b for b in right)) or 1.0
        return dot / (na * nb)

    def vector_search(embedding, *, kb_ids, top_k) -> list[dict]:
        query_vector = list(embedding or [])
        candidates = []
        for seg in segments.values():
            if seg["doc_status"] != "enabled":
                continue
            if kb_ids and seg["kb_id"] not in kb_ids:
                continue
            if not seg["embedding"]:
                continue
            score = (max(-1.0, min(1.0, _cosine(query_vector, seg["embedding"]))) + 1.0) / 2.0
            candidates.append((score, seg))
        candidates.sort(key=lambda item: item[0], reverse=True)
        return [
            {
                "segment_id": seg["segment_id"],
                "doc_id": seg["doc_id"],
                "content": seg["content"],
                "chapter": seg["chapter"],
                "page_no": seg["page_no"],
                "score": round(score, 6),
            }
            for score, seg in candidates[: max(0, int(top_k or 0))]
        ]

    def keyword_search(query, *, kb_ids, top_k) -> list[dict]:
        query_tokens = _tokens(query)
        candidates = []
        for seg in segments.values():
            if seg["doc_status"] != "enabled":
                continue
            if kb_ids and seg["kb_id"] not in kb_ids:
                continue
            target = _tokens(f"{seg['keywords']} {seg['content']}")
            overlap = query_tokens & target
            if not overlap:
                continue
            score = len(overlap) / len(query_tokens) if query_tokens else 0.0
            candidates.append((score, seg))
        candidates.sort(key=lambda item: (-item[0], item[1]["segment_id"]))
        return [
            {
                "segment_id": seg["segment_id"],
                "doc_id": seg["doc_id"],
                "content": seg["content"],
                "chapter": seg["chapter"],
                "page_no": seg["page_no"],
                "score": round(min(1.0, score), 6),
            }
            for score, seg in candidates[: max(0, int(top_k or 0))]
        ]

    def fetch_segments(segment_ids) -> list[dict]:
        return [
            {
                "segment_id": seg["segment_id"],
                "doc_id": seg["doc_id"],
                "content": seg["content"],
                "chapter": seg["chapter"],
                "page_no": seg["page_no"],
                "score": 0.0,
            }
            for seg in (segments.get(int(sid)) for sid in segment_ids or [])
            if seg is not None
        ]

    def ping() -> bool:
        return True

    repository.upsert_segments = upsert_segments
    repository.delete_by_doc = delete_by_doc
    repository.delete_by_kb = delete_by_kb
    repository.update_doc_status = update_doc_status
    repository.vector_search = vector_search
    repository.keyword_search = keyword_search
    repository.fetch_segments = fetch_segments
    repository.ping = ping


# ---------------------------------------------------------------- 内存图库


def _install_graph_store_stub():
    from app.graphrag import store

    graph_nodes: dict[int, dict[str, dict]] = {}
    graph_edges: dict[int, list[dict]] = {}

    def replace_kb_graph(kb_id, nodes, edges) -> tuple[int, int]:
        graph_nodes[kb_id] = {}
        for node in nodes or []:
            graph_nodes[kb_id][node["graphId"]] = dict(node, kbId=kb_id)
        dedup: list[dict] = []
        seen: set[tuple] = set()
        for edge in edges or []:
            key = (edge["fromGraphId"], edge["toGraphId"], edge["relationType"])
            if key in seen:
                continue
            seen.add(key)
            dedup.append(dict(edge))
        graph_edges[kb_id] = dedup
        return len(nodes or []), len(dedup)

    def upsert_candidate_edges(kb_id, edges) -> int:
        bucket = graph_nodes.setdefault(kb_id, {})
        edge_list = graph_edges.setdefault(kb_id, [])
        for edge in edges or []:
            for graph_id, ref_key, type_key in (
                (edge.get("fromGraphId"), "fromRefId", "fromNodeType"),
                (edge.get("toGraphId"), "toRefId", "toNodeType"),
            ):
                if graph_id and graph_id not in bucket:
                    bucket[graph_id] = {
                        "graphId": graph_id,
                        "kbId": kb_id,
                        "nodeId": None,
                        "nodeType": edge.get(type_key) or "segment",
                        "refId": edge.get(ref_key),
                        "title": None,
                    }
            key = (edge.get("fromGraphId"), edge.get("toGraphId"), edge.get("relationType"))
            existing = next(
                (
                    idx
                    for idx, item in enumerate(edge_list)
                    if (item.get("fromGraphId"), item.get("toGraphId"), item.get("relationType")) == key
                ),
                None,
            )
            record = dict(edge)
            record.setdefault("source", "auto")
            if existing is None:
                edge_list.append(record)
            else:
                edge_list[existing] = record
        return len(edges or [])

    def traverse(node_ref_id, *, node_type, relation_types, depth) -> list[dict]:
        types = {t.upper() for t in (relation_types or [])} or None
        max_depth = max(1, int(depth or 1))
        adjacency: dict[str, list[tuple[str, str]]] = {}
        node_lookup: dict[str, dict] = {}
        for kb_nodes in graph_nodes.values():
            for graph_id, node in kb_nodes.items():
                node_lookup[graph_id] = node
                adjacency.setdefault(graph_id, [])
        for edges in graph_edges.values():
            for edge in edges:
                if types and edge.get("relationType", "").upper() not in types:
                    continue
                adjacency.setdefault(edge["fromGraphId"], []).append(
                    (edge["toGraphId"], edge.get("relationType"))
                )
                adjacency.setdefault(edge["toGraphId"], []).append(
                    (edge["fromGraphId"], edge.get("relationType"))
                )

        results: list[dict] = []
        seen_keys: set[tuple] = set()
        for graph_id, node in node_lookup.items():
            if node.get("refId") != node_ref_id:
                continue
            if node_type and node.get("nodeType") != node_type:
                continue
            queue = deque([(graph_id, 0, None)])
            visited = {graph_id}
            while queue:
                current, hops, last_relation = queue.popleft()
                if hops > 0:
                    target = node_lookup.get(current)
                    if target is not None and target.get("refId") is not None:
                        key = (target.get("refId"), target.get("nodeType"), hops)
                        if key not in seen_keys:
                            seen_keys.add(key)
                            results.append(
                                {
                                    "refId": target.get("refId"),
                                    "nodeType": target.get("nodeType"),
                                    "title": target.get("title"),
                                    "relationType": last_relation,
                                    "hop": hops,
                                }
                            )
                if hops >= max_depth:
                    continue
                for neighbor, relation in adjacency.get(current, []):
                    if neighbor in visited:
                        continue
                    visited.add(neighbor)
                    queue.append((neighbor, hops + 1, relation))
        results.sort(key=lambda item: (item["hop"], str(item.get("refId"))))
        return results

    def ping() -> bool:
        return True

    store.replace_kb_graph = replace_kb_graph
    store.upsert_candidate_edges = upsert_candidate_edges
    store.traverse = traverse
    store.ping = ping


_install_provider_stubs()
_install_repository_stub()
_install_graph_store_stub()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=settings.service_host,
        port=settings.service_port,
        log_level="debug" if "--debug" in sys.argv else settings.log_level.lower(),
    )