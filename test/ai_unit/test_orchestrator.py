# -*- coding: utf-8 -*-
"""app/agents/multi/orchestrator.py 编排逻辑单元测试。

_NODES 为模块级实例字典，mock 单个节点用
patch.object(orchestrator._NODES[code], "run", ...)（实例属性，退出自动恢复）。
"""
import sys
import pathlib
import time
import unittest
from contextlib import ExitStack
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "code" / "ai-service"))

from app.agents.multi import orchestrator  # noqa: E402
from app.agents.multi.orchestrator import (  # noqa: E402
    AGENT_ORDER,
    _apply,
    _build_conclusion,
    _dedup_citations,
    _invoke_sequential,
    _order_steps,
    _rank,
    _rank_to_level,
    _run_agent_node,
    active_codes_of,
    initial_state,
    route_after_monitor,
    step_arbitrate,
    step_work_order,
)
from app.core.errors import AiServiceError, ErrorCode  # noqa: E402
from app.models.common import Citation  # noqa: E402
from app.models.diagnosis import AgentConfig, DiagnosisRunRequest  # noqa: E402
from app.agents.multi.nodes.base import NodeResult  # noqa: E402


class TestRankMapping(unittest.TestCase):
    """_rank / _rank_to_level 双向映射。"""

    def test_rank_known_levels(self):
        """low=1 / medium=2 / high=3。"""
        self.assertEqual(_rank("low"), 1)
        self.assertEqual(_rank("medium"), 2)
        self.assertEqual(_rank("high"), 3)

    def test_rank_none_and_unknown_zero(self):
        """None 与乱串 → 0；大小写不敏感。"""
        self.assertEqual(_rank(None), 0)
        self.assertEqual(_rank("garbage"), 0)
        self.assertEqual(_rank("HIGH"), 3)

    def test_rank_to_level_mapping(self):
        """rank → level：0/1→low、2→medium、3→high、越界→low。"""
        self.assertEqual(_rank_to_level(0), "low")
        self.assertEqual(_rank_to_level(1), "low")
        self.assertEqual(_rank_to_level(2), "medium")
        self.assertEqual(_rank_to_level(3), "high")
        self.assertEqual(_rank_to_level(9), "low")

    def test_round_trip(self):
        """round-trip：level→rank→level 保持不变。"""
        for level in ("low", "medium", "high"):
            self.assertEqual(_rank_to_level(_rank(level)), level)


class TestRouteAfterMonitor(unittest.TestCase):
    """route_after_monitor 路由决策。"""

    def test_route_abnormal_continue(self):
        """monitor_status=abnormal → continue。"""
        self.assertEqual(route_after_monitor({"monitor_status": "abnormal"}), "continue")

    def test_route_normal_end(self):
        """monitor_status=normal → end。"""
        self.assertEqual(route_after_monitor({"monitor_status": "normal"}), "end")

    def test_route_missing_status_end(self):
        """缺失 monitor_status → end。"""
        self.assertEqual(route_after_monitor({}), "end")


