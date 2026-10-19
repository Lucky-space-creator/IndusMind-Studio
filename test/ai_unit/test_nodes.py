# -*- coding: utf-8 -*-
"""app/agents/multi/nodes/ 节点降级逻辑单元测试。

patch 目标依据各节点源码 import：
- monitor.py: from app.core.providers import get_llm → patch app.agents.multi.nodes.monitor.get_llm
- work_order.py 同理
"""
import sys
import pathlib
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "code" / "ai-service"))

from app.agents.multi.nodes.base import AgentNode  # noqa: E402
from app.agents.multi.nodes.monitor import MonitorNode  # noqa: E402
from app.agents.multi.nodes.root_cause import RootCauseNode  # noqa: E402
from app.agents.multi.nodes.safety import SafetyNode  # noqa: E402
from app.agents.multi.nodes.spare_cost import SpareCostNode  # noqa: E402
from app.agents.multi.nodes.work_order import WorkOrderNode  # noqa: E402
from app.models.diagnosis import AgentConfig  # noqa: E402


def _anomaly(severity, name="指标A", metric_id=1):
    return SimpleNamespace(
        metric_id=metric_id,
        metric_name=name,
        anomaly_type="spike",
        severity=severity,
        summary="超限",
    )


class TestSeverityRank(unittest.TestCase):
    """base.severity_rank / rank_severity 双向映射。"""

    def test_severity_rank_known_levels(self):
        """low=1 / medium=2 / high=3。"""
        self.assertEqual(AgentNode.severity_rank("low"), 1)
        self.assertEqual(AgentNode.severity_rank("medium"), 2)
        self.assertEqual(AgentNode.severity_rank("high"), 3)

    def test_severity_rank_none_zero(self):
        """None → 0。"""
        self.assertEqual(AgentNode.severity_rank(None), 0)

    def test_severity_rank_unknown_zero(self):
        """乱串 → 0。"""
        self.assertEqual(AgentNode.severity_rank("critical"), 0)
        self.assertEqual(AgentNode.severity_rank(""), 0)

    def test_severity_rank_case_insensitive(self):
        """大小写不敏感。"""
        self.assertEqual(AgentNode.severity_rank("HIGH"), 3)
        self.assertEqual(AgentNode.severity_rank("Medium"), 2)

    def test_rank_severity_reverse(self):
        """rank_severity 反向映射：1→low、2→medium、3→high。"""
        self.assertEqual(AgentNode.rank_severity(1), "low")
        self.assertEqual(AgentNode.rank_severity(2), "medium")
        self.assertEqual(AgentNode.rank_severity(3), "high")

    def test_rank_severity_out_of_range_low(self):
        """越界 rank（0/99）→ low。"""
        self.assertEqual(AgentNode.rank_severity(0), "low")
        self.assertEqual(AgentNode.rank_severity(99), "low")


