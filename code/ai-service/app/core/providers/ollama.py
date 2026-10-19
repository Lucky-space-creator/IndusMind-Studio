from __future__ import annotations

from app.core.providers.base import EmbeddingProvider
from app.core.providers.openai_compat import OpenAICompatEmbedding, OpenAICompatLLM

OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434/v1"


class OllamaLLM(OpenAICompatLLM):
    def __init__(self, *, model: str, base_url: str = "", api_key: str = "", timeout: int = 60, retries: int = 2):
        super().__init__(
            model=model,
            base_url=base_url or OLLAMA_DEFAULT_BASE_URL,
            api_key=api_key,
            timeout=timeout,
            retries=retries,
        )


class OllamaEmbedding(OpenAICompatEmbedding, EmbeddingProvider):
    def __init__(
        self,
        *,
        model: str,
        base_url: str = "",
        api_key: str = "",
        dimension: int = 1024,
        timeout: int = 60,
        retries: int = 2,
    ):
        super().__init__(
            model=model,
            base_url=base_url or OLLAMA_DEFAULT_BASE_URL,
            api_key=api_key,
            dimension=dimension,
            timeout=timeout,
            retries=retries,
        )