class TestStepArbitrate(unittest.TestCase):
    """step_arbitrate 安全仲裁。"""

    def test_arbitrate_safety_fail_blocks_work_order(self):
        """safety.checkResult=fail → work_order_allowed=False。"""
        state = {
            "agent_outputs": {
                "monitor": {"severity": "low"},
                "safety": {"checkResult": "fail", "riskLevel": "low"},
            }
        }
        update = step_arbitrate(state)
        self.assertFalse(update["work_order_allowed"])

    def test_arbitrate_safety_fail_high_risk(self):
        """fail + riskLevel=high → 风险 high。"""
        state = {
            "agent_outputs": {
                "monitor": {"severity": "medium"},
                "safety": {"checkResult": "fail", "riskLevel": "high"},
            }
        }
        update = step_arbitrate(state)
        self.assertFalse(update["work_order_allowed"])
        self.assertEqual(update["risk_level"], "high")

    def test_arbitrate_risk_is_max_of_monitor_and_safety(self):
        """risk = max(monitor.severity, safety.riskLevel) 排名。"""
        state = {
            "agent_outputs": {
                "monitor": {"severity": "medium"},
                "safety": {"checkResult": "pass", "riskLevel": "high"},
            }
        }
        update = step_arbitrate(state)
        self.assertTrue(update["work_order_allowed"])
        self.assertEqual(update["risk_level"], "high")

    def test_arbitrate_check_result_missing_defaults_pass(self):
        """checkResult 缺省按 pass 处理 → 允许工单。"""
        state = {"agent_outputs": {"monitor": {"severity": "low"}, "safety": {}}}
        update = step_arbitrate(state)
        self.assertTrue(update["work_order_allowed"])

    def test_arbitrate_cost_level_included_in_risk(self):
        """risk = max(monitor.severity, safety.riskLevel, spare_cost.costLevel)。"""
        state = {
            "agent_outputs": {
                "monitor": {"severity": "low"},
                "safety": {"checkResult": "pass", "riskLevel": "low"},
                "spare_cost": {"costLevel": "high"},
            }
        }
        update = step_arbitrate(state)
        self.assertTrue(update["work_order_allowed"])
        self.assertEqual(update["risk_level"], "high")

    def test_arbitrate_cost_level_medium_dominates(self):
        """spare_cost.costLevel=medium 为最高项 → risk=medium。"""
        state = {
            "agent_outputs": {
                "monitor": {"severity": "low"},
                "safety": {"checkResult": "pass", "riskLevel": "low"},
                "spare_cost": {"costLevel": "medium"},
            }
        }
        update = step_arbitrate(state)
        self.assertEqual(update["risk_level"], "medium")

    def test_arbitrate_empty_outputs(self):
        """空 outputs → allowed=True、risk=low。"""
        update = step_arbitrate({"agent_outputs": {}})
        self.assertTrue(update["work_order_allowed"])
        self.assertEqual(update["risk_level"], "low")


class TestStepWorkOrder(unittest.TestCase):
    """step_work_order 安全否决分支。"""

    def test_step_work_order_blocked_by_safety(self):
        """work_order_allowed=False → 步骤 skipped + 安全否决文案。"""
        update = step_work_order({"work_order_allowed": False})
        step = update["steps"][0]
        self.assertEqual(step["agentCode"], "work_order")
        self.assertEqual(step["status"], "skipped")
        self.assertIn("安全否决", step["summary"])
        self.assertIn("不予生成工单", step["summary"])
        self.assertIsNone(step["output"])

    def test_step_work_order_allowed_runs_node(self):
        """work_order_allowed=True → 正常执行节点（mock run）。"""
        node_result = NodeResult(output={"orderTitle": "t"}, summary="s", status="success")
        with patch.object(
            orchestrator._NODES["work_order"], "run", return_value=node_result
        ) as mock_run:
            update = step_work_order({"work_order_allowed": True, "agent_outputs": {}})
        mock_run.assert_called_once()
        self.assertEqual(update["steps"][0]["status"], "success")
        self.assertEqual(update["agent_outputs"]["work_order"], {"orderTitle": "t"})


