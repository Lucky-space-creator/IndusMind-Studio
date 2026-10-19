# -*- coding: utf-8 -*-
"""app/agents/multi/graph.py 动态建图单元测试。

覆盖：
- build_diagnosis_graph(active_codes) 按流程节点集合裁剪建图
- LangGraph 路径与内置顺序编排（_invoke_sequential）执行等价性
"""
import sys
import pathlib
import unittest
from contextlib import ExitStack
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "code" / "ai-service"))

from app.agents.multi import orchestrator  # noqa: E402
from app.agents.multi.graph import build_diagnosis_graph  # noqa: E402
from app.agents.multi.orchestrator import AGENT_ORDER  # noqa: E402
from app.agents.multi.nodes.base import NodeResult  # noqa: E402
from app.models.diagnosis import DiagnosisRunRequest  # noqa: E402

try:
    build_diagnosis_graph()
    LANGGRAPH_AVAILABLE = True
except Exception:  # pragma: no cover - 环境无 langgraph 时跳过
    LANGGRAPH_AVAILABLE = False

_DOMAIN_NODES = {"monitor", "root_cause", "spare_cost", "safety", "work_order"}
_INTERNAL_NODES = {"arbitrate", "finalize"}


def _node_names(compiled):
    """compiled.nodes 含 __start__ 伪节点，需过滤。"""
    return set(compiled.nodes.keys()) - {"__start__"}


@unittest.skipUnless(LANGGRAPH_AVAILABLE, "langgraph 不可用")
class TestBuildDiagnosisGraph(unittest.TestCase):
    """动态建图拓扑。"""

    def test_default_full_graph(self):
        """无参调用 → 全量节点 + 内部节点（兼容旧行为）。"""
        compiled = build_diagnosis_graph()
        self.assertEqual(_node_names(compiled), _DOMAIN_NODES | _INTERNAL_NODES)

    def test_none_active_codes_equals_full(self):
        """active_codes=None → 全量。"""
        compiled = build_diagnosis_graph(None)
        self.assertEqual(_node_names(compiled), _DOMAIN_NODES | _INTERNAL_NODES)

    def test_pruned_graph(self):
        """裁剪：仅 monitor/root_cause/work_order → 对应节点 + 内部节点。"""
        compiled = build_diagnosis_graph(["monitor", "root_cause", "work_order"])
        self.assertEqual(
            _node_names(compiled),
            {"monitor", "root_cause", "work_order"} | _INTERNAL_NODES,
        )

    def test_empty_active_codes_keeps_internal_only(self):
        """active_codes=[] → 不回退全量，仅内部节点。"""
        compiled = build_diagnosis_graph([])
        self.assertEqual(_node_names(compiled), _INTERNAL_NODES)

    def test_unknown_codes_ignored(self):
        """未知 code 被忽略。"""
        compiled = build_diagnosis_graph(["monitor", "hacker_node"])
        self.assertEqual(_node_names(compiled), {"monitor"} | _INTERNAL_NODES)

    def test_only_work_order_graph(self):
        """仅 work_order → arbitrate→work_order→finalize 链。"""
        compiled = build_diagnosis_graph(["work_order"])
        self.assertEqual(_node_names(compiled), {"work_order"} | _INTERNAL_NODES)

    def test_no_root_cause_parallel_entry(self):
        """缺 root_cause 时并行段仍可从 monitor 进入。"""
        compiled = build_diagnosis_graph(["monitor", "spare_cost", "safety"])
        self.assertEqual(
            _node_names(compiled),
            {"monitor", "spare_cost", "safety"} | _INTERNAL_NODES,
        )


