# -*- coding: utf-8 -*-
"""app/models/*.py pydantic 校验器与边界单元测试。

字段分类（经验 2026-10-18-pydantic-validation-boundary-test-design）：
- raise 型：target_status / doc_id 双空 / question 空白 → ValidationError
- clamp 型：depth 夹紧 [1,5]，不抛异常
"""
import sys
import pathlib
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "code" / "ai-service"))

from pydantic import ValidationError  # noqa: E402

from app.models.chat import ChatRequest  # noqa: E402
from app.models.common import CamelModel, Citation  # noqa: E402
from app.models.graph import GraphQueryRequest  # noqa: E402
from app.models.rag import (  # noqa: E402
    RagDeleteRequest,
    RagDocumentStatusRequest,
    SegmentItem,
)


class TestRagDocumentStatusRequest(unittest.TestCase):
    """targetStatus 验证器（raise 型，带 strip+lower 归一）。"""

    def test_target_status_enabled_pass(self):
        """enabled 通过。"""
        req = RagDocumentStatusRequest(docIds=[1], targetStatus="enabled")
        self.assertEqual(req.target_status, "enabled")

    def test_target_status_disabled_pass(self):
        """disabled 通过。"""
        req = RagDocumentStatusRequest(docIds=[], targetStatus="disabled")
        self.assertEqual(req.target_status, "disabled")

    def test_target_status_uppercase_normalized(self):
        """大写输入合法且被归一为小写。"""
        req = RagDocumentStatusRequest(docIds=[], targetStatus=" ENABLED ")
        self.assertEqual(req.target_status, "enabled")

    def test_target_status_invalid_raises(self):
        """非法取值抛 ValidationError。"""
        with self.assertRaises(ValidationError):
            RagDocumentStatusRequest(docIds=[], targetStatus="paused")

    def test_target_status_missing_raises(self):
        """缺 targetStatus 抛 ValidationError。"""
        with self.assertRaises(ValidationError):
            RagDocumentStatusRequest(docIds=[])


class TestRagDeleteRequest(unittest.TestCase):
    """kbId/docId 至少一个（raise 型）。"""

    def test_delete_with_doc_id_only_pass(self):
        """仅 docId 通过。"""
        req = RagDeleteRequest(docId=5)
        self.assertEqual(req.doc_id, 5)

    def test_delete_with_kb_id_only_pass(self):
        """仅 kbId 通过。"""
        req = RagDeleteRequest(kbId=3)
        self.assertEqual(req.kb_id, 3)

    def test_delete_both_present_pass(self):
        """两者均提供通过。"""
        req = RagDeleteRequest(kbId=3, docId=5)
        self.assertEqual((req.kb_id, req.doc_id), (3, 5))

    def test_delete_both_missing_raises(self):
        """显式传双 None 抛 ValidationError。"""
        with self.assertRaises(ValidationError):
            RagDeleteRequest(kbId=None, docId=None)

    def test_delete_explicit_doc_none_raises(self):
        """仅显式传 docId=None（kbId 缺省）抛 ValidationError。"""
        with self.assertRaises(ValidationError):
            RagDeleteRequest(docId=None)

    def test_delete_all_default_raises(self):
        """全缺省构造触发 _require_scope → 抛 ValidationError（D5 修复后行为）。

        修复内容（2026-10-18）：pydantic v2 field_validator 默认
        validate_default=False，字段未提供（走默认值 None）时验证器不运行，
        "kbId 与 docId 至少提供一个"在空请求体场景被绕过。修复方式为
        doc_id 增加 Field(default=None, alias="docId", validate_default=True)，
        使全缺省构造也运行验证器。空 body 现由模型层拦截，路由返回 code=40001。
        """
        with self.assertRaises(ValidationError):
            RagDeleteRequest()

    def test_delete_doc_id_zero_pass(self):
        """docId=0 非 None，视为已提供。"""
        req = RagDeleteRequest(docId=0)
        self.assertEqual(req.doc_id, 0)


