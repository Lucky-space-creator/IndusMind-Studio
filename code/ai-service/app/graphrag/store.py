from __future__ import annotations

from app.core.config import settings
from app.core.errors import graph_unavailable
from app.core.logging import get_logger

log = get_logger(__name__)

LABEL = "KBNode"


def _driver():
    try:
        from neo4j import GraphDatabase
    except Exception as exc:
        raise graph_unavailable("图库驱动未就绪", detail=str(exc))
    try:
        return GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
    except Exception as exc:
        raise graph_unavailable("图库连接失败", detail=str(exc))


def _graph_id(kb_id: int, node_type: str, ref_id: int) -> str:
    return f"{kb_id}:{(node_type or 'segment')}:{ref_id}"


def replace_kb_graph(kb_id: int, nodes: list[dict], edges: list[dict]) -> tuple[int, int]:
    driver = _driver()
    try:
        with driver.session() as session:
            session.run(f"MATCH (n:{LABEL} {{kbId: $kbId}}) DETACH DELETE n", kbId=kb_id)
            session.run(
                f"""
                UNWIND $nodes AS row
                MERGE (n:{LABEL} {{graphId: row.graphId}})
                SET n.kbId = $kbId, n.nodeId = row.nodeId, n.nodeType = row.nodeType,
                    n.refId = row.refId, n.title = row.title
                """,
                nodes=nodes,
                kbId=kb_id,
            )
            session.run(
                f"""
                UNWIND $edges AS row
                MATCH (a:{LABEL} {{graphId: row.fromGraphId}})
                MATCH (b:{LABEL} {{graphId: row.toGraphId}})
                MERGE (a)-[r:REL {{
                    fromGraphId: row.fromGraphId,
                    toGraphId: row.toGraphId,
                    relationType: row.relationType
                }}]->(b)
                SET r.source = row.source
                """,
                edges=edges,
            )
        return len(nodes), len(edges)
    finally:
        driver.close()


def traverse(
    node_ref_id: int,
    *,
    node_type: str | None,
    relation_types: list[str] | None,
    depth: int,
) -> list[dict]:
    driver = _driver()
    types = [t.upper() for t in (relation_types or [])] or None
    try:
        with driver.session() as session:
            records = session.run(
                f"""
                MATCH (start:{LABEL} {{refId: $refId}})
                WHERE $nodeType IS NULL OR start.nodeType = $nodeType
                MATCH path = (start)-[rels:REL*1..%d]-(other:{LABEL})
                WHERE other.refId <> start.refId
                  AND ($types IS NULL OR all(r IN rels WHERE r.relationType IN $types))
                RETURN other.refId AS refId, other.nodeType AS nodeType,
                       other.title AS title,
                       last(rels).relationType AS relationType,
                       length(path) AS hop
                ORDER BY hop
                """ % int(depth),
                refId=node_ref_id,
                nodeType=node_type,
                types=types,
            )
            return [dict(record) for record in records]
    finally:
        driver.close()


def upsert_candidate_edges(kb_id: int, edges: list[dict]) -> int:
    if not edges:
        return 0
    driver = _driver()
    try:
        with driver.session() as session:
            session.run(
                f"""
                UNWIND $edges AS row
                MERGE (a:{LABEL} {{graphId: row.fromGraphId}})
                  SET a.kbId = $kbId, a.refId = row.fromRefId, a.nodeType = row.fromNodeType
                MERGE (b:{LABEL} {{graphId: row.toGraphId}})
                  SET b.kbId = $kbId, b.refId = row.toRefId, b.nodeType = row.toNodeType
                MERGE (a)-[r:REL {{
                    fromGraphId: row.fromGraphId,
                    toGraphId: row.toGraphId,
                    relationType: row.relationType
                }}]->(b)
                SET r.source = 'auto', r.confidence = row.confidence
                """,
                edges=edges,
                kbId=kb_id,
            )
        return len(edges)
    finally:
        driver.close()


def ping() -> bool:
    try:
        driver = _driver()
        try:
            driver.verify_connectivity()
        finally:
            driver.close()
        return True
    except Exception as exc:
        log.warning("图库 ping 失败：%s", exc)
        return False


def build_graph_id(kb_id: int, node_type: str, ref_id: int) -> str:
    return _graph_id(kb_id, node_type, ref_id)