class TestMonitorNode(unittest.TestCase):
    """MonitorNode.run 规则路径与 LLM 降级。"""

    def test_monitor_empty_anomalies_normal(self):
        """空异常列表 → deviceStatus=normal、severity=low。"""
        result = MonitorNode().run({"anomalies": []})
        self.assertEqual(result.output["deviceStatus"], "normal")
        self.assertEqual(result.output["severity"], "low")
        self.assertEqual(result.output["confirmedAnomalies"], [])
        self.assertEqual(result.summary, "确认异常 0 项，严重度 low")
        self.assertEqual(result.status, "success")

    def test_monitor_empty_anomalies_summary_text(self):
        """空异常摘要为固定文案（不调 LLM）。"""
        with patch(
            "app.agents.multi.nodes.monitor.get_llm", side_effect=AssertionError("不应调用 LLM")
        ):
            result = MonitorNode().run({"anomalies": []})
        self.assertEqual(result.output["summary"], "设备各项指标在阈值范围内，未发现异常。")

    def test_monitor_abnormal_status(self):
        """有异常 → deviceStatus=abnormal。"""
        llm = MagicMock()
        llm.chat.return_value = "摘要"
        with patch("app.agents.multi.nodes.monitor.get_llm", return_value=llm):
            result = MonitorNode().run({"anomalies": [_anomaly("medium")]})
        self.assertEqual(result.output["deviceStatus"], "abnormal")

    def test_monitor_severity_takes_max(self):
        """多异常 severity 取最大等级。"""
        llm = MagicMock()
        llm.chat.return_value = "摘要"
        with patch("app.agents.multi.nodes.monitor.get_llm", return_value=llm):
            result = MonitorNode().run(
                {"anomalies": [_anomaly("low", "A"), _anomaly("high", "B"), _anomaly("medium", "C")]}
            )
        self.assertEqual(result.output["severity"], "high")
        self.assertEqual(len(result.output["confirmedAnomalies"]), 3)

    def test_monitor_llm_failure_falls_back_rule_summary(self):
        """LLM 摘要失败降级为规则文案。"""
        llm = MagicMock()
        llm.chat.side_effect = RuntimeError("llm down")
        with patch("app.agents.multi.nodes.monitor.get_llm", return_value=llm):
            result = MonitorNode().run({"anomalies": [_anomaly("high", "温度")], "request": None})
        summary = result.output["summary"]
        self.assertIn("设备存在异常", summary)
        self.assertIn("温度", summary)
        self.assertIn("严重度 high", summary)

    def test_monitor_llm_success_uses_llm_text(self):
        """LLM 正常返回时采用 LLM 文案。"""
        llm = MagicMock()
        llm.chat.return_value = "LLM 摘要内容"
        with patch("app.agents.multi.nodes.monitor.get_llm", return_value=llm):
            result = MonitorNode().run({"anomalies": [_anomaly("high")], "request": None})
        self.assertEqual(result.output["summary"], "LLM 摘要内容")


class TestWorkOrderFallback(unittest.TestCase):
    """WorkOrderNode._fallback 规则兜底。"""

    def _fallback(self, *, request, outputs):
        return WorkOrderNode()._fallback({"request": request}, outputs)

    def test_fallback_device_name_chain_with_id(self):
        """设备名缺省链：device_name 缺 → 设备{device_id}。"""
        output = self._fallback(
            request=SimpleNamespace(device_name=None, device_id=7), outputs={}
        )
        self.assertEqual(output.order_title, "设备7维修工单")

    def test_fallback_device_name_fully_missing(self):
        """设备名与设备 id 均缺 → “设备”。"""
        output = self._fallback(
            request=SimpleNamespace(device_name=None, device_id=None), outputs={}
        )
        self.assertEqual(output.order_title, "设备维修工单")

    def test_fallback_device_name_present(self):
        """device_name 优先。"""
        output = self._fallback(
            request=SimpleNamespace(device_name="离心泵", device_id=7), outputs={}
        )
        self.assertEqual(output.order_title, "离心泵维修工单")

    def test_fallback_priority_high_by_severity(self):
        """monitor.severity=high → priority=high。"""
        output = self._fallback(
            request=SimpleNamespace(device_name="x"),
            outputs={"monitor": {"severity": "high"}},
        )
        self.assertEqual(output.priority, "high")

    def test_fallback_priority_high_by_risk_level(self):
        """safety.riskLevel=high → priority=high。"""
        output = self._fallback(
            request=SimpleNamespace(device_name="x"),
            outputs={"safety": {"riskLevel": "high"}},
        )
        self.assertEqual(output.priority, "high")

    def test_fallback_priority_low(self):
        """severity=low → priority=low。"""
        output = self._fallback(
            request=SimpleNamespace(device_name="x"),
            outputs={"monitor": {"severity": "low"}},
        )
        self.assertEqual(output.priority, "low")

    def test_fallback_priority_medium_default(self):
        """其余情况 → medium。"""
        output = self._fallback(
            request=SimpleNamespace(device_name="x"),
            outputs={"monitor": {"severity": "medium"}},
        )
        self.assertEqual(output.priority, "medium")

    def test_fallback_spare_part_name_compat(self):
        """备件名 partName / part_name 兼容。"""
        output = self._fallback(
            request=SimpleNamespace(device_name="x"),
            outputs={
                "spare_cost": {
                    "spareParts": [
                        {"partName": "密封圈"},
                        {"part_name": "轴承"},
                        {"quantity": 1},
                    ]
                }
            },
        )
        self.assertEqual(output.spare_parts, ["密封圈", "轴承"])

    def test_fallback_steps_include_root_cause(self):
        """steps 包含根因处理步骤。"""
        output = self._fallback(
            request=SimpleNamespace(device_name="x"),
            outputs={"root_cause": {"topCause": "密封老化"}},
        )
        self.assertTrue(any("密封老化" in step for step in output.steps))
        self.assertTrue(any("挂牌上锁" in step for step in output.steps))

    def test_fallback_safety_notes_passthrough(self):
        """安全要求透传为 safetyNotes。"""
        output = self._fallback(
            request=SimpleNamespace(device_name="x"),
            outputs={"safety": {"safetyRequirements": ["断电操作"]}},
        )
        self.assertEqual(output.safety_notes, ["断电操作"])


