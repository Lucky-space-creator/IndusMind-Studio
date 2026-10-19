# -*- coding: utf-8 -*-
"""app/agents/common.py 纯函数单元测试。"""
import sys
import pathlib
import unittest
from decimal import Decimal

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "code" / "ai-service"))

from app.agents.common import build_citations, format_evidence, parse_json_object  # noqa: E402


class TestParseJsonObject(unittest.TestCase):
    """parse_json_object 容错解析。"""

    def test_parse_json_object_plain(self):
        """正常 JSON 对象解析。"""
        self.assertEqual(parse_json_object('{"a": 1}'), {"a": 1})

    def test_parse_json_object_markdown_fenced(self):
        """markdown 代码块包裹时仍能提取 JSON。"""
        text = "```json\n{\"a\": 1, \"b\": \"x\"}\n```"
        self.assertEqual(parse_json_object(text), {"a": 1, "b": "x"})

    def test_parse_json_object_with_leading_text(self):
        """前后带解释文字时提取花括号内容。"""
        text = '回答如下：{"a": 1} 以上。'
        self.assertEqual(parse_json_object(text), {"a": 1})

    def test_parse_json_object_array_returns_empty(self):
        """数组文本无花括号 → 空字典。"""
        self.assertEqual(parse_json_object("[1, 2, 3]"), {})

    def test_parse_json_object_invalid_json_returns_empty(self):
        """花括号内非法 JSON → 空字典。"""
        self.assertEqual(parse_json_object('{"a": }'), {})

    def test_parse_json_object_empty_string_returns_empty(self):
        """空串 → 空字典。"""
        self.assertEqual(parse_json_object(""), {})

    def test_parse_json_object_none_returns_empty(self):
        """None → 空字典。"""
        self.assertEqual(parse_json_object(None), {})

    def test_parse_json_object_no_braces_returns_empty(self):
        """无花括号纯文本 → 空字典。"""
        self.assertEqual(parse_json_object("hello world"), {})


class TestFormatEvidence(unittest.TestCase):
    """format_evidence 证据格式化。"""

    def test_format_evidence_index_starts_at_one(self):
        """编号从 1 起。"""
        text = format_evidence(
            [
                {"segment_id": 10, "content": "甲"},
                {"segment_id": 11, "content": "乙"},
            ]
        )
        self.assertIn("[1] segmentId=10", text)
        self.assertIn("[2] segmentId=11", text)

    def test_format_evidence_defaults_dash(self):
        """chapter/page_no 缺省显示 '-'。"""
        text = format_evidence([{"segment_id": 1, "content": "c"}])
        self.assertIn("章节=-", text)
        self.assertIn("页码=-", text)

    def test_format_evidence_page_zero_kept(self):
        """page_no=0 不是 None，应显示 0。"""
        text = format_evidence([{"segment_id": 1, "content": "c", "page_no": 0}])
        self.assertIn("页码=0", text)

    def test_format_evidence_content_stripped(self):
        """content 两侧空白被 strip。"""
        text = format_evidence([{"segment_id": 1, "content": "  内容  "}])
        self.assertIn("\n内容", text)
        self.assertNotIn("内容 ", text)

    def test_format_evidence_chapter_filled(self):
        """chapter 有值时原样展示。"""
        text = format_evidence([{"segment_id": 1, "content": "c", "chapter": "第三章"}])
        self.assertIn("章节=第三章", text)

    def test_format_evidence_empty_list(self):
        """空列表返回空串。"""
        self.assertEqual(format_evidence([]), "")

    def test_format_evidence_segments_joined_by_blank_line(self):
        """多段之间以空行分隔。"""
        text = format_evidence(
            [
                {"segment_id": 1, "content": "a"},
                {"segment_id": 2, "content": "b"},
            ]
        )
        self.assertIn("a\n\n[2]", text)


class TestBuildCitations(unittest.TestCase):
    """build_citations 引用构建。"""

    def test_build_citations_score_rounded_four_digits(self):
        """score 四舍五入到 4 位小数并以 Decimal 表示。"""
        citations = build_citations([{"segment_id": 1, "doc_id": 2, "score": 0.123456}])
        self.assertEqual(len(citations), 1)
        score = citations[0].score
        self.assertIsInstance(score, Decimal)
        self.assertAlmostEqual(float(score), 0.1235, places=6)

    def test_build_citations_doc_id_none_tolerated(self):
        """doc_id=None 时 docId/docName 为 None 且不抛错。"""
        citations = build_citations([{"segment_id": 1, "score": 0.5}])
        self.assertIsNone(citations[0].doc_id)
        self.assertIsNone(citations[0].doc_name)

    def test_build_citations_doc_names_mapping(self):
        """doc_names 按 doc_id 映射文档名。"""
        citations = build_citations(
            [{"segment_id": 1, "doc_id": 7, "score": 0.9}],
            doc_names={7: "维修手册"},
        )
        self.assertEqual(citations[0].doc_name, "维修手册")

    def test_build_citations_fields_passthrough(self):
        """chapter/page_no/segment_id 透传。"""
        citations = build_citations(
            [{"segment_id": 3, "doc_id": 4, "chapter": "ch", "page_no": 9, "score": 1.0}]
        )
        self.assertEqual(citations[0].segment_id, 3)
        self.assertEqual(citations[0].chapter, "ch")
        self.assertEqual(citations[0].page_no, 9)

    def test_build_citations_score_none(self):
        """score 缺省时为 None。"""
        citations = build_citations([{"segment_id": 1}])
        self.assertIsNone(citations[0].score)

    def test_build_citations_empty(self):
        """空输入返回空列表。"""
        self.assertEqual(build_citations([]), [])


if __name__ == "__main__":
    unittest.main()