# -*- coding: utf-8 -*-
"""app/graphrag/extractor.py 纯函数与降级逻辑单元测试。

patch 目标依据 extractor.py 源码：from app.core.providers import get_llm
→ patch app.graphrag.extractor.get_llm
"""
import sys
import pathlib
import unittest
from decimal import Decimal
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "code" / "ai-service"))

from app.graphrag.extractor import (  # noqa: E402
    _canonical,
    _heuristic_edges,
    _to_edge,
    extract_candidates,
)


class TestCanonical(unittest.TestCase):
    """_canonical 关系类型归一。"""

    def test_canonical_supplement(self):
        """"supplement" → SUPPLEMENT。"""
        self.assertEqual(_canonical("supplement"), "SUPPLEMENT")

    def test_canonical_same_fault_with_hyphen(self):
        """"same-fault" → SAME_FAULT（连字符归一）。"""
        self.assertEqual(_canonical("same-fault"), "SAME_FAULT")

    def test_canonical_case_and_space_normalized(self):
        """大小写与空格归一。"""
        self.assertEqual(_canonical(" Same Device "), "SAME_DEVICE")
        self.assertEqual(_canonical("Replace"), "REPLACE")

    def test_canonical_uppercase_direct(self):
        """标准大写形式直接通过。"""
        self.assertEqual(_canonical("REF"), "REF")
        self.assertEqual(_canonical("PRECEDE"), "PRECEDE")

    def test_canonical_alias_mapping(self):
        """别名映射：ref→REF、precede→PRECEDE。"""
        self.assertEqual(_canonical("ref"), "REF")
        self.assertEqual(_canonical("precede"), "PRECEDE")

    def test_canonical_unknown_returns_none(self):
        """未知关系类型 → None。"""
        self.assertIsNone(_canonical("friends"))

    def test_canonical_empty_returns_none(self):
        """空串 → None。"""
        self.assertIsNone(_canonical(""))

    def test_canonical_none_returns_none(self):
        """None → None。"""
        self.assertIsNone(_canonical(None))


class TestToEdge(unittest.TestCase):
    """_to_edge 候选边构造。"""

    VALID = {1, 2, 3}

    def test_to_edge_self_loop_returns_none(self):
        """自环（fromRefId==toRefId）→ None。"""
        self.assertIsNone(_to_edge({"fromRefId": 1, "toRefId": 1, "relationType": "REF"}, self.VALID))

    def test_to_edge_out_of_range_returns_none(self):
        """refId 越界（不在 valid_ids）→ None。"""
        self.assertIsNone(_to_edge({"fromRefId": 1, "toRefId": 99, "relationType": "REF"}, self.VALID))

    def test_to_edge_non_integer_ref_returns_none(self):
        """非整数 refId → None。"""
        self.assertIsNone(_to_edge({"fromRefId": "x", "toRefId": 2, "relationType": "REF"}, self.VALID))

    def test_to_edge_missing_ref_returns_none(self):
        """缺 refId → None。"""
        self.assertIsNone(_to_edge({"toRefId": 2, "relationType": "REF"}, self.VALID))

    def test_to_edge_invalid_confidence_defaults_half(self):
        """confidence 非法 → Decimal("0.5")。"""
        edge = _to_edge(
            {"fromRefId": 1, "toRefId": 2, "relationType": "supplement", "confidence": "abc"},
            self.VALID,
        )
        self.assertIsNotNone(edge)
        self.assertEqual(edge.confidence, Decimal("0.5"))

    def test_to_edge_missing_confidence_defaults_half(self):
        """confidence 缺省 → Decimal("0.5")。"""
        edge = _to_edge({"fromRefId": 1, "toRefId": 2, "relationType": "REF"}, self.VALID)
        self.assertEqual(edge.confidence, Decimal("0.5"))

    def test_to_edge_normal_construction(self):
        """正常构造：source=auto、节点类型 segment。"""
        edge = _to_edge(
            {"fromRefId": 1, "toRefId": 2, "relationType": "SUPPLEMENT", "confidence": 0.8},
            self.VALID,
        )
        self.assertEqual(edge.from_ref_id, 1)
        self.assertEqual(edge.to_ref_id, 2)
        self.assertEqual(edge.from_node_type, "segment")
        self.assertEqual(edge.to_node_type, "segment")
        self.assertEqual(edge.relation_type, "SUPPLEMENT")
        self.assertEqual(edge.source, "auto")
        self.assertAlmostEqual(float(edge.confidence), 0.8)

    def test_to_edge_unknown_relation_returns_none(self):
        """relationType 无法归一 → None。"""
        self.assertIsNone(_to_edge({"fromRefId": 1, "toRefId": 2, "relationType": "???"}, self.VALID))

    def test_to_edge_confidence_rounded(self):
        """confidence 四舍五入 4 位。"""
        edge = _to_edge(
            {"fromRefId": 1, "toRefId": 2, "relationType": "REF", "confidence": 0.123456},
            self.VALID,
        )
        self.assertAlmostEqual(float(edge.confidence), 0.1235, places=6)