@unittest.skipUnless(LANGGRAPH_AVAILABLE, "langgraph 不可用")
class TestGraphExecution(unittest.TestCase):
    """LangGraph 执行路径行为（mock 节点输出）。"""

    _OUTPUTS = {
        "monitor": {"deviceStatus": "abnormal", "severity": "high", "confirmedAnomalies": [], "summary": "监测异常"},
        "root_cause": {"rootCauses": [], "topCause": "轴承磨损", "confidence": 0.9, "summary": "根因定位"},
        "spare_cost": {"spareParts": [{"partName": "轴承"}], "downtimeLoss": 500, "costLevel": "high", "summary": "成本评估"},
        "safety": {"checkResult": "pass", "safetyRequirements": ["断电挂牌"], "riskLevel": "low", "reason": "核查通过"},
        "work_order": {"orderTitle": "维修工单", "priority": "high", "steps": ["停机"], "spareParts": ["轴承"], "safetyNotes": ["断电挂牌"]},
    }

    def _run_diagnosis(self, agent_codes=None, monitor_output=None):
        outputs = dict(self._OUTPUTS)
        if monitor_output is not None:
            outputs["monitor"] = monitor_output
        request = DiagnosisRunRequest(
            deviceId=1,
            deviceName="数控机床",
            anomalies=[{"metricId": 1, "severity": "high"}],
            phenomenon="主轴异响",
            agents=[{"agentCode": code} for code in (agent_codes or [])],
        )
        with ExitStack() as stack:
            for code in AGENT_ORDER:
                result = NodeResult(output=outputs[code], summary=code, status="success")
                stack.enter_context(
                    patch.object(orchestrator._NODES[code], "run", return_value=result)
                )
            response = orchestrator.run_diagnosis(request, "trace-graph")
        return response

    def test_full_flow_via_langgraph(self):
        """全量流程经 LangGraph 执行 → 五步骤 + 高风险 + 工单结论。"""
        response = self._run_diagnosis()
        self.assertEqual(
            [s.agent_code for s in response.steps], list(AGENT_ORDER)
        )
        self.assertTrue(all(s.status == "success" for s in response.steps))
        self.assertEqual(response.risk_level, "high")
        self.assertIn("维修工单", response.conclusion)

    def test_monitor_normal_short_circuit_via_langgraph(self):
        """monitor 正常 → 提前终结，仅 monitor 步骤。"""
        response = self._run_diagnosis(
            monitor_output={"deviceStatus": "normal", "severity": "low", "confirmedAnomalies": [], "summary": "正常"}
        )
        self.assertEqual([s.agent_code for s in response.steps], ["monitor"])
        self.assertIn("设备状态正常", response.conclusion)

    def test_pruned_flow_via_langgraph(self):
        """裁剪流程（无 spare_cost/safety）→ 步骤不含被删节点。"""
        response = self._run_diagnosis(agent_codes=["monitor", "root_cause", "work_order"])
        self.assertEqual(
            [s.agent_code for s in response.steps],
            ["monitor", "root_cause", "work_order"],
        )
        self.assertEqual(response.risk_level, "high")

    def test_langgraph_equals_sequential(self):
        """LangGraph 与内置顺序编排结果等价（步骤/状态/风险/结论）。"""
        def projection(resp):
            return (
                [(s.agent_code, s.status) for s in resp.steps],
                resp.risk_level,
                resp.conclusion,
            )


        outputs = dict(self._OUTPUTS)

        def run_once(force_sequential):
            request = DiagnosisRunRequest(
                deviceId=1,
                deviceName="数控机床",
                anomalies=[{"metricId": 1, "severity": "high"}],
                phenomenon="主轴异响",
            )
            with ExitStack() as stack:
                if force_sequential:
                    stack.enter_context(
                        patch.object(orchestrator, "_invoke_langgraph", return_value=None)
                    )
                for code in AGENT_ORDER:
                    result = NodeResult(output=outputs[code], summary=code, status="success")
                    stack.enter_context(
                        patch.object(orchestrator._NODES[code], "run", return_value=result)
                    )
                return orchestrator.run_diagnosis(request, "trace-equiv")

        self.assertEqual(projection(run_once(False)), projection(run_once(True)))


    def test_langgraph_equals_sequential_pruned(self):
        """裁剪流程下两条路径同样等价。"""
        def projection(resp):
            return [(s.agent_code, s.status) for s in resp.steps], resp.risk_level

        outputs = dict(self._OUTPUTS)

        def run_once(force_sequential):
            request = DiagnosisRunRequest(
                deviceId=1,
                deviceName="数控机床",
                anomalies=[{"metricId": 1, "severity": "high"}],
                agents=[{"agentCode": "monitor"}, {"agentCode": "root_cause"}, {"agentCode": "work_order"}],
            )
            with ExitStack() as stack:
                if force_sequential:
                    stack.enter_context(
                        patch.object(orchestrator, "_invoke_langgraph", return_value=None)
                    )
                for code in AGENT_ORDER:
                    result = NodeResult(output=outputs[code], summary=code, status="success")
                    stack.enter_context(
                        patch.object(orchestrator._NODES[code], "run", return_value=result)
                    )
                return orchestrator.run_diagnosis(request, "trace-equiv2")

        self.assertEqual(projection(run_once(False)), projection(run_once(True)))


if __name__ == "__main__":
    unittest.main()