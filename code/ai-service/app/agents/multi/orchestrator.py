from __future__ import annotations

import json
import operator
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeoutError
from typing import Annotated, TypedDict

from app.agents.multi.dsl import evaluate
from app.agents.multi.nodes import build_nodes, create_node_instance
from app.core.errors import AiServiceError
from app.core.logging import get_logger
from app.models.common import Citation
from app.models.diagnosis import (
    DiagnosisRunRequest,
    DiagnosisRunResponse,
    StepResult,
)

log = get_logger(__name__)

AGENT_ORDER = ["monitor", "root_cause", "spare_cost", "safety", "work_order"]
AGENT_NAMES = {
    "monitor": "设备监测",
    "root_cause": "根因诊断",
    "spare_cost": "备件成本",
    "safety": "安全规范",
    "work_order": "工单",
}


def _merge_dicts(left, right):
    merged = dict(left or {})
    merged.update(right or {})
    return merged


class DiagnosisState(TypedDict, total=False):
    request: DiagnosisRunRequest
    run_id: str
    trace_id: str
    anomalies: list
    configs: dict
    node_instances: dict
    active_codes: list
    agent_outputs: Annotated[dict, _merge_dicts]
    steps: Annotated[list, operator.add]
    citations: Annotated[list, operator.add]
    monitor_status: str
    work_order_allowed: bool
    risk_level: str
    conclusion: str


_NODES = build_nodes()


def _config_of(state: dict, code: str):
    return (state.get("configs") or {}).get(code)


def _timeout_of(state: dict, code: str) -> float:
    config = _config_of(state, code)
    seconds = getattr(config, "timeout_seconds", None) if config else None
    try:
        return float(seconds) if seconds and float(seconds) > 0 else 0.0
    except (TypeError, ValueError):
        return 0.0


def _trigger_of(state: dict, code: str) -> str:
    config = _config_of(state, code)
    return getattr(config, "trigger_condition", None) or "" if config else ""


def _step(node, *, status: str, summary: str, output, citations, duration_ms: int) -> dict:
    return {
        "agentCode": node.code,
        "instanceKey": node.code,
        "agentName": node.name,
        "status": status,
        "summary": summary,
        "output": json.dumps(output, ensure_ascii=False) if output is not None else None,
        "citations": citations,
        "durationMs": duration_ms,
    }


def _failed_step(node, code: str, started: float, message: str) -> dict:
    elapsed = int((time.perf_counter() - started) * 1000)
    return {
        "steps": [
            _step(node, status="failed", summary=message, output=None, citations=[], duration_ms=elapsed)
        ]
    }


def _max_anomaly_severity(state: dict) -> str:
    rank = 0
    for anomaly in state.get("anomalies") or []:
        rank = max(rank, _rank(getattr(anomaly, "severity", None)))
    return _rank_to_level(rank) if rank > 0 else "medium"


def _timeout_output(code: str, state: dict) -> dict:
    if code == "monitor":
        return {
            "deviceStatus": "abnormal",
            "severity": _max_anomaly_severity(state),
            "confirmedAnomalies": [],
            "summary": "监测节点执行超时，按保守策略标记设备异常",
            "status": "timeout",
        }
    if code == "root_cause":
        return {
            "rootCauses": [],
            "topCause": None,
            "confidence": None,
            "summary": "根因诊断节点执行超时，未能给出根因结论",
            "status": "timeout",
        }
    if code == "spare_cost":
        return {
            "spareParts": [],
            "downtimeLoss": None,
            "costLevel": "low",
            "summary": "备件成本节点执行超时，未给出备件清单",
            "status": "timeout",
        }
    if code == "safety":
        return {
            "checkResult": "fail",
            "safetyRequirements": [],
            "riskLevel": "high",
            "reason": "安全核查节点执行超时，按保守策略否决工单生成",
            "status": "timeout",
        }
    return {
        "orderTitle": None,
        "priority": "medium",
        "steps": [],
        "spareParts": [],
        "safetyNotes": [],
        "summary": "工单节点执行超时，未生成工单",
        "status": "timeout",
    }


