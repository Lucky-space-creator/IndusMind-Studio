from __future__ import annotations

from app.agents.common import build_citations
from app.agents.multi.contracts import ConfirmedAnomaly, MonitorOutput
from app.agents.multi.nodes.base import AgentNode, NodeResult
from app.agents.prompts import MONITOR_SUMMARY_SYSTEM
from app.core.logging import get_logger
from app.core.providers import get_llm

log = get_logger(__name__)


class MonitorNode(AgentNode):
    code = "monitor"
    name = "设备监测"

    def run(self, state: dict) -> NodeResult:
        anomalies = state.get("anomalies") or []
        rank = 0
        confirmed: list[ConfirmedAnomaly] = []
        for anomaly in anomalies:
            rank = max(rank, self.severity_rank(getattr(anomaly, "severity", None)))
            confirmed.append(
                ConfirmedAnomaly(
                    metricId=getattr(anomaly, "metric_id", None),
                    metricName=getattr(anomaly, "metric_name", None),
                    anomalyType=getattr(anomaly, "anomaly_type", None),
                    severity=getattr(anomaly, "severity", None),
                    summary=getattr(anomaly, "summary", None),
                )
            )
        device_status = "abnormal" if confirmed else "normal"
        severity = self.rank_severity(rank) if confirmed else "low"
        output = MonitorOutput(
            deviceStatus=device_status,
            severity=severity,
            confirmedAnomalies=confirmed,
            summary=self._summarize(state, confirmed, severity),
        )
        summary = f"确认异常 {len(confirmed)} 项，严重度 {severity}"
        return NodeResult(
            output=output.model_dump(by_alias=True),
            summary=summary,
            citations=build_citations([]),
        )

    def _summarize(self, state: dict, confirmed: list[ConfirmedAnomaly], severity: str) -> str:
        if not confirmed:
            return "设备各项指标在阈值范围内，未发现异常。"
        labels = [
            item.metric_name or (str(item.metric_id) if item.metric_id is not None else None)
            for item in confirmed
        ]
        names = "、".join([label for label in labels if label])
        deterministic = f"设备存在异常，涉及指标：{names or '未知'}，严重度 {severity}。"
        try:
            config = (state.get("configs") or {}).get(self.code)
            device = state.get("request").device_name if state.get("request") else None
            messages = [
                {"role": "system", "content": self.compose_system_prompt(config, MONITOR_SUMMARY_SYSTEM)},
                {
                    "role": "user",
                    "content": self.with_output_format(
                        config, f"设备：{device or '未知'}；异常：{deterministic}"
                    ),
                },
            ]
            text = get_llm().chat(messages, temperature=0.1)
            if not text:
                return deterministic
            import json as _json
            try:
                parsed = _json.loads(text.strip())
                if isinstance(parsed, dict) and isinstance(parsed.get("summary"), str):
                    return parsed["summary"]
            except (ValueError, TypeError):
                pass
            return text.strip()
        except Exception as exc:
            log.warning("[monitor] 摘要生成失败，使用规则摘要：%s", exc)
            return deterministic