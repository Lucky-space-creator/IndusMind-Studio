from fastapi import APIRouter, Depends

from app.agents.multi import run_diagnosis
from app.api.deps import trace_id
from app.core.response import dump, success
from app.models.diagnosis import DiagnosisRunRequest

router = APIRouter(prefix="/diagnosis", tags=["diagnosis"])


@router.post("/run")
async def run(request: DiagnosisRunRequest, trace: str = Depends(trace_id)):
    result = run_diagnosis(request, trace)
    return success(dump(result), trace)