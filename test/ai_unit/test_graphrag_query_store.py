# -*- coding: utf-8 -*-
"""app/graphrag/query.py + store.py 单元测试。

graphrag 遮蔽坑（任务书第 5 条）：app/graphrag/__init__.py:3 的
`from app.graphrag.query import extract, query, sync` 使
`from app.graphrag import query` 拿到函数而非模块。
本文件用 `from app.graphrag.query import query, extract, sync` 拿业务函数。

patch 目标依据 query.py 源码：
- from app.graphrag import store → patch app.graphrag.query.store.<fn>
- from app.graphrag.extractor import extract_candidates → patch app.graphrag.query.extract_candidates
"""
import sys
import pathlib
import unittest
from decimal import Decimal
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "code" / "ai-service"))

from app.graphrag import store  # noqa: E402
from app.graphrag.query import extract, query, sync  # noqa: E402
from app.models.graph import (  # noqa: E402
    CandidateEdge,
    EdgeItem,
    GraphQueryRequest,
    GraphSyncRequest,
    NodeItem,
)

# 遮蔽坑：patch("app.graphrag.query.extract_candidates") 不可用——
# unittest.mock 逐段解析 "app.graphrag.query" 时 getattr(app.graphrag, "query")
# 拿到的是 __init__ 遮蔽后的【函数】，再取属性即 AttributeError。
# 必须显式从 sys.modules 取 query.py 模块对象后 patch.object。
gq_module = sys.modules["app.graphrag.query"]


class TestBuildGraphId(unittest.TestCase):
    """store.build_graph_id 格式。"""

    def test_build_graph_id_normal(self):
        """正常格式 kb:node_type:ref。"""
        self.assertEqual(store.build_graph_id(1, "segment", 9), "1:segment:9")

    def test_build_graph_id_empty_type_defaults_segment(self):
        """node_type 空串 → segment。"""
        self.assertEqual(store.build_graph_id(2, "", 3), "2:segment:3")

    def test_build_graph_id_none_type_defaults_segment(self):
        """node_type None → segment。"""
        self.assertEqual(store.build_graph_id(2, None, 3), "2:segment:3")

    def test_build_graph_id_doc_type(self):
        """doc 类型原样保留。"""
        self.assertEqual(store.build_graph_id(10, "doc", 20), "10:doc:20")


class TestGraphQuery(unittest.TestCase):
    """query 函数：traverse 结果去重与过滤。"""

    def test_query_dedup_by_ref_and_type(self):
        """重复 (refId,nodeType) 的记录被去重。"""
        records = [
            {"refId": 1, "nodeType": "segment", "title": "a", "relationType": "REF", "hop": 1},
            {"refId": 1, "nodeType": "segment", "title": "a-dup", "relationType": "SUPPLEMENT", "hop": 2},
            {"refId": 2, "nodeType": "segment", "title": "b", "relationType": "REF", "hop": 1},
        ]
        with patch.object(
            store, "traverse", return_value=records
        ) as mock_traverse:
            nodes = query(GraphQueryRequest(nodeRefId=1))
        self.assertEqual(len(nodes), 2)
        self.assertEqual([(n.ref_id, n.node_type) for n in nodes], [(1, "segment"), (2, "segment")])
        # 首条记录字段保留
        self.assertEqual(nodes[0].title, "a")
        self.assertEqual(nodes[0].relation_type, "REF")
        mock_traverse.assert_called_once_with(
            1, node_type=None, relation_types=None, depth=1
        )

    def test_query_skips_missing_ref_or_type(self):
        """缺 refId/nodeType 的记录被跳过。"""
        records = [
            {"nodeType": "segment", "hop": 1},
            {"refId": 5, "hop": 1},
            {"refId": 6, "nodeType": "doc", "hop": 2},
        ]
        with patch.object(store, "traverse", return_value=records):
            nodes = query(GraphQueryRequest(nodeRefId=1))
        self.assertEqual(len(nodes), 1)
        self.assertEqual(nodes[0].ref_id, 6)

    def test_query_hop_defaults_one(self):
        """hop 缺省（None/0）→ 1。"""
        records = [
            {"refId": 1, "nodeType": "segment"},
            {"refId": 2, "nodeType": "segment", "hop": 0},
        ]
        with patch.object(store, "traverse", return_value=records):
            nodes = query(GraphQueryRequest(nodeRefId=1))
        self.assertEqual([n.hop for n in nodes], [1, 1])

    def test_query_via_node_id_equals_ref_id(self):
        """viaNodeId 取 refId。"""
        with patch.object(
            store, "traverse", return_value=[{"refId": 8, "nodeType": "segment", "hop": 1}]
        ):
            nodes = query(GraphQueryRequest(nodeRefId=1))
        self.assertEqual(nodes[0].via_node_id, 8)

    def test_query_passes_request_params(self):
        """请求参数（nodeType/relationTypes/depth）透传 traverse。"""
        with patch.object(store, "traverse", return_value=[]) as mock_traverse:
            query(
                GraphQueryRequest(
                    nodeRefId=7, nodeType="doc", relationTypes=["REF"], depth=3
                )
            )
        mock_traverse.assert_called_once_with(
            7, node_type="doc", relation_types=["REF"], depth=3
        )

    def test_query_empty_records(self):
        """空遍历结果 → 空列表。"""
        with patch.object(store, "traverse", return_value=[]):
            self.assertEqual(query(GraphQueryRequest(nodeRefId=1)), [])


