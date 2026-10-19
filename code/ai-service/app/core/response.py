from typing import Any

from pydantic import BaseModel, ConfigDict

from app.core.errors import ErrorCode


def success(data: Any = None, trace_id: str = "") -> dict:
    return {
        "code": int(ErrorCode.OK),
        "message": "ok",
        "data": data,
        "traceId": trace_id,
    }


def failure(code: int, message: str, trace_id: str = "") -> dict:
    return {
        "code": int(code),
        "message": message,
        "data": None,
        "traceId": trace_id,
    }


def dump(model: BaseModel) -> Any:
    return model.model_dump(by_alias=True)


class ApiEnvelope(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    code: int = 0
    message: str = "ok"
    data: Any = None
    traceId: str = ""