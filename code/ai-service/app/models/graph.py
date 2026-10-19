from __future__ import annotations

from decimal import Decimal

from pydantic import Field, field_validator

from app.models.common import CamelModel

NODE_TYPES = {"doc", "document", "section", "segment"}
RELATION_TYPES = {
    "reference": "REF",
    "ref": "REF",
    "supplement": "SUPPLEMENT",
    "replacement": "REPLACE",
    "replace": "REPLACE",
    "prerequisite": "PRECEDE",
    "precede": "PRECEDE",
    "same_device": "SAME_DEVICE",
    "same_fault": "SAME_FAULT",
}


class SegmentRef(CamelModel):
    segment_id: int = Field(alias="segmentId")
    doc_id: int | None = Field(default=None, alias="docId")
    content: str
    chapter: str | None = None


class GraphExtractRequest(CamelModel):
    kb_id: int = Field(alias="kbId")
    segments: list[SegmentRef] = Field(default_factory=list)


class CandidateEdge(CamelModel):
    from_ref_id: int = Field(alias="fromRefId")
    from_node_type: str = Field(alias="fromNodeType")
    to_ref_id: int = Field(alias="toRefId")
    to_node_type: str = Field(alias="toNodeType")
    relation_type: str = Field(alias="relationType")
    confidence: Decimal | None = None
    source: str = "auto"


class GraphQueryRequest(CamelModel):
    node_ref_id: int = Field(alias="nodeRefId")
    node_type: str | None = Field(default=None, alias="nodeType")
    relation_types: list[str] | None = Field(default=None, alias="relationTypes")
    depth: int | None = 1

    @field_validator("depth")
    @classmethod
    def _clamp_depth(cls, value: int | None) -> int:
        if value is None:
            return 1
        return max(1, min(int(value), 5))


class RelatedNode(CamelModel):
    ref_id: int = Field(alias="refId")
    node_type: str = Field(alias="nodeType")
    title: str | None = None
    relation_type: str | None = Field(default=None, alias="relationType")
    via_node_id: int | None = Field(default=None, alias="viaNodeId")
    hop: int | None = None


class GraphQueryResponse(CamelModel):
    nodes: list[RelatedNode] = Field(default_factory=list)


class NodeItem(CamelModel):
    node_id: int = Field(alias="nodeId")
    node_type: str = Field(alias="nodeType")
    ref_id: int = Field(alias="refId")
    title: str | None = None


class EdgeItem(CamelModel):
    from_node_id: int = Field(alias="fromNodeId")
    to_node_id: int = Field(alias="toNodeId")
    relation_type: str = Field(alias="relationType")
    source: str | None = "manual"


class GraphSyncRequest(CamelModel):
    kb_id: int = Field(alias="kbId")
    nodes: list[NodeItem] = Field(default_factory=list)
    edges: list[EdgeItem] = Field(default_factory=list)


class GraphSyncResponse(CamelModel):
    kb_id: int = Field(alias="kbId")
    node_count: int = Field(default=0, alias="nodeCount")
    edge_count: int = Field(default=0, alias="edgeCount")