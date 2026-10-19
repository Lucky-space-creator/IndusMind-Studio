from __future__ import annotations

from app.core.logging import get_logger
from app.core.providers.base import RerankerProvider
from app.core.providers.http import bearer, post_json

log = get_logger(__name__)


class NoopReranker(RerankerProvider):
    @property
    def enabled(self) -> bool:
        return False

    def rerank(self, query: str, documents: list[str], *, top_n: int | None = None) -> list[tuple[int, float]]:
        size = len(documents)
        results = [(index, float(size - index)) for index in range(size)]
        if top_n is not None:
            return results[:top_n]
        return results


class HttpReranker(RerankerProvider):
    def __init__(
        self,
        *,
        model: str,
        base_url: str,
        api_key: str = "",
        timeout: int = 30,
        retries: int = 1,
    ):
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.retries = retries

    @property
    def enabled(self) -> bool:
        return True

    def rerank(self, query: str, documents: list[str], *, top_n: int | None = None) -> list[tuple[int, float]]:
        if not documents:
            return []
        payload: dict = {"model": self.model, "query": query, "documents": documents}
        if top_n is not None:
            payload["top_n"] = top_n
        try:
            data = post_json(
                f"{self.base_url}/rerank",
                payload,
                timeout=self.timeout,
                retries=self.retries,
                headers=bearer(self.api_key),
            )
            results = data.get("results") or []
            ranked = [
                (int(item.get("index", 0)), float(item.get("relevance_score", item.get("score", 0.0))))
                for item in results
                if "index" in item
            ]
            if ranked:
                return ranked
        except Exception as exc:
            log.warning("重排服务调用失败，回退原始顺序：%s", exc)
        return NoopReranker().rerank(query, documents, top_n=top_n)