def _run_agent_node(state: dict, code: str) -> dict:
    instances = state.get("node_instances") or {}
    node = instances.get(code) or _NODES.get(code)
    if node is None:
        raise AiServiceError(f"未知 Agent 实例: {code}")
    started = time.perf_counter()
    trigger = _trigger_of(state, code)
    if trigger:
        decision = evaluate(trigger, state.get("agent_outputs") or {})
        if decision is None:
            elapsed = int((time.perf_counter() - started) * 1000)
            return {
                "steps": [
                    _step(
                        node,
                        status="skipped",
                        summary=f"触发条件无法解析（{trigger}），节点跳过",
                        output=None,
                        citations=[],
                        duration_ms=elapsed,
                    )
                ]
            }
        if decision is False:
            elapsed = int((time.perf_counter() - started) * 1000)
            return {
                "steps": [
                    _step(
                        node,
                        status="skipped",
                        summary=f"触发条件未满足（{trigger}），节点跳过",
                        output=None,
                        citations=[],
                        duration_ms=elapsed,
                    )
                ]
            }
    timeout_seconds = _timeout_of(state, code)
    result = None
    timed_out = False
    if timeout_seconds > 0:
        pool = ThreadPoolExecutor(max_workers=1)
        future = pool.submit(node.run, state)
        try:
            result = future.result(timeout=timeout_seconds)
        except FuturesTimeoutError:
            timed_out = True
            log.warning("[%s] 节点执行超时（%.0fs），按超时降级处理", code, timeout_seconds)
            future.cancel()
            pool.shutdown(wait=False, cancel_futures=True)
        except AiServiceError as exc:
            pool.shutdown(wait=False)
            return _failed_step(node, code, started, exc.message)
        except Exception as exc:
            pool.shutdown(wait=False)
            log.exception("[%s] 节点异常", code)
            return _failed_step(node, code, started, f"节点执行异常：{exc}")
        else:
            pool.shutdown(wait=False)
    else:
        try:
            result = node.run(state)
        except AiServiceError as exc:
            log.warning("[%s] 节点执行失败：%s", code, exc.message)
            return _failed_step(node, code, started, exc.message)
        except Exception as exc:
            log.exception("[%s] 节点异常", code)
            return _failed_step(node, code, started, f"节点执行异常：{exc}")
    if timed_out:
        elapsed = int((time.perf_counter() - started) * 1000)
        output = _timeout_output(node.template_code, state)
        update = {
            "steps": [
                _step(
                    node,
                    status="timeout",
                    summary=output.get("summary") or f"节点执行超时（{timeout_seconds:.0f}s）",
                    output=output,
                    citations=[],
                    duration_ms=elapsed,
                )
            ],
            "agent_outputs": {code: output},
        }
        if node.template_code == "monitor":
            update["monitor_status"] = "abnormal"
        return update
    elapsed = int((time.perf_counter() - started) * 1000)
    update = {
        "steps": [
            _step(
                node,
                status=result.status,
                summary=result.summary,
                output=result.output,
                citations=[c.model_dump(by_alias=True) for c in result.citations],
                duration_ms=elapsed,
            )
        ],
        "agent_outputs": {code: result.output},
        "citations": result.citations,
    }
    if node.template_code == "monitor":
        update["monitor_status"] = result.output.get("deviceStatus", "normal")
    return update


def step_monitor(state: DiagnosisState) -> dict:
    return _run_agent_node(state, "monitor")


def step_root_cause(state: DiagnosisState) -> dict:
    return _run_agent_node(state, "root_cause")


def step_spare_cost(state: DiagnosisState) -> dict:
    return _run_agent_node(state, "spare_cost")


def step_safety(state: DiagnosisState) -> dict:
    return _run_agent_node(state, "safety")


def step_work_order(state: DiagnosisState) -> dict:
    if not state.get("work_order_allowed", True):
        node = (state.get("node_instances") or {}).get("work_order") or _NODES["work_order"]
        step = _step(
            node,
            status="skipped",
            summary="安全核查未通过，工单节点被安全否决，不予生成工单",
            output=None,
            citations=[],
            duration_ms=0,
        )
        return {"steps": [step]}
    return _run_agent_node(state, "work_order")