class TestHeuristicEdges(unittest.TestCase):
    """_heuristic_edges 词重叠启发式。"""

    def test_heuristic_overlap_below_three_no_edge(self):
        """词重叠 < 3 → 无边。"""
        segments = [
            {"segmentId": 1, "content": "液压 泵 压力"},
            {"segmentId": 2, "content": "液压 温度 传感器"},
        ]
        self.assertEqual(_heuristic_edges(segments), [])

    def test_heuristic_overlap_three_confidence_055(self):
        """重叠 = 3 → 置信 0.4+0.05*3≈0.55。

        注意 tokenize 中文按单字切分，用英文 token 精确控制重叠数。
        """
        segments = [
            {"segmentId": 1, "content": "alpha beta gamma extra"},
            {"segmentId": 2, "content": "alpha beta gamma other"},
        ]
        edges = _heuristic_edges(segments)
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0].from_ref_id, 1)
        self.assertEqual(edges[0].to_ref_id, 2)
        self.assertEqual(edges[0].relation_type, "SAME_FAULT")
        self.assertAlmostEqual(float(edges[0].confidence), 0.55, places=6)

    def test_heuristic_large_overlap_capped_075(self):
        """重叠很大时置信封顶 0.75。"""
        words = " ".join(f"词{i}" for i in range(10))
        segments = [
            {"segmentId": 1, "content": words},
            {"segmentId": 2, "content": words},
        ]
        edges = _heuristic_edges(segments)
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0].confidence, Decimal("0.75"))

    def test_heuristic_empty_segments(self):
        """空片段列表 → 无边。"""
        self.assertEqual(_heuristic_edges([]), [])

    def test_heuristic_single_segment(self):
        """单片段无法成边。"""
        self.assertEqual(_heuristic_edges([{"segmentId": 1, "content": "a b c"}]), [])


class TestExtractCandidates(unittest.TestCase):
    """extract_candidates LLM 主路径与启发式降级。"""

    SEGMENTS = [
        {"segmentId": 1, "chapter": "第一章", "content": "液压 泵 压力 异常"},
        {"segmentId": 2, "chapter": "第二章", "content": "液压 泵 压力 检修"},
    ]

    def test_extract_candidates_fewer_than_two_segments(self):
        """片段数 < 2 → 空列表（不调 LLM）。"""
        with patch(
            "app.graphrag.extractor.get_llm", side_effect=AssertionError("不应调用 LLM")
        ):
            self.assertEqual(extract_candidates(1, [{"segmentId": 1, "content": "x"}]), [])
            self.assertEqual(extract_candidates(1, []), [])

    def test_extract_candidates_llm_exception_falls_back_heuristic(self):
        """LLM 抛异常 → 启发式降级仍返回边。"""
        with patch("app.graphrag.extractor.get_llm", side_effect=RuntimeError("llm down")):
            edges = extract_candidates(1, self.SEGMENTS)
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0].relation_type, "SAME_FAULT")

    def test_extract_candidates_invalid_llm_json_falls_back(self):
        """LLM 返回非法 JSON → 启发式降级。"""
        llm = MagicMock()
        llm.chat.return_value = "这不是 JSON 数组"
        with patch("app.graphrag.extractor.get_llm", return_value=llm):
            edges = extract_candidates(1, self.SEGMENTS)
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0].relation_type, "SAME_FAULT")

    def test_extract_candidates_llm_valid_json_parsed(self):
        """LLM 返回合法 JSON 数组 → 解析出的边。"""
        llm = MagicMock()
        llm.chat.return_value = (
            '好的，结果如下：\n[{"fromRefId": 1, "toRefId": 2, '
            '"relationType": "SUPPLEMENT", "confidence": 0.8}]'
        )
        with patch("app.graphrag.extractor.get_llm", return_value=llm):
            edges = extract_candidates(1, self.SEGMENTS)
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0].relation_type, "SUPPLEMENT")
        self.assertEqual(edges[0].from_ref_id, 1)
        self.assertEqual(edges[0].to_ref_id, 2)
        self.assertAlmostEqual(float(edges[0].confidence), 0.8)

    def test_extract_candidates_llm_edges_out_of_range_falls_back(self):
        """LLM 边全部越界被过滤 → 无有效边时启发式降级。"""
        llm = MagicMock()
        llm.chat.return_value = '[{"fromRefId": 1, "toRefId": 99, "relationType": "REF"}]'
        with patch("app.graphrag.extractor.get_llm", return_value=llm):
            edges = extract_candidates(1, self.SEGMENTS)
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0].relation_type, "SAME_FAULT")

    def test_extract_candidates_prompt_contains_catalog(self):
        """LLM 消息包含片段目录与系统提示。"""
        llm = MagicMock()
        llm.chat.return_value = "[]"
        with patch("app.graphrag.extractor.get_llm", return_value=llm):
            extract_candidates(1, self.SEGMENTS)
        messages = llm.chat.call_args.args[0]
        self.assertEqual(messages[0]["role"], "system")
        self.assertIn("片段集合", messages[1]["content"])
        self.assertIn("[1] 第一章", messages[1]["content"])
        self.assertEqual(llm.chat.call_args.kwargs.get("temperature"), 0.0)


if __name__ == "__main__":
    unittest.main()