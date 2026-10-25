from app.agents.multi.nodes.base import AGENT_NAMES, AgentNode, NodeResult
from app.agents.multi.nodes.monitor import MonitorNode
from app.agents.multi.nodes.root_cause import RootCauseNode
from app.agents.multi.nodes.safety import SafetyNode
from app.agents.multi.nodes.spare_cost import SpareCostNode
from app.agents.multi.nodes.work_order import WorkOrderNode

NODE_CLASSES = {
    "monitor": MonitorNode,
    "root_cause": RootCauseNode,
    "spare_cost": SpareCostNode,
    "safety": SafetyNode,
    "work_order": WorkOrderNode,
}


def build_nodes() -> dict[str, AgentNode]:
    return {code: cls() for code, cls in NODE_CLASSES.items()}


def create_node_instance(template_code: str, instance_key: str, display_name: str | None = None) -> AgentNode:
    if template_code not in NODE_CLASSES:
        from app.core.errors import ErrorCode, bad_request

        raise bad_request(f"未知 Agent 模板: {template_code}")
    node = NODE_CLASSES[template_code]()
    node.code = instance_key
    node.name = display_name or AGENT_NAMES.get(template_code, instance_key)
    node.template_code = template_code
    return node


__all__ = [
    "AGENT_NAMES",
    "AgentNode",
    "NodeResult",
    "MonitorNode",
    "RootCauseNode",
    "SpareCostNode",
    "SafetyNode",
    "WorkOrderNode",
    "NODE_CLASSES",
    "build_nodes",
    "create_node_instance",
]