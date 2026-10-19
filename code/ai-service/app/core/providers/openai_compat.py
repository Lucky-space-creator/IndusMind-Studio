from __future__ import annotations

from app.core.logging import get_logger
from app.core.providers.base import EmbeddingProvider, LLMProvider
from app.core.providers.http import as_text, bearer, post_json

log = get_logger(__name__)


class OpenAICompatLLM(LLMProvider):
    def __init__(
        self,
        *,
        model: str,
        base_url: str,
        api_key: str = "",
        timeout: int = 60,
        retries: int = 2,
    ):
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.retries = retries

    def chat(
        self,
        messages: list[dict],
        *,
        temperature: float = 0.2,
        max_tokens: int | None = None,
    ) -> str:
        payload: dict = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        data = post_json(
            f"{self.base_url}/chat/completions",
            payload,
            timeout=self.timeout,
            retries=self.retries,
            headers=bearer(self.api_key),
        )
        text = as_text(data)
        if not text:
            log.warning("模型返回空内容 model=%s", self.model)
        return text


class OpenAICompatEmbedding(EmbeddingProvider):
    def __init__(
        self,
        *,
        model: str,
        base_url: str,
        api_key: str = "",
        dimension: int = 1024,
        timeout: int = 60,
        retries: int = 2,
    ):
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self._dimension = dimension
        self.timeout = timeout
        self.retries = retries

    @property
    def dimension(self) -> int:
        return self._dimension

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        data = post_json(
            f"{self.base_url}/embeddings",
            {"model": self.model, "input": texts},
            timeout=self.timeout,
            retries=self.retries,
            headers=bearer(self.api_key),
        )
        items = sorted(data.get("data") or [], key=lambda item: item.get("index", 0))
        vectors = [list(item.get("embedding") or []) for item in items]
        if vectors and self._dimension and len(vectors[0]) != self._dimension:
            self._dimension = len(vectors[0])
        return vectors