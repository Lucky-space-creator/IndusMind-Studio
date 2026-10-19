from fastapi import APIRouter, Depends

from app.api.deps import trace_id
from app.core.response import dump, success
from app.graphrag import query as graph_query
from app.models.graph import (
    GraphExtractRequest,
    GraphQueryRequest,
    GraphQueryResponse,
    GraphSyncRequest,
)


router = APIRouter(prefix="/graph", tags=["graph"])


@router.post("/extract")
async def extract(request: GraphExtractRequest, trace: str = Depends(trace_id)):
    segments = [segment.model_dump(by_alias=True) for segment in request.segments]
    edges = graph_query.extract(request.kb_id, segments)
    return success([dump(edge) for edge in edges], trace)


@router.post("/query")
async def query(request: GraphQueryRequest, trace: str = Depends(trace_id)):
    nodes = graph_query.query(request)
    return success(dump(GraphQueryResponse(nodes=nodes)), trace)


@router.post("/sync")
async def sync(request: GraphSyncRequest, trace: str = Depends(trace_id)):
    result = graph_query.sync(request)
    return success(dump(result), trace)