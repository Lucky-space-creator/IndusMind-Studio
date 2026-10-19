from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.core.errors import bad_request
from app.core.logging import get_logger
from app.models.rag import RagIndexRequest
from app.rag import repository
from app.rag.embedding import embed_texts

log = get_logger(__name__)


def _new_task_id() -> str:
    return uuid.uuid4().hex


def _new_index_version() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


def index_document(request: RagIndexRequest) -> tuple[str, str]:
    task_id = _new_task_id()
    if not request.segments:
        log.info("索引请求无片段，跳过 task=%s doc=%s", task_id, request.doc_id)
        return task_id, "success"
    contents = [segment.content or "" for segment in request.segments]
    vectors = embed_texts(contents)
    embed_model = _embedding_model_name()
    index_version = _new_index_version()
    rows = []
    for segment, vector in zip(request.segments, vectors):
        if not vector:
            continue
        rows.append(
            {
                "segment_id": segment.segment_id,
                "content": segment.content or "",
                "chapter": segment.chapter,
                "page_no": segment.page_no,
                "keywords": segment.keywords,
                "embedding": vector,
            }
        )
    affected = repository.upsert_segments(
        kb_id=request.kb_id,
        doc_id=request.doc_id,
        doc_status=(request.doc_status or "enabled"),
        embed_model=embed_model,
        index_version=index_version,
        rows=rows,
    )
    log.info("索引完成 task=%s doc=%s segments=%s", task_id, request.doc_id, affected)
    return task_id, "success"


def reindex_document(request: RagIndexRequest) -> tuple[str, str]:
    if request.doc_id is None:
        raise bad_request("reindex 需要 docId")
    repository.delete_by_doc(request.doc_id)
    return index_document(request)


def _embedding_model_name() -> str:
    from app.core.config import settings

    return settings.embedding_model


def delete(request) -> int:
    if request.doc_id is not None:
        return repository.delete_by_doc(request.doc_id)
    if request.kb_id is not None:
        return repository.delete_by_kb(request.kb_id)
    raise bad_request("kbId 与 docId 至少提供一个")


def update_document_status(request) -> int:
    return repository.update_doc_status(list(request.doc_ids), request.target_status)