class TestGraphQueryRequestDepth(unittest.TestCase):
    """depth 夹紧（clamp 型，不抛异常）。"""

    def test_depth_none_defaults_one(self):
        """depth=None → 1。"""
        req = GraphQueryRequest(nodeRefId=1, depth=None)
        self.assertEqual(req.depth, 1)

    def test_depth_default_is_one(self):
        """不传 depth 默认 1。"""
        req = GraphQueryRequest(nodeRefId=1)
        self.assertEqual(req.depth, 1)

    def test_depth_zero_clamped_to_one(self):
        """depth=0 → 夹紧为 1。"""
        req = GraphQueryRequest(nodeRefId=1, depth=0)
        self.assertEqual(req.depth, 1)

    def test_depth_negative_clamped_to_one(self):
        """depth=-1 → 夹紧为 1。"""
        req = GraphQueryRequest(nodeRefId=1, depth=-1)
        self.assertEqual(req.depth, 1)

    def test_depth_nine_clamped_to_five(self):
        """depth=9 → 夹紧为 5。"""
        req = GraphQueryRequest(nodeRefId=1, depth=9)
        self.assertEqual(req.depth, 5)

    def test_depth_three_unchanged(self):
        """depth=3 原样保留。"""
        req = GraphQueryRequest(nodeRefId=1, depth=3)
        self.assertEqual(req.depth, 3)


class TestChatRequest(unittest.TestCase):
    """question 空白校验（raise 型 + 归一 strip）。"""

    def test_question_blank_raises(self):
        """纯空白 question 抛 ValidationError。"""
        with self.assertRaises(ValidationError):
            ChatRequest(question="  ")

    def test_question_empty_raises(self):
        """空串 question 抛 ValidationError。"""
        with self.assertRaises(ValidationError):
            ChatRequest(question="")

    def test_question_stripped(self):
        """正常 question 被去除两侧空白。"""
        req = ChatRequest(question="  泵压力异常？  ")
        self.assertEqual(req.question, "泵压力异常？")

    def test_question_normal(self):
        """正常 question 原样。"""
        req = ChatRequest(question="如何更换密封件")
        self.assertEqual(req.question, "如何更换密封件")


class TestExtraForbid(unittest.TestCase):
    """CamelModel extra=forbid：未知字段一律拒绝。"""

    def test_segment_item_extra_field_rejected(self):
        """SegmentItem 多传未知字段抛 ValidationError。"""
        with self.assertRaises(ValidationError):
            SegmentItem(segmentId=1, content="c", unknownField=1)

    def test_chat_request_extra_field_rejected(self):
        """ChatRequest 多传未知字段抛 ValidationError。"""
        with self.assertRaises(ValidationError):
            ChatRequest(question="q", foo="bar")

    def test_graph_query_request_extra_field_rejected(self):
        """GraphQueryRequest 多传未知字段抛 ValidationError。"""
        with self.assertRaises(ValidationError):
            GraphQueryRequest(nodeRefId=1, extra=1)

    def test_citation_extra_field_rejected(self):
        """Citation 多传未知字段抛 ValidationError。"""
        with self.assertRaises(ValidationError):
            Citation(docId=1, segmentId=2, bad=3)


class TestCamelModelPopulateByName(unittest.TestCase):
    """populate_by_name：snake_case 与 camelCase 均可构造。"""

    def test_segment_item_by_alias(self):
        """camelCase 别名构造。"""
        item = SegmentItem(segmentId=9, content="x")
        self.assertEqual(item.segment_id, 9)

    def test_segment_item_by_field_name(self):
        """snake_case 字段名构造。"""
        item = SegmentItem(segment_id=9, content="x")
        self.assertEqual(item.segment_id, 9)

    def test_citation_by_field_name(self):
        """Citation snake_case 构造。"""
        citation = Citation(doc_id=1, segment_id=2, page_no=3)
        self.assertEqual((citation.doc_id, citation.segment_id, citation.page_no), (1, 2, 3))

    def test_citation_by_alias(self):
        """Citation camelCase 构造。"""
        citation = Citation(docId=1, segmentId=2, pageNo=3)
        self.assertEqual((citation.doc_id, citation.segment_id, citation.page_no), (1, 2, 3))

    def test_model_dump_by_alias(self):
        """dump(by_alias=True) 输出 camelCase。"""
        citation = Citation(docId=1, segmentId=2)
        data = citation.model_dump(by_alias=True)
        self.assertIn("docId", data)
        self.assertIn("segmentId", data)


if __name__ == "__main__":
    unittest.main()