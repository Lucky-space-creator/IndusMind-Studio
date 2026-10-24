from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator, Sequence

from app.core.config import settings
from app.core.errors import AiServiceError, vector_unavailable
from app.core.logging import get_logger
from app.core.text import to_tsvector_text

log = get_logger(__name__)


def _vector_literal(vector: Sequence[float]) -> str:
    return "[" + ",".join(f"{float(x):.8f}" for x in vector) + "]"


@contextmanager
def _connect() -> Iterator:
    try:
        import psycopg
    except Exception as exc:
        raise vector_unavailable("向量库驱动未就绪", detail=str(exc))
    try:
        conn = psycopg.connect(settings.pg_dsn, autocommit=False)
    except Exception as exc:
        raise vector_unavailable("向量库连接失败", detail=str(exc))
    try:
        yield conn
        conn.commit()
    except AiServiceError:
        conn.rollback()
        raise
    except Exception as exc:
        conn.rollback()
        raise vector_unavailable("向量库操作失败", detail=str(exc))
    finally:
        conn.close()


def upsert_segments(
    *,
    kb_id: int,
    doc_id: int,
    doc_status: str,
    embed_model: str,
    index_version: str,
    rows: list[dict],
) -> int:
    if not rows:
        return 0
    sql = """
        INSERT INTO kb_segment_vector
            (segment_id, kb_id, doc_id, doc_status, content, chapter, page_no,
             keywords, keywords_tsv, embedding, embed_model, index_version)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, to_tsvector('simple', %s),
                %s::vector, %s, %s)
        ON CONFLICT (segment_id) DO UPDATE SET
            kb_id = EXCLUDED.kb_id,
            doc_id = EXCLUDED.doc_id,
            doc_status = EXCLUDED.doc_status,
            content = EXCLUDED.content,
            chapter = EXCLUDED.chapter,
            page_no = EXCLUDED.page_no,
            keywords = EXCLUDED.keywords,
            keywords_tsv = EXCLUDED.keywords_tsv,
            embedding = EXCLUDED.embedding,
            embed_model = EXCLUDED.embed_model,
            index_version = EXCLUDED.index_version,
            update_time = now()
    """
    params = []
    for row in rows:
        keyword_text = to_tsvector_text(row.get("keywords") or row.get("content") or "")
        params.append(
            (
                row["segment_id"],
                kb_id,
                doc_id,
                doc_status,
                row["content"],
                row.get("chapter"),
                row.get("page_no"),
                keyword_text,
                keyword_text,
                _vector_literal(row["embedding"]),
                embed_model,
                index_version,
            )
        )
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.executemany(sql, params)
            return cur.rowcount if cur.rowcount is not None and cur.rowcount >= 0 else len(params)


def delete_by_doc(doc_id: int) -> int:
    return _delete("DELETE FROM kb_segment_vector WHERE doc_id = %s", (doc_id,))


def delete_by_kb(kb_id: int) -> int:
    return _delete("DELETE FROM kb_segment_vector WHERE kb_id = %s", (kb_id,))


def _delete(sql: str, params: tuple) -> int:
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.rowcount or 0


def update_doc_status(doc_ids: list[int], target_status: str) -> int:
    if not doc_ids:
        return 0
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE kb_segment_vector SET doc_status = %s, update_time = now() "
                "WHERE doc_id = ANY(%s)",
                (target_status, doc_ids),
            )
            return cur.rowcount or 0


def vector_search(
    embedding: Sequence[float],
    *,
    kb_ids: list[int] | None,
    top_k: int,
) -> list[dict]:
    literal = _vector_literal(embedding)
    sql = (
        "SELECT segment_id, doc_id, content, chapter, page_no, "
        "1 - (embedding <=> %s::vector) AS score "
        "FROM kb_segment_vector WHERE doc_status = 'enabled'"
    )
    params: list = [literal]
    if kb_ids is not None:
        # 空列表代表「无授权知识库」，必须显式过滤为 0 命中，不能退化为全库检索
        sql += " AND kb_id = ANY(%s)"
        params.append(list(kb_ids))
    sql += " ORDER BY embedding <=> %s::vector LIMIT %s"
    params.extend([literal, top_k])
    return _fetch(sql, params)


def keyword_search(query: str, *, kb_ids: list[int] | None, top_k: int) -> list[dict]:
    sql = (
        "SELECT segment_id, doc_id, content, chapter, page_no, "
        "ts_rank(keywords_tsv, plainto_tsquery('simple', %s)) AS score "
        "FROM kb_segment_vector "
        "WHERE doc_status = 'enabled' AND keywords_tsv @@ plainto_tsquery('simple', %s)"
    )
    params: list = [query, query]
    if kb_ids is not None:
        # 同上：空列表必须过滤为 0 命中
        sql += " AND kb_id = ANY(%s)"
        params.append(list(kb_ids))
    sql += " ORDER BY score DESC LIMIT %s"
    params.append(top_k)
    return _fetch(sql, params)


def _fetch(sql: str, params: list) -> list[dict]:
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            columns = [desc[0] for desc in cur.description]
            return [dict(zip(columns, record)) for record in cur.fetchall()]


def fetch_segments(segment_ids: list[int]) -> list[dict]:
    if not segment_ids:
        return []
    return _fetch(
        "SELECT segment_id, doc_id, content, chapter, page_no, 0.0 AS score "
        "FROM kb_segment_vector WHERE segment_id = ANY(%s)",
        [list(segment_ids)],
    )


def ping() -> bool:
    try:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return True
    except Exception as exc:
        log.warning("向量库 ping 失败：%s", exc)
        return False