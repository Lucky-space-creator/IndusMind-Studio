from __future__ import annotations

from pydantic import Field, field_validator

from app.models.common import CamelModel, Citation


class ChatRequest(CamelModel):
    session_id: str | None = Field(default=None, alias="sessionId")
    question: str
    kb_ids: list[int] | None = Field(default=None, alias="kbIds")
    match_strictness: str | None = Field(default=None, alias="matchStrictness")

    @field_validator("question")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("question 不能为空")
        return value.strip()


class ChatResponse(CamelModel):
    answer: str
    citations: list[Citation] = Field(default_factory=list)
    hit: bool = False
    trace_id: str | None = Field(default=None, alias="traceId")