class TestGraphSync(unittest.TestCase):
    """sync 函数：孤儿边过滤与响应计数。"""

    @staticmethod
    def _request():
        return GraphSyncRequest(
            kbId=1,
            nodes=[
                NodeItem(nodeId=1, nodeType="segment", refId=11, title="n1"),
                NodeItem(nodeId=2, nodeType="segment", refId=22, title="n2"),
            ],
            edges=[
                EdgeItem(fromNodeId=1, toNodeId=2, relationType="REF"),
                EdgeItem(fromNodeId=1, toNodeId=99, relationType="SUPPLEMENT"),  # 孤儿边
                EdgeItem(fromNodeId=98, toNodeId=2, relationType="REF"),  # 孤儿边
            ],
        )

    def test_sync_orphan_edges_filtered(self):
        """孤儿边（节点 id 不在节点表）被过滤，计数正确。"""
        with patch.object(store, "replace_kb_graph", return_value=(2, 1)) as mock_replace:
            resp = sync(self._request())
        self.assertEqual(resp.kb_id, 1)
        self.assertEqual(resp.node_count, 2)
        self.assertEqual(resp.edge_count, 1)
        nodes_arg, edges_arg = mock_replace.call_args.args[1], mock_replace.call_args.args[2]
        self.assertEqual(len(nodes_arg), 2)
        self.assertEqual(len(edges_arg), 1)
        self.assertEqual(edges_arg[0]["fromGraphId"], "1:segment:11")
        self.assertEqual(edges_arg[0]["toGraphId"], "1:segment:22")
        self.assertEqual(edges_arg[0]["relationType"], "REF")

    def test_sync_edge_source_default_manual(self):
        """edge.source 缺省时写库为 manual。"""
        with patch.object(store, "replace_kb_graph", return_value=(1, 1)) as mock_replace:
            sync(
                GraphSyncRequest(
                    kbId=1,
                    nodes=[NodeItem(nodeId=1, nodeType="segment", refId=11)],
                    edges=[EdgeItem(fromNodeId=1, toNodeId=1, relationType="REF")],
                )
            )
        edges_arg = mock_replace.call_args.args[2]
        self.assertEqual(edges_arg[0]["source"], "manual")

    def test_sync_node_graph_id_format(self):
        """节点 graphId 由 kbId:nodeType:refId 组成。"""
        with patch.object(store, "replace_kb_graph", return_value=(2, 0)) as mock_replace:
            sync(self._request())
        nodes_arg = mock_replace.call_args.args[1]
        self.assertEqual(nodes_arg[0]["graphId"], "1:segment:11")
        self.assertEqual(nodes_arg[1]["graphId"], "1:segment:22")
        self.assertEqual(nodes_arg[0]["nodeId"], 1)


class TestGraphExtract(unittest.TestCase):
    """extract 函数：写库与降级。"""

    @staticmethod
    def _edges():
        return [
            CandidateEdge(
                fromRefId=1,
                fromNodeType="segment",
                toRefId=2,
                toNodeType="segment",
                relationType="SUPPLEMENT",
                confidence=Decimal("0.8"),
                source="auto",
            )
        ]

    def test_extract_normal_writes_and_returns(self):
        """正常：返回边并调用写库，行格式正确。

        patch.object(sys.modules["app.graphrag.query"], ...) 直接在 query.py
        模块命名空间替换 extract_candidates。
        注意：字符串目标 "app.graphrag.query.extract_candidates" 不可用——mock
        逐段解析时 app.graphrag.query 已被包 __init__ 遮蔽成函数。
        """
        with patch.object(
            gq_module, "extract_candidates", return_value=self._edges()
        ) as mock_ec:
            with patch.object(store, "upsert_candidate_edges", return_value=1) as mock_upsert:
                edges = extract(1, [])
        self.assertEqual(len(edges), 1)
        mock_upsert.assert_called_once()
        rows = mock_upsert.call_args.args[1]
        self.assertEqual(rows[0]["fromGraphId"], "1:segment:1")
        self.assertEqual(rows[0]["toGraphId"], "1:segment:2")
        self.assertEqual(rows[0]["relationType"], "SUPPLEMENT")
        self.assertEqual(rows[0]["confidence"], 0.8)
        mock_ec.assert_called_once_with(1, [])

    def test_extract_store_failure_still_returns_edges(self):
        """写库抛异常仍返回边（降级点：候选边仍返回调用方）。"""
        with patch.object(
            gq_module, "extract_candidates", return_value=self._edges()
        ):
            with patch.object(
                store, "upsert_candidate_edges", side_effect=RuntimeError("neo4j down")
            ):
                edges = extract(1, [])
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0].relation_type, "SUPPLEMENT")

    def test_extract_no_edges_skips_store(self):
        """无候选边时不调用写库。"""
        with patch.object(gq_module, "extract_candidates", return_value=[]):
            with patch.object(store, "upsert_candidate_edges") as mock_upsert:
                edges = extract(1, [])
        self.assertEqual(edges, [])
        mock_upsert.assert_not_called()


if __name__ == "__main__":
    unittest.main()