from fastapi import APIRouter, Depends

from app.api.deps import trace_id
from app.core.response import dump, success
from app.models.rag import (
    RagDeleteRequest,
    RagDocumentStatusRequest,
    RagIndexRequest,
    RagIndexResponse,
    RagMutationResponse,
    RagSearchRequest,
    RagSearchResponse,
)
from app.rag import indexer, retriever

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post("/index")
async def index(request: RagIndexRequest, trace: str = Depends(trace_id)):
    task_id, status = indexer.index_document(request)
    return success(dump(RagIndexResponse(taskId=task_id, status=status)), trace)


@router.post("/reindex")
async def reindex(request: RagIndexRequest, trace: str = Depends(trace_id)):
    task_id, status = indexer.reindex_document(request)
    return success(dump(RagIndexResponse(taskId=task_id, status=status)), trace)


@router.post("/search")
async def search(request: RagSearchRequest, trace: str = Depends(trace_id)):
    segments = retriever.search(
        request.query,
        kb_ids=request.kb_ids,
        top_k=request.top_k,
        strictness=request.strictness,
    )
    return success(dump(RagSearchResponse(segments=segments)), trace)


@router.post("/document-status")
async def document_status(request: RagDocumentStatusRequest, trace: str = Depends(trace_id)):
    affected = indexer.update_document_status(request)
    return success(dump(RagMutationResponse(affected=affected)), trace)


@router.post("/delete")
async def delete(request: RagDeleteRequest, trace: str = Depends(trace_id)):
    affected = indexer.delete(request)
    return success(dump(RagMutationResponse(affected=affected)), trace)