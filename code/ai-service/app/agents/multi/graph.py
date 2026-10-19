from __future__ import annotations

from app.agents.multi.orchestrator import (
    AGENT_ORDER,
    DiagnosisState,
    finalize,
    route_after_monitor,
    step_arbitrate,
    step_monitor,
    step_root_cause,
    step_safety,
    step_spare_cost,
    step_work_order,
)

_STEP_FNS = {
    "monitor": step_monitor,
    "root_cause": step_root_cause,
    "spare_cost": step_spare_cost,
    "safety": step_safety,
    "work_order": step_work_order,
}


def build_diagnosis_graph(active_codes=None):
    """按流程配置的节点集合动态构建诊断图。

    - active_codes 为 None → 全量 AGENT_ORDER（兼容旧行为）
    - active_codes 为列表（可为空）→ 仅建对应节点与边，缺失节点不执行
    - arbitrate / finalize 为内部节点，始终存在
    - 拓扑保持固定领域阶段顺序：monitor → root_cause → (spare_cost ∥ safety) → arbitrate → work_order
    """
    from langgraph.graph import END, START, StateGraph

    if active_codes is None:
        active = set(AGENT_ORDER)
    else:
        configured = set(active_codes)
        active = {code for code in AGENT_ORDER if code in configured}
    parallel = [code for code in ("spare_cost", "safety") if code in active]
    has_monitor = "monitor" in active
    has_root = "root_cause" in active

    graph = StateGraph(DiagnosisState)
    graph.add_node("arbitrate", step_arbitrate)
    graph.add_node("finalize", finalize)
    for code in active:
        graph.add_node(code, _STEP_FNS[code])

    for code in parallel:
        graph.add_edge(code, "arbitrate")
    if "work_order" in active:
        graph.add_edge("arbitrate", "work_order")
        graph.add_edge("work_order", "finalize")
    else:
        graph.add_edge("arbitrate", "finalize")
    graph.add_edge("finalize", END)

    if has_monitor:
        graph.add_edge(START, "monitor")
        ends = {"finalize": "finalize", "arbitrate": "arbitrate"}
        if has_root:
            ends["root_cause"] = "root_cause"
        for code in parallel:
            ends[code] = code

        def _route_after_monitor(state):
            if route_after_monitor(state) == "end":
                return "finalize"
            if has_root:
                return "root_cause"
            if parallel:
                return list(parallel)
            return "arbitrate"

        graph.add_conditional_edges("monitor", _route_after_monitor, ends)

    if has_root:
        if not has_monitor:
            graph.add_edge(START, "root_cause")
        for code in parallel:
            graph.add_edge("root_cause", code)
        if not parallel:
            graph.add_edge("root_cause", "arbitrate")
    elif not has_monitor:
        if parallel:
            for code in parallel:
                graph.add_edge(START, code)
        else:
            graph.add_edge(START, "arbitrate")

    return graph.compile()