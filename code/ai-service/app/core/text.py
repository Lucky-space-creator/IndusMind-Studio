import re

_CJK = re.compile(r"[\u4e00-\u9fff]")
_TOKEN = re.compile(r"[A-Za-z0-9_]+|[\u4e00-\u9fff]")

_STOPWORDS = {
    "的", "了", "和", "与", "及", "the", "a", "an", "of", "to", "and", "or",
    "is", "are", "for", "in", "on", "with", "by",
}


def tokenize(text: str) -> list[str]:
    if not text:
        return []
    tokens: list[str] = []
    for raw in _TOKEN.findall(text):
        token = raw.strip().lower()
        if not token or token in _STOPWORDS:
            continue
        tokens.append(token)
    return tokens


def to_tsvector_text(text: str) -> str:
    return " ".join(tokenize(text))


def contains_cjk(text: str) -> bool:
    return bool(_CJK.search(text or ""))


def truncate(text: str, limit: int) -> str:
    if text is None:
        return ""
    if len(text) <= limit:
        return text
    return text[:limit]