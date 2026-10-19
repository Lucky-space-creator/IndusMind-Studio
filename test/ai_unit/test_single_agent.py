# -*- coding: utf-8 -*-
"""app/agents/single/agent.py 单元测试。

patch 目标依据 agent.py 源码 import：
- from app.rag import repository, retriever → patch app.agents.single.agent.retriever.search / .repository.fetch_segments
- from app.core.providers import get_llm → patch app.agents.single.agent.get_llm
- _expand_via_graph 内部 from app.graphrag.query import query as graph_query
  （D4 修复后改为直接取函数）→ patch("app.graphrag.query.query")（替换模块属性）
"""
import sys
import pathlib
import unittest
from decimal import Decimal
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "code" / "ai-service"))

import app.agents.single.agent as agent_module  # noqa: E402
from app.agents.single.agent import _expand_via_graph, _hit_to_dict, answer  # noqa: E402
from app.models.rag import SegmentHit  # noqa: E402

NOT_COVERED = "现有知识库未覆盖该问题，请补充相关文档或换一种问法。"


def _segment_hit(segment_id=1, doc_id=2, score="0.9"):
    return SegmentHit(
        segmentId=segment_id,
        docId=doc_id,
        docName=None,
        chapter="第一章",
        pageNo=3,
        content="更换密封件的步骤……",
        score=Decimal(score),
    )


class TestHitToDict(unittest.TestCase):
    """_hit_to_dict 字段转换。"""

    def test_hit_to_dict_fields(self):
        """SegmentHit → dict 字段齐全，score 转 float。"""
        hit = _segment_hit()
        data = _hit_to_dict(hit)
        self.assertEqual(data["segment_id"], 1)
        self.assertEqual(data["doc_id"], 2)
        self.assertEqual(data["content"], "更换密封件的步骤……")
        self.assertEqual(data["chapter"], "第一章")
        self.assertEqual(data["page_no"], 3)
        self.assertIsInstance(data["score"], float)
        self.assertAlmostEqual(data["score"], 0.9)

    def test_hit_to_dict_score_none(self):
        """score 为 None 时保持 None。"""
        hit = SegmentHit(segmentId=1, docId=2, content="c")
        self.assertIsNone(_hit_to_dict(hit)["score"])


class TestAnswer(unittest.TestCase):
    """answer 主流程。"""

    def test_answer_no_evidence_not_covered(self):
        """检索无结果 → 未覆盖话术 + hit=False。"""
        with patch.object(agent_module.retriever, "search", return_value=[]):
            resp = answer("问题")
        self.assertEqual(resp.answer, NOT_COVERED)
        self.assertFalse(resp.hit)
        self.assertEqual(resp.citations, [])

    def test_answer_search_exception_not_covered(self):
        """检索抛异常 → 按未命中处理。"""
        with patch.object(
            agent_module.retriever, "search", side_effect=RuntimeError("db down")
        ):
            resp = answer("问题")
        self.assertEqual(resp.answer, NOT_COVERED)
        self.assertFalse(resp.hit)

    def test_answer_llm_failure_falls_back_evidence_summary(self):
        """有证据但 LLM 抛异常 → 证据摘要降级文案（含“模型服务暂不可用”）。"""
        llm = MagicMock()
        llm.chat.side_effect = RuntimeError("llm down")
        with patch.object(agent_module.retriever, "search", return_value=[_segment_hit()]):
            with patch.object(agent_module, "_expand_via_graph", return_value=[]):
                with patch.object(agent_module, "get_llm", return_value=llm):
                    resp = answer("问题")
        self.assertTrue(resp.hit)
        self.assertIn("模型服务暂不可用", resp.answer)
        self.assertIn("更换密封件", resp.answer)
        self.assertEqual(resp.citations[0].segment_id, 1)

    def test_answer_llm_empty_text_not_covered(self):
        """LLM 返回空串 → hit=False + 未覆盖话术。"""
        llm = MagicMock()
        llm.chat.return_value = ""
        with patch.object(agent_module.retriever, "search", return_value=[_segment_hit()]):
            with patch.object(agent_module, "_expand_via_graph", return_value=[]):
                with patch.object(agent_module, "get_llm", return_value=llm):
                    resp = answer("问题")
        self.assertEqual(resp.answer, NOT_COVERED)
        self.assertFalse(resp.hit)

    def test_answer_llm_normal_with_graph_expansion(self):
        """正常回答 + 图扩展 → hit=True、citations 组装正确。"""
        llm = MagicMock()
        llm.chat.return_value = "更换密封件需先断电。"
        extra = [
            {
                "segment_id": 99,
                "doc_id": 5,
                "content": "扩展证据",
                "chapter": "第九章",
                "page_no": None,
                "score": 0.0,
            }
        ]
        with patch.object(agent_module.retriever, "search", return_value=[_segment_hit()]):
            with patch.object(agent_module, "_expand_via_graph", return_value=extra) as mock_expand:
                with patch.object(agent_module, "get_llm", return_value=llm):
                    resp = answer("问题", kb_ids=[1], strictness="normal", trace_id="t-1")
        mock_expand.assert_called_once()
        self.assertEqual(resp.answer, "更换密封件需先断电。")
        self.assertTrue(resp.hit)
        self.assertEqual(resp.trace_id, "t-1")
        # citations 含原始证据 + 扩展证据
        self.assertEqual([c.segment_id for c in resp.citations], [1, 99])
        self.assertEqual(resp.citations[1].doc_id, 5)

    def test_answer_citations_without_expansion(self):
        """无扩展时 citations 仅含检索证据。"""
        llm = MagicMock()
        llm.chat.return_value = "答"
        with patch.object(agent_module.retriever, "search", return_value=[_segment_hit()]):
            with patch.object(agent_module, "_expand_via_graph", return_value=[]):
                with patch.object(agent_module, "get_llm", return_value=llm):
                    resp = answer("问题")
        self.assertEqual(len(resp.citations), 1)
        self.assertEqual(resp.citations[0].chapter, "第一章")


