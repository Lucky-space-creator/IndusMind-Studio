from __future__ import annotations

from app.agents.common import parse_json_object
from app.agents.multi.contracts import SpareCostOutput
from app.agents.multi.nodes.base import AgentNode, NodeResult
from app.core.logging import get_logger
from app.core.providers import get_llm

log = get_logger(__name__)

_SYSTEM = (
    "你是备件成本评估 Agent。依据根因结论，提出候选备件与成本等级。"
    "只输出 JSON：{\"spareParts\":[{\"partName\":\"\",\"partModel\":\"\",\"quantity\":1}],"
    "\"downtimeLoss\":0,\"costLevel\":\"low|medium|high\",\"summary\":\"\"}。"
    "禁止判断根因、禁止给出安全操作要求；库存与单价以调用方主数据为准。"
)


class SpareCostNode(AgentNode):
    code = "spare_cost"
    name = "备件成本"

    def run(self, state: dict) -> NodeResult:
        config = (state.get("configs") or {}).get(self.code)
        root_cause = (state.get("agent_outputs") or {}).get("root_cause") or {}
        top_cause = root_cause.get("topCause") or ""
        severity = ((state.get("agent_outputs") or {}).get("monitor") or {}).get("severity") or "low"

        output = self._from_llm(top_cause, severity, config)
        if output is None:
            output = SpareCostOutput(
                spareParts=[],
                downtimeLoss=None,
                costLevel=severity if severity in {"low", "medium", "high"} else "low",
                summary="未接入备件主数据与停机损失数据，暂不给出备件清单与损耗金额，需由调用方结合主数据确认。",
            )
        summary = output.summary or "候选备件成本评估完成"
        return NodeResult(output=output.model_dump(by_alias=True), summary=summary, status="success" if output.spare_parts else "degraded")

    def _from_llm(self, top_cause: str, severity: str, config=None) -> SpareCostOutput | None:
        if not top_cause:
            return None
        messages = [
            {"role": "system", "content": self.compose_system_prompt(config, _SYSTEM)},
            {"role": "user", "content": self.with_output_format(config, f"根因：{top_cause}；严重度：{severity}")},
        ]
        try:
            text = get_llm().chat(messages, temperature=0.2)
        except Exception as exc:
            log.warning("[spare_cost] LLM 调用失败，输出降级：%s", exc)
            return None
        data = parse_json_object(text)
        if not data:
            return None
        try:
            return SpareCostOutput.model_validate(data)
        except Exception as exc:
            log.warning("[spare_cost] 输出契约校验失败：%s", exc)
            return None