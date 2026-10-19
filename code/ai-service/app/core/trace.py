import uuid
from contextvars import ContextVar

_TRACE_ID: ContextVar[str] = ContextVar("trace_id", default="")


def new_trace_id() -> str:
    return uuid.uuid4().hex


def set_trace_id(trace_id: str) -> None:
    _TRACE_ID.set(trace_id or "")


def get_trace_id() -> str:
    return _TRACE_ID.get()