def step_arbitrate(state: DiagnosisState) -> dict:
    outputs = state.get("agent_outputs") or {}
    safety = outputs.get("safety") or {}
    monitor = outputs.get("monitor") or {}
    spare = outputs.get("spare_cost") or {}
    allowed = (safety.get("checkResult") or "pass") != "fail"
    risk_rank = max(
        _rank(monitor.get("severity")),
        _rank(safety.get("riskLevel")),
        _rank(spare.get("costLevel")),
    )
    return {"work_order_allowed": allowed, "risk_level": _rank_to_level(risk_rank)}


def _rank(value: str | None) -> int:
    return {"low": 1, "medium": 2, "high": 3}.get((value or "").lower(), 0)


def _rank_to_level(rank: int) -> str:
    return {0: "low", 1: "low", 2: "medium", 3: "high"}.get(rank, "low")


def route_after_monitor(state: DiagnosisState) -> str:
    return "continue" if state.get("monitor_status") == "abnormal" else "end"


def finalize(state: DiagnosisState) -> dict:
    outputs = state.get("agent_outputs") or {}
    instances = state.get("node_instances") or {}
    risk_level = state.get("risk_level")
    if not risk_level:
        rank = 0
        if instances:
            for key, node in instances.items():
                out = outputs.get(key) or {}
                template = node.template_code
                if template == "monitor":
                    rank = max(rank, _rank(out.get("severity")))
                elif template == "safety":
                    rank = max(rank, _rank(out.get("riskLevel")))
                elif template == "spare_cost":
                    rank = max(rank, _rank(out.get("costLevel")))
        else:
            rank = max(
                _rank((outputs.get("monitor") or {}).get("severity")),
                _rank((outputs.get("safety") or {}).get("riskLevel")),
            )
        risk_level = _rank_to_level(rank)
    conclusion = _build_conclusion(state, outputs)
    return {"conclusion": conclusion, "risk_level": risk_level}


def _dedup_citations(citations: list) -> list[Citation]:
    seen: set[tuple] = set()
    result: list[Citation] = []
    for item in citations:
        citation = item if isinstance(item, Citation) else Citation.model_validate(item)
        key = (citation.doc_id, citation.segment_id)
        if key in seen:
            continue
        seen.add(key)
        result.append(citation)
    return result


