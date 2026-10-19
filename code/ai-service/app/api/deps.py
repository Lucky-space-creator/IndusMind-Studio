from fastapi import Request


def trace_id(request: Request) -> str:
    from app.core.trace import new_trace_id

    value = getattr(request.state, "trace_id", "") or ""
    return value or new_trace_id()