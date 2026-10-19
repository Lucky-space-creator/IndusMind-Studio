from __future__ import annotations

from app.core.providers.base import EmbeddingProvider
from app.core.providers.openai_compat import OpenAICompatEmbedding, OpenAICompatLLM

OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1"


class OpenAILLM(OpenAICompatLLM):
    def __init__(self, *, model: str, base_url: str = "", api_key: str = "", timeout: int = 60, retries: int = 2):
        super().__init__(
            model=model,
            base_url=base_url or OPENAI_DEFAULT_BASE_URL,
            api_key=api_key,
            timeout=timeout,
            retries=retries,
        )


class OpenAIEmbedding(OpenAICompatEmbedding, EmbeddingProvider):
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
            base_url=base_url or OPENAI_DEFAULT_BASE_URL,
            api_key=api_key,
            dimension=dimension,
            timeout=timeout,
            retries=retries,
        )