class TestSafetyFallback(unittest.TestCase):
    """SafetyNode._fallback 无证据降级。"""

    def test_fallback_no_evidence_pass_medium(self):
        """无证据 → checkResult=pass、riskLevel=medium、建议人工补充。"""
        output = SafetyNode()._fallback([], {})
        self.assertEqual(output.check_result, "pass")
        self.assertEqual(output.risk_level, "medium")
        self.assertIn("建议人工补充", output.reason)
        self.assertEqual(output.safety_requirements, [])

    def test_fallback_with_chapter_requirements(self):
        """有证据时 chapter 作为安全要求。"""
        evidence = [
            {"segment_id": 1, "chapter": "第三章 断电", "content": "c"},
            {"segment_id": 2, "chapter": "  ", "content": "c"},
            {"segment_id": 3, "chapter": "第四章 通风", "content": "c"},
            {"segment_id": 4, "chapter": "第五章", "content": "c"},  # 超过前 3 条
        ]
        output = SafetyNode()._fallback(evidence, {})
        self.assertEqual(output.safety_requirements, ["第三章 断电", "第四章 通风"])
        self.assertEqual(output.check_result, "pass")
        self.assertEqual(output.risk_level, "medium")


class TestSpareCostNode(unittest.TestCase):
    """SpareCostNode.run 无根因降级。"""

    def test_run_no_top_cause_degrades(self):
        """无 topCause → 空备件列表 + 固定降级文案 + status=degraded。"""
        result = SpareCostNode().run({"agent_outputs": {}})
        self.assertEqual(result.output["spareParts"], [])
        self.assertIsNone(result.output["downtimeLoss"])
        self.assertIn("未接入备件主数据", result.output["summary"])
        self.assertEqual(result.status, "degraded")

    def test_run_severity_maps_cost_level(self):
        """monitor.severity 映射 costLevel。"""
        result = SpareCostNode().run(
            {"agent_outputs": {"monitor": {"severity": "high"}}}
        )
        self.assertEqual(result.output["costLevel"], "high")

    def test_run_invalid_severity_defaults_low(self):
        """非法 severity → costLevel=low。"""
        result = SpareCostNode().run(
            {"agent_outputs": {"monitor": {"severity": "extreme"}}}
        )
        self.assertEqual(result.output["costLevel"], "low")


_EVIDENCE = [
    {"segment_id": 1, "doc_id": 1, "content": "轴承磨损导致主轴异响", "chapter": "第二章 主轴故障", "page_no": 3, "score": 0.9},
]