def _plain_summary(raw) -> str:
    text = str(raw).strip()
    if text.startswith("{"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                inner = parsed.get("summary")
                if isinstance(inner, str) and inner.strip():
                    return inner.strip()
        except (ValueError, TypeError):
            pass
    return text


def _build_conclusion(state: dict, outputs: dict) -> str:
    instances = state.get("node_instances") or {}

    def outputs_of_template(template: str) -> list[dict]:
        if instances:
            return [outputs.get(key) or {} for key, node in instances.items()
                    if node.template_code == template]
        value = outputs.get(template)
        return [value] if isinstance(value, dict) else []

    monitors = outputs_of_template("monitor")
    if monitors and monitors[0].get("deviceStatus") == "normal":
        return "监测确认设备状态正常，本次无需进入根因诊断与工单流程。"
    parts: list[str] = []
    for monitor in monitors:
        if monitor.get("summary"):
            parts.append(_plain_summary(monitor["summary"]))
    for root_cause in outputs_of_template("root_cause"):
        if root_cause.get("topCause"):
            parts.append(f"候选根因为「{root_cause['topCause']}」")
    for spare in outputs_of_template("spare_cost"):
        if spare.get("spareParts"):
            names = [p.get("partName") for p in spare["spareParts"] if isinstance(p, dict) and p.get("partName")]
            if names:
                parts.append("建议备件：" + "、".join(names))
    for safety in outputs_of_template("safety"):
        if safety.get("checkResult") == "fail":
            parts.append("安全核查未通过，已否决工单生成")
        elif safety.get("checkResult") == "pass":
            parts.append("安全核查通过")
    for work_order in outputs_of_template("work_order"):
        if work_order.get("orderTitle"):
            parts.append(f"已生成工单「{work_order['orderTitle']}」，优先级 {work_order.get('priority')}")
    return "；".join(parts) + "。" if parts else "诊断完成。"


def active_codes_of(state: dict) -> list[str]:
    configs = state.get("configs") or {}
    if not configs:
        return list(AGENT_ORDER)
    configured = set(configs.keys())
    configured.add("monitor")
    return [code for code in AGENT_ORDER if code in configured]


def initial_state(request: DiagnosisRunRequest, trace_id: str) -> dict:
    configs: dict = {}
    node_instances: dict = {}
    for cfg in request.agents or []:
        key = cfg.instance_key or cfg.agent_code
        configs[key] = cfg
        node_instances[key] = create_node_instance(
            cfg.template_code or cfg.agent_code, key, cfg.agent_name
        )
    state = {
        "request": request,
        "run_id": uuid.uuid4().hex,
        "trace_id": trace_id,
        "anomalies": list(request.anomalies or []),
        "configs": configs,
        "node_instances": node_instances,
        "agent_outputs": {},
        "steps": [],
        "citations": [],
    }
    state["active_codes"] = list(configs.keys()) if configs else active_codes_of(state)
    return state


def _invoke_langgraph(state: dict) -> dict | None:
    try:
        from app.agents.multi.graph import build_diagnosis_graph
    except Exception as exc:
        log.warning("LangGraph 不可用，使用内置编排：%s", exc)
        return None
    try:
        graph = build_diagnosis_graph(state.get("active_codes"))
        return graph.invoke(state)
    except Exception as exc:
        log.warning("LangGraph 执行失败，回退内置编排：%s", exc)
        return None


_STEP_FNS = {
    "monitor": step_monitor,
    "root_cause": step_root_cause,
    "spare_cost": step_spare_cost,
    "safety": step_safety,
    "work_order": step_work_order,
}


def _invoke_sequential(state: dict) -> dict:
    codes = state.get("active_codes")
    active = set(codes) if codes is not None else set(AGENT_ORDER)
    if "monitor" in active:
        _apply(state, step_monitor(state))
    if "monitor" in active and route_after_monitor(state) == "end":
        _apply(state, finalize(state))
        return state
    if "root_cause" in active:
        _apply(state, step_root_cause(state))
    parallel = [code for code in ("spare_cost", "safety") if code in active]
    if parallel:
        from concurrent.futures import ThreadPoolExecutor

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(_STEP_FNS[code], state) for code in parallel]
            for future in futures:
                _apply(state, future.result())
    _apply(state, step_arbitrate(state))
    if "work_order" in active:
        _apply(state, step_work_order(state))
    _apply(state, finalize(state))
    return state


def _apply(state: dict, update: dict | None) -> None:
    if not update:
        return
    for key, value in update.items():
        if key in ("steps", "citations"):
            state.setdefault(key, [])
            if isinstance(value, list):
                state[key] = state[key] + value
            else:
                state[key] = value
        elif key == "agent_outputs":
            state["agent_outputs"] = _merge_dicts(state.get("agent_outputs"), value)
        else:
            state[key] = value


def _invoke_flow(state: dict) -> dict:
    for key in list(state.get("active_codes") or []):
        _apply(state, _run_agent_node(state, key))
    _apply(state, finalize(state))
    return state


def run_diagnosis(request: DiagnosisRunRequest, trace_id: str = "") -> DiagnosisRunResponse:
    state = initial_state(request, trace_id)
    if request.agents:
        final_state = _invoke_flow(state)
    else:
        final_state = _invoke_langgraph(state)
        if final_state is None:
            final_state = _invoke_sequential(state)

    ordered = _order_steps(final_state.get("steps") or [])
    citations = _dedup_citations(final_state.get("citations") or [])
    return DiagnosisRunResponse(
        runId=final_state.get("run_id") or uuid.uuid4().hex,
        steps=ordered,
        conclusion=final_state.get("conclusion"),
        riskLevel=final_state.get("risk_level"),
        citations=citations,
        traceId=trace_id,
    )


def _order_steps(steps_raw: list[dict]) -> list[StepResult]:
    ordered: list[StepResult] = []
    for order, step in enumerate(steps_raw, start=1):
        ordered.append(
            StepResult(
                stepOrder=order,
                agentCode=step["agentCode"],
                instanceKey=step.get("instanceKey"),
                agentName=step.get("agentName"),
                status=step["status"],
                summary=step.get("summary"),
                output=step.get("output"),
                citations=[Citation.model_validate(c) for c in step.get("citations") or []],
                durationMs=step.get("durationMs") or 0,
            )
        )
    return ordered