class TestBuildConclusion(unittest.TestCase):
    """_build_conclusion 结论拼接。"""

    def test_conclusion_normal_device(self):
        """normal 专句。"""
        text = _build_conclusion({}, {"monitor": {"deviceStatus": "normal"}})
        self.assertEqual(text, "监测确认设备状态正常，本次无需进入根因诊断与工单流程。")

    def test_conclusion_top_cause_included(self):
        """含 topCause 分支。"""
        text = _build_conclusion(
            {"agent_outputs": {}},
            {"monitor": {"deviceStatus": "abnormal", "summary": "异常"},
             "root_cause": {"topCause": "密封老化"}},
        )
        self.assertIn("候选根因为「密封老化」", text)

    def test_conclusion_spare_parts_included(self):
        """含备件名分支。"""
        text = _build_conclusion(
            {},
            {"monitor": {"deviceStatus": "abnormal"},
             "spare_cost": {"spareParts": [{"partName": "密封圈"}, {"partName": "轴承"}]}},
        )
        self.assertIn("建议备件：密封圈、轴承", text)

    def test_conclusion_safety_fail_veto(self):
        """安全否决分支。"""
        text = _build_conclusion(
            {},
            {"monitor": {"deviceStatus": "abnormal"},
             "safety": {"checkResult": "fail"}},
        )
        self.assertIn("安全核查未通过，已否决工单生成", text)

    def test_conclusion_safety_pass(self):
        """安全通过分支。"""
        text = _build_conclusion(
            {},
            {"monitor": {"deviceStatus": "abnormal"},
             "safety": {"checkResult": "pass"}},
        )
        self.assertIn("安全核查通过", text)

    def test_conclusion_work_order_included(self):
        """工单分支。"""
        text = _build_conclusion(
            {},
            {"monitor": {"deviceStatus": "abnormal"},
             "work_order": {"orderTitle": "离心泵维修工单", "priority": "high"}},
        )
        self.assertIn("已生成工单「离心泵维修工单」", text)
        self.assertIn("优先级 high", text)

    def test_conclusion_monitor_summary_included(self):
        """monitor.summary 拼入结论。"""
        text = _build_conclusion(
            {}, {"monitor": {"deviceStatus": "abnormal", "summary": "两项指标超限"}}
        )
        self.assertTrue(text.startswith("两项指标超限"))

    def test_conclusion_all_empty(self):
        """全空（无 summary 无任何输出）→ “诊断完成。”。"""
        self.assertEqual(_build_conclusion({}, {"monitor": {"deviceStatus": "abnormal"}}), "诊断完成。")


class TestDedupCitations(unittest.TestCase):
    """_dedup_citations 去重。"""

    def test_dedup_by_doc_and_segment(self):
        """(doc_id, segment_id) 去重。"""
        items = [
            {"docId": 1, "segmentId": 2, "chapter": "a"},
            {"docId": 1, "segmentId": 2, "chapter": "b"},
            {"docId": 1, "segmentId": 3, "chapter": "c"},
        ]
        result = _dedup_citations(items)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].chapter, "a")

    def test_dedup_mixed_dict_and_model(self):
        """dict 与 Citation 混合输入均被归一。"""
        items = [
            Citation(docId=1, segmentId=2),
            {"docId": 1, "segmentId": 2},
            Citation(docId=2, segmentId=2),
        ]
        result = _dedup_citations(items)
        self.assertEqual(len(result), 2)
        self.assertTrue(all(isinstance(c, Citation) for c in result))

    def test_dedup_none_fields_distinct(self):
        """doc_id/segment_id 为 None 的条目按 (None,None) 同样去重。"""
        items = [{"chapter": "a"}, {"chapter": "b"}]
        self.assertEqual(len(_dedup_citations(items)), 1)

    def test_dedup_empty(self):
        """空输入 → 空列表。"""
        self.assertEqual(_dedup_citations([]), [])


class TestOrderSteps(unittest.TestCase):
    """_order_steps 步骤排序。"""

    def test_order_steps_fixed_agent_order(self):
        """按 AGENT_ORDER 固定顺序输出。"""
        raw = [
            {"agentCode": "work_order", "status": "success"},
            {"agentCode": "monitor", "status": "success"},
            {"agentCode": "safety", "status": "degraded"},
        ]
        ordered = _order_steps(raw)
        self.assertEqual([s.agent_code for s in ordered], ["monitor", "safety", "work_order"])

    def test_order_steps_missing_agent_dropped(self):
        """缺失节点 step 丢弃，stepOrder 取 AGENT_ORDER 固定位置（跳号）。"""
        raw = [
            {"agentCode": "root_cause", "status": "success"},
            {"agentCode": "work_order", "status": "success"},
        ]
        ordered = _order_steps(raw)
        self.assertEqual([s.agent_code for s in ordered], ["root_cause", "work_order"])
        # AGENT_ORDER: monitor=1 root_cause=2 spare_cost=3 safety=4 work_order=5
        self.assertEqual([s.step_order for s in ordered], [2, 5])

    def test_order_steps_agent_names_attached(self):
        """agentName 按 AGENT_NAMES 映射。"""
        ordered = _order_steps([{"agentCode": "monitor", "status": "success"}])
        self.assertEqual(ordered[0].agent_name, "设备监测")

    def test_order_steps_empty(self):
        """空输入 → 空列表。"""
        self.assertEqual(_order_steps([]), [])


