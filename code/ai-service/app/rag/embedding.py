from __future__ import annotations

from collections import OrderedDict
from hashlib import sha256

from app.core.config import settings
from app.core.logging import get_logger
from app.core.providers import get_embedder

log = get_logger(__name__)

_CACHE: "OrderedDict[str, list[float]]" = OrderedDict()
_CACHE_MAX = 2000


def _key(text: str) -> str:
    return sha256(text.encode("utf-8")).hexdigest()


def _cache_get(text: str) -> list[float] | None:
    key = _key(text)
    if key in _CACHE:
        _CACHE.move_to_end(key)
        return _CACHE[key]
    return None


def _cache_put(text: str, vector: list[float]) -> None:
    key = _key(text)
    _CACHE[key] = vector
    _CACHE.move_to_end(key)
    while len(_CACHE) > _CACHE_MAX:
        _CACHE.popitem(last=False)


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    embedder = get_embedder()
    results: list[list[float] | None] = [None] * len(texts)
    missing: list[int] = []
    for index, text in enumerate(texts):
        cached = _cache_get(text)
        if cached is not None:
            results[index] = cached
        else:
            missing.append(index)
    batch_size = max(1, settings.embedding_batch_size)
    for start in range(0, len(missing), batch_size):
        chunk = missing[start:start + batch_size]
        vectors = embedder.embed([texts[i] for i in chunk])
        for offset, index in enumerate(chunk):
            vector = list(vectors[offset]) if offset < len(vectors) else []
            results[index] = vector
            if vector:
                _cache_put(texts[index], vector)
    return [vec or [] for vec in results]


def embed_query(query: str) -> list[float]:
    vectors = embed_texts([query])
    return vectors[0] if vectors else []