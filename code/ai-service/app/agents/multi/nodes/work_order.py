from __future__ import annotations

from app.agents.common import format_evidence, parse_json_object
from app.agents.multi.contracts import WorkOrderOutput
from app.agents.multi.nodes.base import AgentNode, NodeResult
from app.agents.prompts import WORK_ORDER_SYSTEM
from app.core.logging import get_logger
from app.core.providers import get_llm

log = get_logger(__name__)


class WorkOrderNode(AgentNode):
    code = "work_order"
    name = "工单"

    def run(self, state: dict) -> NodeResult:
        config = (state.get("configs") or {}).get(self.code)
        outputs = state.get("agent_outputs") or {}
        context = format_evidence(
            [
                {"segment_id": "monitor", "content": str(outputs.get("monitor") or {})},
                {"segment_id": "root_cause", "content": str(outputs.get("root_cause") or {})},
                {"segment_id": "spare_cost", "content": str(outputs.get("spare_cost") or {})},
                {"segment_id": "safety", "content": str(outputs.get("safety") or {})},
            ]
        )
        output = self._from_llm(context, config)
        if output is None:
            output = self._fallback(state, outputs)
        summary = f"生成工单：{output.order_title or '维修工单'}，优先级 {output.priority}"
        citations = list(state.get("citations") or [])
        return NodeResult(output=output.model_dump(by_alias=True), summary=summary, citations=citations)

    def _from_llm(self, context: str, config=None) -> WorkOrderOutput | None:
        messages = [
            {"role": "system", "content": self.compose_system_prompt(config, WORK_ORDER_SYSTEM)},
            {"role": "user", "content": self.with_output_format(config, f"【上游结论】\n{context}\n\n请汇总为结构化工单。")},
        ]
        try:
            text = get_llm().chat(messages, temperature=0.2)
        except Exception as exc:
            log.warning("[work_order] LLM 调用失败，使用规则汇总：%s", exc)
            return None
        data = parse_json_object(text)
        if not data:
            return None
        try:
            return WorkOrderOutput.model_validate(data)
        except Exception as exc:
            log.warning("[work_order] 输出契约校验失败：%s", exc)
            return None

    def _fallback(self, state: dict, outputs: dict) -> WorkOrderOutput:
        request = state.get("request")
        device = getattr(request, "device_name", None)
        if not device:
            device_id = getattr(request, "device_id", None)
            device = f"设备{device_id}" if device_id is not None else "设备"
        root_cause = outputs.get("root_cause") or {}
        spare_cost = outputs.get("spare_cost") or {}
        safety = outputs.get("safety") or {}
        monitor = outputs.get("monitor") or {}

        steps: list[str] = ["停机并挂牌上锁，确认设备处于安全状态"]
        top_cause = root_cause.get("topCause")
        if top_cause:
            steps.append(f"针对根因「{top_cause}」进行排查与处理")
        for item in root_cause.get("rootCauses") or []:
            cause = item.get("cause") if isinstance(item, dict) else None
            if cause and (not top_cause or cause != top_cause):
                steps.append(f"复核候选根因：{cause}")
        steps.append("维修完成后试运行并确认指标恢复正常")

        spare_parts = [
            item.get("partName") or item.get("part_name")
            for item in (spare_cost.get("spareParts") or [])
            if isinstance(item, dict) and (item.get("partName") or item.get("part_name"))
        ]
        safety_notes = [str(req) for req in (safety.get("safetyRequirements") or [])]

        priority = "medium"
        severity = monitor.get("severity")
        if severity == "high" or safety.get("riskLevel") == "high":
            priority = "high"
        elif severity == "low":
            priority = "low"
        return WorkOrderOutput(
            orderTitle=f"{device}维修工单",
            priority=priority,
            steps=steps,
            spareParts=spare_parts,
            safetyNotes=safety_notes,
        )