class TestRunAgentNode(unittest.TestCase):
    """_run_agent_node 节点执行与异常处理。"""

    def _state(self, trigger=None):
        configs = {}
        if trigger is not None:
            configs["monitor"] = AgentConfig(agentCode="monitor", triggerCondition=trigger)
        return {"agent_outputs": {}, "configs": configs}

    def test_run_node_trigger_unparseable_skipped(self):
        """触发条件无法解析（evaluate→None）→ status=skipped。"""
        with patch.object(
            orchestrator._NODES["monitor"], "run", side_effect=AssertionError("不应执行")
        ):
            update = _run_agent_node(self._state(trigger="非法 表达式"), "monitor")
        step = update["steps"][0]
        self.assertEqual(step["status"], "skipped")
        self.assertIn("触发条件无法解析", step["summary"])

    def test_run_node_trigger_not_met_skipped(self):
        """触发条件为假（evaluate→False）→ status=skipped。"""
        with patch.object(
            orchestrator._NODES["monitor"], "run", side_effect=AssertionError("不应执行")
        ):
            update = _run_agent_node(
                {
                    "agent_outputs": {"monitor": {"severity": "low"}},
                    "configs": {"monitor": AgentConfig(agentCode="monitor", triggerCondition="monitor.severity == 'high'")},
                },
                "monitor",
            )
        step = update["steps"][0]
        self.assertEqual(step["status"], "skipped")
        self.assertIn("触发条件未满足", step["summary"])

    def test_run_node_trigger_met_executes(self):
        """触发条件为真 → 节点执行。"""
        node_result = NodeResult(output={"deviceStatus": "abnormal"}, summary="ok")
        with patch.object(
            orchestrator._NODES["monitor"], "run", return_value=node_result
        ) as mock_run:
            update = _run_agent_node(
                {
                    "agent_outputs": {"monitor": {"severity": "high"}},
                    "configs": {"monitor": AgentConfig(agentCode="monitor", triggerCondition="monitor.severity == 'high'")},
                },
                "monitor",
            )
        mock_run.assert_called_once()
        self.assertEqual(update["steps"][0]["status"], "success")

    def test_run_node_ai_service_error_failed(self):
        """节点抛 AiServiceError → status=failed、summary=异常消息。"""
        with patch.object(
            orchestrator._NODES["monitor"],
            "run",
            side_effect=AiServiceError(ErrorCode.MODEL_UNAVAILABLE, "模型不可用"),
        ):
            update = _run_agent_node(self._state(), "monitor")
        step = update["steps"][0]
        self.assertEqual(step["status"], "failed")
        self.assertEqual(step["summary"], "模型不可用")

    def test_run_node_generic_error_failed(self):
        """节点抛普通 Exception → status=failed、summary 含“节点执行异常”。"""
        with patch.object(
            orchestrator._NODES["monitor"], "run", side_effect=ValueError("boom")
        ):
            update = _run_agent_node(self._state(), "monitor")
        step = update["steps"][0]
        self.assertEqual(step["status"], "failed")
        self.assertIn("节点执行异常", step["summary"])

    def test_run_node_normal_result_passthrough(self):
        """正常返回 → 透传其 status 与 output。"""
        node_result = NodeResult(
            output={"deviceStatus": "abnormal", "severity": "high"},
            summary="s",
            citations=[Citation(docId=1, segmentId=2)],
            status="degraded",
        )
        with patch.object(
            orchestrator._NODES["monitor"], "run", return_value=node_result
        ):
            update = _run_agent_node(self._state(), "monitor")
        step = update["steps"][0]
        self.assertEqual(step["status"], "degraded")
        self.assertEqual(step["summary"], "s")
        self.assertEqual(step["citations"][0]["docId"], 1)
        self.assertEqual(update["agent_outputs"]["monitor"], node_result.output)
        self.assertEqual(update["monitor_status"], "abnormal")
        self.assertEqual(len(update["citations"]), 1)

    def test_run_node_monitor_status_default_normal(self):
        """monitor 输出缺 deviceStatus 时 monitor_status 默认 normal。"""
        node_result = NodeResult(output={"severity": "low"}, summary="s")
        with patch.object(
            orchestrator._NODES["monitor"], "run", return_value=node_result
        ):
            update = _run_agent_node(self._state(), "monitor")
        self.assertEqual(update["monitor_status"], "normal")

    def test_run_node_timeout_monitor_conservative_abnormal(self):
        """monitor 配置 timeoutSeconds 超时 → status=timeout、保守置 abnormal。"""
        def slow_run(state):
            time.sleep(1.5)
            return NodeResult(output={"deviceStatus": "normal"}, summary="不应生效")

        with patch.object(orchestrator._NODES["monitor"], "run", side_effect=slow_run):
            update = _run_agent_node(
                {
                    "agent_outputs": {},
                    "anomalies": [],
                    "configs": {"monitor": AgentConfig(agentCode="monitor", timeoutSeconds=1)},
                },
                "monitor",
            )
        step = update["steps"][0]
        self.assertEqual(step["status"], "timeout")
        self.assertEqual(update["monitor_status"], "abnormal")
        self.assertEqual(update["agent_outputs"]["monitor"]["deviceStatus"], "abnormal")
        self.assertEqual(update["agent_outputs"]["monitor"]["status"], "timeout")
        import json as _json

        parsed = _json.loads(step["output"])
        self.assertEqual(parsed["deviceStatus"], "abnormal")

    def test_run_node_timeout_safety_conservative_fail(self):
        """safety 超时 → 保守 checkResult=fail、riskLevel=high。"""
        def slow_run(state):
            time.sleep(1.5)

        with patch.object(orchestrator._NODES["safety"], "run", side_effect=slow_run):
            update = _run_agent_node(
                {
                    "agent_outputs": {},
                    "configs": {"safety": AgentConfig(agentCode="safety", timeoutSeconds=1)},
                },
                "safety",
            )
        step = update["steps"][0]
        self.assertEqual(step["status"], "timeout")
        self.assertEqual(update["agent_outputs"]["safety"]["checkResult"], "fail")
        self.assertEqual(update["agent_outputs"]["safety"]["riskLevel"], "high")

    def test_run_node_timeout_zero_disables_timeout(self):
        """timeoutSeconds=0/负数 → 不启用超时，等待节点完成。"""
        node_result = NodeResult(output={"deviceStatus": "normal"}, summary="ok")
        with patch.object(
            orchestrator._NODES["monitor"], "run", return_value=node_result
        ) as mock_run:
            update = _run_agent_node(
                {
                    "agent_outputs": {},
                    "configs": {"monitor": AgentConfig(agentCode="monitor", timeoutSeconds=0)},
                },
                "monitor",
            )
        mock_run.assert_called_once()
        self.assertEqual(update["steps"][0]["status"], "success")

    def test_run_node_timeout_output_non_monitor_nodes(self):
        """root_cause/spare_cost/work_order 超时降级输出含 status=timeout。"""
        from app.agents.multi.orchestrator import _timeout_output

        for code in ("root_cause", "spare_cost", "work_order"):
            output = _timeout_output(code, {"anomalies": []})
            self.assertEqual(output["status"], "timeout", code)
        self.assertIsNone(_timeout_output("root_cause", {})["topCause"])
        self.assertEqual(_timeout_output("spare_cost", {})["costLevel"], "low")
        self.assertIsNone(_timeout_output("work_order", {})["orderTitle"])


