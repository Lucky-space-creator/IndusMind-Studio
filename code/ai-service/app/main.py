import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api import chat_router, diagnosis_router, graph_router, rag_router
from app.core.config import settings
from app.core.errors import AiServiceError, ErrorCode
from app.core.logging import setup_logging
from app.core.response import failure
from app.core.trace import new_trace_id, set_trace_id

setup_logging(settings.log_level)

app = FastAPI(
    title="HWC AI Service",
    description="RAG / GraphRAG / 单 Agent 问答 / 多 Agent 协同诊断",
    version="1.0.0",
)

app.include_router(rag_router)
app.include_router(graph_router)
app.include_router(chat_router)
app.include_router(diagnosis_router)


def _trace_of(request: Request) -> str:
    return getattr(request.state, "trace_id", "") or new_trace_id()


@app.middleware("http")
async def trace_id_middleware(request: Request, call_next):
    trace_id = request.headers.get("X-Trace-Id") or uuid.uuid4().hex
    request.state.trace_id = trace_id
    set_trace_id(trace_id)
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Trace-Id"] = trace_id
    response.headers["X-Response-Time"] = f"{(time.perf_counter() - start) * 1000:.1f}ms"
    return response


@app.exception_handler(AiServiceError)
async def ai_service_error_handler(request: Request, exc: AiServiceError):
    return JSONResponse(status_code=200, content=failure(exc.code, exc.message, _trace_of(request)))


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    detail = errors[0].get("msg") if errors else "参数校验失败"
    return JSONResponse(
        status_code=200,
        content=failure(int(ErrorCode.VALIDATION_ERROR), f"参数校验失败：{detail}", _trace_of(request)),
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=200,
        content=failure(int(ErrorCode.INTERNAL_ERROR), "服务内部错误，请稍后重试", _trace_of(request)),
    )


@app.get("/health")
async def health(request: Request):
    return {
        "code": int(ErrorCode.OK),
        "message": "ok",
        "data": {"service": "hwc-ai-service", "version": app.version},
        "traceId": _trace_of(request),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.service_host,
        port=settings.service_port,
        log_level=settings.log_level.lower(),
    )