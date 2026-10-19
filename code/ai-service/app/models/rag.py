from __future__ import annotations

from decimal import Decimal

from pydantic import Field, field_validator

from app.models.common import CamelModel


class SegmentItem(CamelModel):
    segment_id: int = Field(alias="segmentId")
    seq_no: int | None = Field(default=None, alias="seqNo")
    content: str
    chapter: str | None = None
    page_no: int | None = Field(default=None, alias="pageNo")
    keywords: str | None = None


class RagIndexRequest(CamelModel):
    kb_id: int = Field(alias="kbId")
    doc_id: int = Field(alias="docId")
    doc_name: str | None = Field(default=None, alias="docName")
    doc_status: str | None = Field(default="enabled", alias="docStatus")
    segments: list[SegmentItem] = Field(default_factory=list)


class RagIndexResponse(CamelModel):
    task_id: str = Field(alias="taskId")
    status: str


class RagSearchRequest(CamelModel):
    query: str
    kb_ids: list[int] | None = Field(default=None, alias="kbIds")
    top_k: int | None = Field(default=None, alias="topK")
    strictness: str | None = None


class SegmentHit(CamelModel):
    segment_id: int = Field(alias="segmentId")
    doc_id: int = Field(alias="docId")
    doc_name: str | None = Field(default=None, alias="docName")
    chapter: str | None = None
    page_no: int | None = Field(default=None, alias="pageNo")
    content: str
    score: Decimal | None = None


class RagSearchResponse(CamelModel):
    segments: list[SegmentHit] = Field(default_factory=list)


class RagDocumentStatusRequest(CamelModel):
    doc_ids: list[int] = Field(default_factory=list, alias="docIds")
    target_status: str = Field(alias="targetStatus")

    @field_validator("target_status")
    @classmethod
    def _validate_status(cls, value: str) -> str:
        normalized = (value or "").strip().lower()
        if normalized not in {"enabled", "disabled"}:
            raise ValueError("targetStatus 仅支持 enabled/disabled")
        return normalized


class RagDeleteRequest(CamelModel):
    kb_id: int | None = Field(default=None, alias="kbId")
    doc_id: int | None = Field(default=None, alias="docId", validate_default=True)

    @field_validator("doc_id")
    @classmethod
    def _require_scope(cls, value: int | None, info):
        if value is None and info.data.get("kb_id") is None:
            raise ValueError("kbId 与 docId 至少提供一个")
        return value


class RagMutationResponse(CamelModel):
    affected: int = 0