class TestApply(unittest.TestCase):
    """_apply 状态合并。"""

    def test_apply_appends_steps_and_citations(self):
        """steps/citations 列表追加而非覆盖。"""
        state = {"steps": [{"agentCode": "monitor"}], "citations": [{"docId": 1}]}
        _apply(state, {"steps": [{"agentCode": "safety"}], "citations": [{"docId": 2}]})
        self.assertEqual(len(state["steps"]), 2)
        self.assertEqual(len(state["citations"]), 2)

    def test_apply_merges_agent_outputs(self):
        """agent_outputs 字典合并。"""
        state = {"agent_outputs": {"monitor": {"a": 1}}}
        _apply(state, {"agent_outputs": {"safety": {"b": 2}}})
        self.assertEqual(state["agent_outputs"], {"monitor": {"a": 1}, "safety": {"b": 2}})

    def test_apply_creates_missing_list_keys(self):
        """state 缺 steps/citations 键时自动初始化。"""
        state = {}
        _apply(state, {"steps": [{"agentCode": "x"}], "citations": []})
        self.assertEqual(state["steps"], [{"agentCode": "x"}])
        self.assertEqual(state["citations"], [])

    def test_apply_none_update_noop(self):
        """update 为 None 时无操作。"""
        state = {"steps": []}
        _apply(state, None)
        self.assertEqual(state, {"steps": []})

    def test_apply_scalar_overwrite(self):
        """标量键直接覆盖。"""
        state = {"risk_level": "low"}
        _apply(state, {"risk_level": "high"})
        self.assertEqual(state["risk_level"], "high")


