from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class Citation(CamelModel):
    doc_id: int | None = Field(default=None, alias="docId")
    segment_id: int | None = Field(default=None, alias="segmentId")
    doc_name: str | None = Field(default=None, alias="docName")
    chapter: str | None = None
    page_no: int | None = Field(default=None, alias="pageNo")
    score: Decimal | None = None