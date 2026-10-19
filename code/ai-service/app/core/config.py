from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="config/.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    service_host: str = "0.0.0.0"
    service_port: int = 8100
    log_level: str = "INFO"

    llm_provider: Literal["dashscope", "ollama", "openai"] = "ollama"
    llm_model: str = "qwen2.5:7b"
    llm_base_url: str = "http://localhost:11434/v1"
    llm_api_key: str = ""
    llm_timeout: int = 60
    llm_max_retries: int = 2

    embedding_provider: Literal["dashscope", "ollama", "openai"] = "ollama"
    embedding_model: str = "bge-m3"
    embedding_base_url: str = "http://localhost:11434/v1"
    embedding_api_key: str = ""
    embedding_dim: int = 1024
    embedding_timeout: int = 60
    embedding_max_retries: int = 2
    embedding_batch_size: int = 16

    reranker_enabled: bool = False
    reranker_model: str = ""
    reranker_base_url: str = "http://localhost:8080/v1"
    reranker_api_key: str = ""
    reranker_timeout: int = 30

    pg_dsn: str = "postgresql://hwc:hwc123456@localhost:5432/hwc_ai"
    pg_pool_min: int = 2
    pg_pool_max: int = 10

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "hwc123456"

    redis_url: str = "redis://localhost:6379/1"
    rag_cache_ttl: int = 300

    rag_top_k: int = 5
    rag_vector_weight: float = 0.7
    rag_keyword_weight: float = 0.3


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()