from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.core.logging import get_logger
from app.models.common import Citation
from app.rag import retriever

log = get_logger(__name__)

AGENT_NAMES = {
    "monitor": "设备监测",
    "root_cause": "根因诊断",
    "spare_cost": "备件成本",
    "safety": "安全规范",
    "work_order": "工单",
}


@dataclass
class NodeResult:
    output: dict[str, Any]
    summary: str = ""
    citations: list[Citation] = field(default_factory=list)
    status: str = "success"
    risk_level: str | None = None


class AgentNode:
    code: str = ""
    name: str = ""
    template_code: str = ""

    def __init__(self):
        if not self.code:
            self.code = self.__class__.__name__.lower()
        self.name = self.name or AGENT_NAMES.get(self.code, self.code)
        self.template_code = self.template_code or self.code

    def run(self, state: dict) -> NodeResult:
        raise NotImplementedError

    def compose_system_prompt(self, config, base_system: str) -> str:
        parts: list[str] = []
        instruction = (getattr(config, "instruction", None) or "").strip() if config else ""
        if instruction:
            parts.append(instruction)
        parts.append(base_system)
        boundary = (getattr(config, "boundary", None) or "").strip() if config else ""
        if boundary:
            parts.append("边界约束：" + boundary)
        return "\n\n".join(parts)

    def with_output_format(self, config, user_content: str) -> str:
        fmt = (getattr(config, "output_format", None) or "").strip() if config else ""
        if not fmt:
            return user_content
        return f"{user_content}\n\n请按以下格式组织输出：{fmt}"

    def retrieve(
        self,
        query: str,
        *,
        kb_ids: list[int] | None,
        strictness: str | None,
        top_k: int = 5,
    ) -> list[dict]:
        if not query or not query.strip():
            return []
        try:
            hits = retriever.search(query, kb_ids=kb_ids, top_k=top_k, strictness=strictness)
        except Exception as exc:
            log.warning("[%s] 检索失败：%s", self.code, exc)
            return []
        return [
            {
                "segment_id": hit.segment_id,
                "doc_id": hit.doc_id,
                "content": hit.content,
                "chapter": hit.chapter,
                "page_no": hit.page_no,
                "score": float(hit.score) if hit.score is not None else None,
            }
            for hit in hits
        ]

    @staticmethod
    def severity_rank(severity: str | None) -> int:
        return {"low": 1, "medium": 2, "high": 3}.get((severity or "").lower(), 0)

    @staticmethod
    def rank_severity(rank: int) -> str:
        return {1: "low", 2: "medium", 3: "high"}.get(rank, "low")