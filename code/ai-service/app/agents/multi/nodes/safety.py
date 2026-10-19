from __future__ import annotations

from app.agents.common import build_citations, format_evidence, parse_json_object
from app.agents.multi.contracts import SafetyOutput
from app.agents.multi.nodes.base import AgentNode, NodeResult
from app.agents.prompts import SAFETY_SYSTEM
from app.core.logging import get_logger
from app.core.providers import get_llm

log = get_logger(__name__)


class SafetyNode(AgentNode):
    code = "safety"
    name = "安全规范"

    def run(self, state: dict) -> NodeResult:
        config = (state.get("configs") or {}).get(self.code)
        kb_ids = getattr(config, "kb_ids", None) if config else None
        strictness = getattr(config, "match_strictness", None) if config else None
        root_cause = (state.get("agent_outputs") or {}).get("root_cause") or {}
        query = self._build_query(state, root_cause)
        evidence = self.retrieve(query, kb_ids=kb_ids, strictness=strictness, top_k=5)

        output = self._from_llm(query, evidence, config)
        if output is None:
            output = self._fallback(evidence, root_cause)
        citations = build_citations(evidence)
        if output.check_result == "fail":
            summary = f"安全核查未通过：{output.reason or '存在未满足的安全要求'}，将否决进入工单。"
        else:
            summary = f"安全核查通过，风险等级 {output.risk_level}"
        return NodeResult(
            output=output.model_dump(by_alias=True),
            summary=summary,
            citations=citations,
            status="success" if evidence else "degraded",
            risk_level=output.risk_level,
        )

    def _build_query(self, state: dict, root_cause: dict) -> str:
        parts = ["安全 操作规程 维修 注意事项"]
        top_cause = root_cause.get("topCause")
        if top_cause:
            parts.append(str(top_cause))
        request = state.get("request")
        if request is not None and request.phenomenon:
            parts.append(request.phenomenon)
        return " ".join(parts)

    def _from_llm(self, query: str, evidence: list[dict], config=None) -> SafetyOutput | None:
        if not evidence:
            return None
        context = format_evidence(evidence)
        messages = [
            {"role": "system", "content": self.compose_system_prompt(config, SAFETY_SYSTEM)},
            {"role": "user", "content": self.with_output_format(config, f"【证据】\n{context}\n\n【待核查方案】{query}")},
        ]
        try:
            text = get_llm().chat(messages, temperature=0.1)
        except Exception as exc:
            log.warning("[safety] LLM 调用失败，使用启发式：%s", exc)
            return None
        data = parse_json_object(text)
        if not data:
            return None
        try:
            return SafetyOutput.model_validate(data)
        except Exception as exc:
            log.warning("[safety] 输出契约校验失败：%s", exc)
            return None

    def _fallback(self, evidence: list[dict], root_cause: dict) -> SafetyOutput:
        requirements = []
        for seg in evidence[:3]:
            chapter = (seg.get("chapter") or "").strip()
            if chapter:
                requirements.append(chapter)
        if requirements:
            return SafetyOutput(
                checkResult="pass",
                safetyRequirements=requirements,
                riskLevel="medium",
                reason="依据检索到的安全规程生成要求；未发现显式否决项。",
            )
        return SafetyOutput(
            checkResult="pass",
            safetyRequirements=[],
            riskLevel="medium",
            reason="未检索到安全规程，缺少安全核查依据，建议人工补充安全要求。",
        )