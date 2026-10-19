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
]