class TestExpandViaGraph(unittest.TestCase):
    """_expand_via_graph 图扩展。"""

    EVIDENCE = [
        {"segment_id": 1, "doc_id": 2, "content": "a", "chapter": None, "page_no": None, "score": 0.9}
    ]

    def test_expand_empty_evidence_returns_empty(self):
        """空证据 → 空列表（不调图查询）。"""
        self.assertEqual(_expand_via_graph([]), [])

    def _related(self, ref_id, node_type="segment"):
        from app.models.graph import RelatedNode

        return RelatedNode(refId=ref_id, nodeType=node_type, relationType="SUPPLEMENT")

    def test_expand_returns_extra_segments(self):
        """图关联 segment → 回读并追加扩展证据（score=0.0）。"""
        with patch("app.graphrag.query.query", return_value=[self._related(99)]):
            with patch.object(
                agent_module.repository,
                "fetch_segments",
                return_value=[
                    {"segment_id": 99, "doc_id": 5, "content": "扩展", "chapter": "ch", "page_no": 1}
                ],
            ) as mock_fetch:
                extra = _expand_via_graph(self.EVIDENCE)
        mock_fetch.assert_called_once_with([99])
        self.assertEqual(len(extra), 1)
        self.assertEqual(extra[0]["segment_id"], 99)
        self.assertEqual(extra[0]["score"], 0.0)

    def test_expand_filters_known_and_non_segment(self):
        """已在线证据中的 segment 与非 segment 节点被过滤。"""
        with patch(
            "app.graphrag.query.query",
            return_value=[self._related(1), self._related(7, node_type="doc"), self._related(99)],
        ):
            with patch.object(
                agent_module.repository,
                "fetch_segments",
                return_value=[{"segment_id": 99, "doc_id": 5, "content": "x"}],
            ):
                extra = _expand_via_graph(self.EVIDENCE)
        self.assertEqual([e["segment_id"] for e in extra], [99])

    def test_expand_graph_failure_returns_empty(self):
        """图查询抛异常 → 返回空（已知证据不追加）。"""
        with patch("app.graphrag.query.query", side_effect=RuntimeError("graph down")):
            self.assertEqual(_expand_via_graph(self.EVIDENCE), [])

    def test_expand_fetch_failure_returns_empty(self):
        """回读片段抛异常 → 返回空。"""
        with patch("app.graphrag.query.query", return_value=[self._related(99)]):
            with patch.object(
                agent_module.repository, "fetch_segments", side_effect=RuntimeError("pg down")
            ):
                self.assertEqual(_expand_via_graph(self.EVIDENCE), [])


if __name__ == "__main__":
    unittest.main()