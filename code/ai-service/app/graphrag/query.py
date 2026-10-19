from __future__ import annotations

from app.core.logging import get_logger
from app.graphrag import store
from app.graphrag.extractor import extract_candidates
from app.models.graph import (
    CandidateEdge,
    GraphQueryRequest,
    GraphSyncRequest,
    GraphSyncResponse,
    RelatedNode,
)

log = get_logger(__name__)


def extract(kb_id: int, segments: list[dict]) -> list[CandidateEdge]:
    edges = extract_candidates(kb_id, segments)
    if edges:
        rows = [
            {
                "fromGraphId": store.build_graph_id(kb_id, edge.from_node_type, edge.from_ref_id),
                "toGraphId": store.build_graph_id(kb_id, edge.to_node_type, edge.to_ref_id),
                "fromRefId": edge.from_ref_id,
                "fromNodeType": edge.from_node_type,
                "toRefId": edge.to_ref_id,
                "toNodeType": edge.to_node_type,
                "relationType": edge.relation_type,
                "confidence": float(edge.confidence) if edge.confidence is not None else None,
            }
            for edge in edges
        ]
        try:
            store.upsert_candidate_edges(kb_id, rows)
        except Exception as exc:
            log.warning("候选边写入图库失败（候选边仍返回给调用方）：%s", exc)
    return edges


def query(request: GraphQueryRequest) -> list[RelatedNode]:
    records = store.traverse(
        request.node_ref_id,
        node_type=request.node_type,
        relation_types=request.relation_types,
        depth=request.depth or 1,
    )
    nodes: list[RelatedNode] = []
    seen: set[tuple] = set()
    for record in records:
        ref_id = record.get("refId")
        node_type = record.get("nodeType")
        if ref_id is None or node_type is None:
            continue
        key = (ref_id, node_type)
        if key in seen:
            continue
        seen.add(key)
        nodes.append(
            RelatedNode(
                refId=int(ref_id),
                nodeType=node_type,
                title=record.get("title"),
                relationType=record.get("relationType"),
                viaNodeId=int(ref_id),
                hop=int(record.get("hop") or 1),
            )
        )
    return nodes


def sync(request: GraphSyncRequest) -> GraphSyncResponse:
    nodes = [
        {
            "graphId": store.build_graph_id(request.kb_id, node.node_type, node.ref_id),
            "nodeId": node.node_id,
            "nodeType": node.node_type,
            "refId": node.ref_id,
            "title": node.title,
        }
        for node in request.nodes
    ]
    node_index = {node.node_id: node for node in request.nodes}
    edges = []
    for edge in request.edges:
        from_node = node_index.get(edge.from_node_id)
        to_node = node_index.get(edge.to_node_id)
        if from_node is None or to_node is None:
            continue
        edges.append(
            {
                "fromGraphId": store.build_graph_id(request.kb_id, from_node.node_type, from_node.ref_id),
                "toGraphId": store.build_graph_id(request.kb_id, to_node.node_type, to_node.ref_id),
                "relationType": edge.relation_type,
                "source": edge.source or "manual",
            }
        )
    node_count, edge_count = store.replace_kb_graph(request.kb_id, nodes, edges)
    return GraphSyncResponse(kbId=request.kb_id, nodeCount=node_count, edgeCount=edge_count)