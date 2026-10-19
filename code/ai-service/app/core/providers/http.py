from __future__ import annotations

import time
from typing import Any

from app.core.errors import model_unavailable
from app.core.logging import get_logger

log = get_logger(__name__)


def post_json(
    url: str,
    payload: dict,
    *,
    timeout: int,
    retries: int = 1,
    headers: dict | None = None,
) -> dict:
    import httpx

    request_headers = {"Content-Type": "application/json"}
    if headers:
        request_headers.update(headers)
    last_error: Exception | None = None
    attempts = max(1, retries + 1)
    for attempt in range(attempts):
        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(url, json=payload, headers=request_headers)
            if resp.status_code >= 400:
                last_error = RuntimeError(f"HTTP {resp.status_code}: {resp.text[:200]}")
            else:
                return resp.json()
        except Exception as exc:
            last_error = exc
        if attempt < attempts - 1:
            log.warning("模型请求失败，第 %s 次重试：%s", attempt + 1, last_error)
            time.sleep(min(2 ** attempt, 4))
    raise model_unavailable("模型服务暂不可用，请稍后重试", detail=str(last_error))


def bearer(api_key: str) -> dict:
    if api_key:
        return {"Authorization": f"Bearer {api_key}"}
    return {}


def as_text(payload: dict, key: str = "content") -> str:
    try:
        choices = payload.get("choices") or []
        if not choices:
            return ""
        message: dict[str, Any] = choices[0].get("message") or {}
        content = message.get(key)
        if content is None:
            content = choices[0].get("text")
        return (content or "").strip()
    except Exception:
        return ""