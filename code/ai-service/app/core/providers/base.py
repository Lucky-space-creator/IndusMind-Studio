from __future__ import annotations

from abc import ABC, abstractmethod


class LLMProvider(ABC):
    @abstractmethod
    def chat(
        self,
        messages: list[dict],
        *,
        temperature: float = 0.2,
        max_tokens: int | None = None,
    ) -> str:
        raise NotImplementedError


class EmbeddingProvider(ABC):
    @property
    @abstractmethod
    def dimension(self) -> int:
        raise NotImplementedError

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError

    def embed_one(self, text: str) -> list[float]:
        vectors = self.embed([text])
        if not vectors:
            return []
        return vectors[0]


class RerankerProvider(ABC):
    @property
    @abstractmethod
    def enabled(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    def rerank(
        self,
        query: str,
        documents: list[str],
        *,
        top_n: int | None = None,
    ) -> list[tuple[int, float]]:
        raise NotImplementedError