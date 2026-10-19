from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.core.errors import bad_request
from app.core.providers.base import EmbeddingProvider, LLMProvider, RerankerProvider


@lru_cache
def get_llm() -> LLMProvider:
    provider = settings.llm_provider
    kwargs = {
        "model": settings.llm_model,
        "base_url": settings.llm_base_url,
        "api_key": settings.llm_api_key,
        "timeout": settings.llm_timeout,
        "retries": settings.llm_max_retries,
    }
    if provider == "dashscope":
        from app.core.providers.dashscope import DashScopeLLM as Impl
    elif provider == "openai":
        from app.core.providers.openai import OpenAILLM as Impl
    elif provider == "ollama":
        from app.core.providers.ollama import OllamaLLM as Impl
    else:
        raise bad_request(f"不支持的 LLM provider：{provider}")
    return Impl(**kwargs)


@lru_cache
def get_embedder() -> EmbeddingProvider:
    provider = settings.embedding_provider
    kwargs = {
        "model": settings.embedding_model,
        "base_url": settings.embedding_base_url,
        "api_key": settings.embedding_api_key,
        "dimension": settings.embedding_dim,
        "timeout": settings.embedding_timeout,
        "retries": settings.embedding_max_retries,
    }
    if provider == "dashscope":
        from app.core.providers.dashscope import DashScopeEmbedding as Impl
    elif provider == "openai":
        from app.core.providers.openai import OpenAIEmbedding as Impl
    elif provider == "ollama":
        from app.core.providers.ollama import OllamaEmbedding as Impl
    else:
        raise bad_request(f"不支持的 Embedding provider：{provider}")
    return Impl(**kwargs)


@lru_cache
def get_reranker() -> RerankerProvider:
    if not settings.reranker_enabled or not settings.reranker_model:
        from app.core.providers.reranker import NoopReranker

        return NoopReranker()
    from app.core.providers.reranker import HttpReranker

    return HttpReranker(
        model=settings.reranker_model,
        base_url=settings.reranker_base_url,
        api_key=settings.reranker_api_key,
        timeout=settings.reranker_timeout,
    )


def reset_providers() -> None:
    get_llm.cache_clear()
    get_embedder.cache_clear()
    get_reranker.cache_clear()