class TestInitialState(unittest.TestCase):
    """initial_state 初始化。"""

    def test_initial_state_structure(self):
        """初始 state 结构与 run_id 格式。"""
        request = DiagnosisRunRequest(
            anomalies=[{"metricId": 1, "severity": "high"}],
            agents=[{"agentCode": "monitor", "triggerCondition": "m.x == 1"}],
        )
        state = initial_state(request, "trace-1")
        self.assertEqual(state["trace_id"], "trace-1")
        self.assertEqual(len(state["run_id"]), 32)
        self.assertEqual(state["anomalies"][0].severity, "high")
        self.assertIn("monitor", state["configs"])
        self.assertEqual(state["configs"]["monitor"].trigger_condition, "m.x == 1")
        self.assertEqual(state["agent_outputs"], {})
        self.assertEqual(state["steps"], [])
        self.assertEqual(state["citations"], [])
        self.assertEqual(state["active_codes"], ["monitor"])

    def test_agent_order_constant(self):
        """AGENT_ORDER 固定顺序锁定。"""
        self.assertEqual(
            AGENT_ORDER, ["monitor", "root_cause", "spare_cost", "safety", "work_order"]
        )

    def test_initial_state_active_codes_full_when_no_agents(self):
        """agents 为空 → active_codes 为全量（向后兼容）。"""
        state = initial_state(DiagnosisRunRequest(), "t")
        self.assertEqual(state["active_codes"], list(AGENT_ORDER))

    def test_active_codes_filtered_in_fixed_order(self):
        """agents 乱序/含未知 code → 按固定领域阶段顺序过滤。"""
        request = DiagnosisRunRequest(
            agents=[
                {"agentCode": "work_order"},
                {"agentCode": "monitor"},
                {"agentCode": "unknown"},
            ]
        )
        state = initial_state(request, "t")
        self.assertEqual(state["active_codes"], ["monitor", "work_order"])

    def test_active_codes_monitor_only_when_unknown(self):
        """仅未知 code → 过滤后仅剩强制激活的 monitor（固定首节点）。"""
        request = DiagnosisRunRequest(agents=[{"agentCode": "foo"}])
        self.assertEqual(active_codes_of({"configs": {"foo": request.agents[0]}}), ["monitor"])
        state = initial_state(request, "t")
        self.assertEqual(state["active_codes"], ["monitor"])


