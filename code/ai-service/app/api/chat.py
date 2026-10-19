from fastapi import APIRouter, Depends

from app.agents.single import agent
from app.api.deps import trace_id
from app.core.response import dump, success
from app.models.chat import ChatRequest

router = APIRouter(tags=["chat"])


@router.post("/chat")
async def chat(request: ChatRequest, trace: str = Depends(trace_id)):
    result = agent.answer(
        request.question,
        kb_ids=request.kb_ids,
        strictness=request.match_strictness,
        trace_id=trace,
    )
    return success(dump(result), trace)