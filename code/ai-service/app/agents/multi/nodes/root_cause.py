from __future__ import annotations

from app.agents.common import build_citations, format_evidence, parse_json_object
from app.agents.multi.contracts import RootCauseOutput
from app.agents.multi.nodes.base import AgentNode, NodeResult
from app.agents.prompts import ROOT_CAUSE_SYSTEM
from app.core.logging import get_logger
from app.core.providers import get_llm

log = get_logger(__name__)


class RootCauseNode(AgentNode):
    code = "root_cause"
    name = "根因诊断"

    def run(self, state: dict) -> NodeResult:
        config = (state.get("configs") or {}).get(self.code)
        kb_ids = getattr(config, "kb_ids", None) if config else None
        strictness = getattr(config, "match_strictness", None) if config else None
        query = self._build_query(state)
        evidence = self.retrieve(query, kb_ids=kb_ids, strictness=strictness, top_k=5)

        output = self._from_llm(state, evidence)
        if output is None:
            output = self._fallback(evidence)
        citations = build_citations(evidence)
        summary = output.summary or (f"候选根因：{output.top_cause}" if output.top_cause else "证据不足，未能确定根因")
        return NodeResult(
            output=output.model_dump(by_alias=True),
            summary=summary,
            citations=citations,
            status="success" if evidence else "degraded",
            risk_level=None,
        )

    def _build_query(self, state: dict) -> str:
        request = state.get("request")
        parts: list[str] = []
        if request is not None and request.phenomenon:
            parts.append(request.phenomenon)
        for anomaly in state.get("anomalies") or []:
            label = getattr(anomaly, "metric_name", None) or ""
            summary = getattr(anomaly, "summary", None) or ""
            parts.append(f"{label} {summary}".strip())
        return " ".join(part for part in parts if part)

    def _from_llm(self, state: dict, evidence: list[dict]) -> RootCauseOutput | None:
        if not evidence:
            return None
        config = (state.get("configs") or {}).get(self.code)
        context = format_evidence(evidence)
        query = self._build_query(state)
        messages = [
            {"role": "system", "content": self.compose_system_prompt(config, ROOT_CAUSE_SYSTEM)},
            {"role": "user", "content": self.with_output_format(config, f"【证据】\n{context}\n\n【现象】{query}")},
        ]
        try:
            text = get_llm().chat(messages, temperature=0.2)
        except Exception as exc:
            log.warning("[root_cause] LLM 调用失败，使用启发式：%s", exc)
            return None
        data = parse_json_object(text)
        if not data:
            return None
        try:
            data.setdefault("summary", data.get("topCause"))
            return RootCauseOutput.model_validate(data)
        except Exception as exc:
            log.warning("[root_cause] 输出契约校验失败：%s", exc)
            return None

    def _fallback(self, evidence: list[dict]) -> RootCauseOutput:
        causes = []
        for seg in evidence[:3]:
            cause = (seg.get("chapter") or (seg.get("content") or "")[:40]).strip()
            if cause:
                causes.append(
                    {
                        "cause": cause,
                        "confidence": round(float(seg.get("score") or 0.0), 4),
                        "evidence": f"segmentId={seg.get('segment_id')}",
                    }
                )
        top = causes[0]["cause"] if causes else None
        return RootCauseOutput(
            rootCauses=causes,
            topCause=top,
            confidence=causes[0]["confidence"] if causes else None,
            summary=f"基于检索证据给出 {len(causes)} 条候选根因" if causes else "证据不足，未能确定根因",
        )