_CANNED_OUTPUTS = {
    "monitor": {"deviceStatus": "abnormal", "severity": "high", "confirmedAnomalies": [], "summary": "监测异常"},
    "root_cause": {"rootCauses": [], "topCause": "轴承磨损", "confidence": 0.9, "summary": "根因定位"},
    "spare_cost": {"spareParts": [{"partName": "轴承"}], "downtimeLoss": 500, "costLevel": "high", "summary": "成本评估"},
    "safety": {"checkResult": "pass", "safetyRequirements": ["断电挂牌"], "riskLevel": "low", "reason": "核查通过"},
    "work_order": {"orderTitle": "维修工单", "priority": "high", "steps": ["停机"], "spareParts": ["轴承"], "safetyNotes": ["断电挂牌"]},
}


class TestInvokeSequential(unittest.TestCase):
    """_invoke_sequential 按 active_codes 裁剪执行（过滤不重排）。"""

    def _run(self, agent_codes, monitor_output=None):
        outputs = dict(_CANNED_OUTPUTS)
        if monitor_output is not None:
            outputs["monitor"] = monitor_output
        called = []

        def make_run(code):
            def _run_node(state):
                called.append(code)
                return NodeResult(output=outputs[code], summary=code, status="success")
            return _run_node

        request = DiagnosisRunRequest(
            anomalies=[{"metricId": 1, "severity": "high"}],
            agents=[{"agentCode": code} for code in agent_codes],
        )
        state = initial_state(request, "trace-seq")
        with ExitStack() as stack:
            for code in AGENT_ORDER:
                stack.enter_context(
                    patch.object(orchestrator._NODES[code], "run", side_effect=make_run(code))
                )
            result = _invoke_sequential(state)
        return result, called

    def test_sequential_full_flow_all_agents(self):
        """全量 agents → 五节点全执行，risk 取三路最大（high）。"""
        result, called = self._run(AGENT_ORDER)
        self.assertEqual(called, list(AGENT_ORDER))
        self.assertEqual(result["risk_level"], "high")
        self.assertEqual([s["agentCode"] for s in result["steps"]], list(AGENT_ORDER))

    def test_sequential_prunes_missing_agents(self):
        """缺 spare_cost/safety → 两节点不执行，其余正常。"""
        result, called = self._run(["monitor", "root_cause", "work_order"])
        self.assertEqual(called, ["monitor", "root_cause", "work_order"])
        codes = [s["agentCode"] for s in result["steps"]]
        self.assertEqual(codes, ["monitor", "root_cause", "work_order"])
        self.assertNotIn("spare_cost", codes)
        self.assertNotIn("safety", codes)
        self.assertEqual(result["risk_level"], "high")
        self.assertIn("维修工单", result["conclusion"])

    def test_sequential_monitor_normal_short_circuit(self):
        """monitor 正常 → 直接 finalize，仅 monitor 一个步骤。"""
        result, called = self._run(
            AGENT_ORDER,
            monitor_output={"deviceStatus": "normal", "severity": "low", "confirmedAnomalies": [], "summary": "正常"},
        )
        self.assertEqual(called, ["monitor"])
        self.assertIn("设备状态正常", result["conclusion"])

    def test_sequential_unknown_only_runs_monitor(self):
        """仅未知 code → monitor 仍以默认配置执行，其余领域节点不执行。"""
        result, called = self._run(["unknown_agent"])
        self.assertEqual(called, ["monitor"])
        self.assertEqual([s["agentCode"] for s in result["steps"]], ["monitor"])
        self.assertEqual(result["conclusion"], "监测异常。")
        self.assertEqual(result["risk_level"], "high")

    def test_sequential_monitor_runs_even_unconfigured(self):
        """未配置 monitor → monitor 仍强制执行，后续节点正常。"""
        result, called = self._run(["root_cause", "spare_cost", "safety", "work_order"])
        self.assertEqual(called, list(AGENT_ORDER))
        self.assertEqual(result["risk_level"], "high")

    def test_sequential_root_cause_missing_parallel_still_runs(self):
        """无 root_cause → monitor 异常后直接进入并行段。"""
        result, called = self._run(["monitor", "spare_cost", "safety", "work_order"])
        self.assertEqual(called, ["monitor", "spare_cost", "safety", "work_order"])
        self.assertEqual(result["risk_level"], "high")


if __name__ == "__main__":
    unittest.main()