class TestPromptComposition(unittest.TestCase):
    """节点消费流程节点配置（instruction/boundary/output_format）。"""

    def test_compose_system_prompt_none_config(self):
        """config 为 None → 原样返回 base。"""
        node = MonitorNode()
        self.assertEqual(node.compose_system_prompt(None, "BASE"), "BASE")

    def test_compose_system_prompt_full(self):
        """instruction 前缀 + base + boundary 后缀。"""
        node = MonitorNode()
        config = SimpleNamespace(instruction="定制指令", boundary="不得越界")
        text = node.compose_system_prompt(config, "BASE")
        self.assertTrue(text.startswith("定制指令"))
        self.assertIn("BASE", text)
        self.assertTrue(text.endswith("边界约束：不得越界"))

    def test_compose_system_prompt_blank_fields(self):
        """instruction/boundary 空白 → 等价于无配置。"""
        node = MonitorNode()
        config = SimpleNamespace(instruction="  ", boundary="")
        self.assertEqual(node.compose_system_prompt(config, "BASE"), "BASE")

    def test_with_output_format_none(self):
        """config 为 None → user 内容原样返回。"""
        node = MonitorNode()
        self.assertEqual(node.with_output_format(None, "CONTENT"), "CONTENT")

    def test_with_output_format_blank(self):
        """output_format 空白 → 原样返回。"""
        node = MonitorNode()
        config = SimpleNamespace(output_format="  ")
        self.assertEqual(node.with_output_format(config, "CONTENT"), "CONTENT")

    def test_with_output_format_appends(self):
        """output_format 追加格式化要求。"""
        node = MonitorNode()
        config = SimpleNamespace(output_format="输出 JSON")
        text = node.with_output_format(config, "CONTENT")
        self.assertTrue(text.startswith("CONTENT"))
        self.assertIn("请按以下格式组织输出：输出 JSON", text)

    def test_root_cause_prompt_consumes_config(self):
        """root_cause LLM 消息拼入 instruction/boundary/output_format。"""
        node = RootCauseNode()
        llm = MagicMock()
        llm.chat.return_value = '{"rootCauses": [], "topCause": "轴承磨损", "confidence": 0.9, "summary": "s"}'
        config = AgentConfig(
            agentCode="root_cause", instruction="聚焦机械故障", boundary="只依据证据", outputFormat="输出 JSON"
        )
        state = {"request": None, "anomalies": [], "configs": {"root_cause": config}}
        with patch.object(node, "retrieve", return_value=_EVIDENCE), patch(
            "app.agents.multi.nodes.root_cause.get_llm", return_value=llm
        ):
            node.run(state)
        messages = llm.chat.call_args[0][0]
        system, user = messages[0]["content"], messages[1]["content"]
        self.assertTrue(system.startswith("聚焦机械故障"))
        self.assertIn("边界约束：只依据证据", system)
        self.assertIn("请按以下格式组织输出：输出 JSON", user)

    def test_root_cause_prompt_without_config_keeps_base(self):
        """无配置 → system 即原常量，user 不追加格式要求。"""
        node = RootCauseNode()
        llm = MagicMock()
        llm.chat.return_value = '{"rootCauses": [], "topCause": "轴承磨损", "confidence": 0.9, "summary": "s"}'
        state = {"request": None, "anomalies": [], "configs": {}}
        with patch.object(node, "retrieve", return_value=_EVIDENCE), patch(
            "app.agents.multi.nodes.root_cause.get_llm", return_value=llm
        ):
            node.run(state)
        messages = llm.chat.call_args[0][0]
        from app.agents.prompts import ROOT_CAUSE_SYSTEM

        self.assertEqual(messages[0]["content"], ROOT_CAUSE_SYSTEM)
        self.assertNotIn("请按以下格式组织输出", messages[1]["content"])

    def test_safety_prompt_consumes_config(self):
        """safety LLM 消息拼入配置。"""
        node = SafetyNode()
        llm = MagicMock()
        llm.chat.return_value = '{"checkResult": "pass", "safetyRequirements": [], "riskLevel": "low", "reason": "ok"}'
        config = AgentConfig(agentCode="safety", instruction="严守安全规程", boundary="不做根因判断", outputFormat="JSON")
        state = {
            "request": None,
            "configs": {"safety": config},
            "agent_outputs": {"root_cause": {"topCause": "轴承磨损"}},
        }
        with patch.object(node, "retrieve", return_value=_EVIDENCE), patch(
            "app.agents.multi.nodes.safety.get_llm", return_value=llm
        ):
            node.run(state)
        messages = llm.chat.call_args[0][0]
        self.assertTrue(messages[0]["content"].startswith("严守安全规程"))
        self.assertIn("边界约束：不做根因判断", messages[0]["content"])
        self.assertIn("请按以下格式组织输出：JSON", messages[1]["content"])


if __name__ == "__main__":
    unittest.main()