# -*- coding: utf-8 -*-
"""app/rag/retriever.py search 融合排序（mock 集成）单元测试。

patch 目标依据 retriever.py 源码 import 方式：
- from app.core.config import settings → patch app.rag.retriever.settings
- from app.core.providers import get_reranker → patch app.rag.retriever.get_reranker
- from app.rag import repository → patch app.rag.retriever.repository.vector_search / keyword_search
- from app.rag.embedding import embed_query → patch app.rag.retriever.embed_query
"""
import sys
import pathlib
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "code" / "ai-service"))

from app.rag import retriever  # noqa: E402


def _hit(segment_id, score, content="c", doc_id=10, chapter="ch", page_no=3):
    return {
        "segment_id": segment_id,
        "doc_id": doc_id,
        "content": content,
        "chapter": chapter,
        "page_no": page_no,
        "score": score,
    }


class RetrieverSearchTestBase(unittest.TestCase):
    """统一 mock 环境的基类。"""

    def setUp(self):
        # settings 权重与 top_k 固定，防环境变量污染
        fake_settings = SimpleNamespace(
            rag_top_k=5, rag_vector_weight=0.7, rag_keyword_weight=0.3
        )
        self.settings_patcher = patch.object(retriever, "settings", fake_settings)
        self.settings_patcher.start()
        self.addCleanup(self.settings_patcher.stop)

        # reranker 关闭，保证排序只体现融合分
        noop = MagicMock()
        noop.enabled = False
        self.reranker_patcher = patch.object(retriever, "get_reranker", return_value=noop)
        self.reranker_patcher.start()
        self.addCleanup(self.reranker_patcher.stop)

        self.embed_patcher = patch.object(retriever, "embed_query", return_value=[0.1, 0.2])
        self.embed_patcher.start()
        self.addCleanup(self.embed_patcher.stop)

    def _patch_searches(self, vector_hits, keyword_hits):
        vs = patch.object(retriever.repository, "vector_search", return_value=vector_hits)
        ks = patch.object(retriever.repository, "keyword_search", return_value=keyword_hits)
        vs.start()
        ks.start()
        self.addCleanup(vs.stop)
        self.addCleanup(ks.stop)
        return vs, ks


class TestRetrieverSearchFusion(RetrieverSearchTestBase):
    """双路召回融合排序：0.7*vector + 0.3*keyword。"""

    def test_search_fusion_ordering(self):
        """融合分 0.7*向量 + 0.3*关键词 决定排序。"""
        self._patch_searches(
            vector_hits=[_hit(1, 0.9), _hit(2, 0.5)],
            keyword_hits=[_hit(1, 0.2), _hit(2, 0.8)],
        )
        results = retriever.search("q", kb_ids=None, top_k=None, strictness=None)
        # vector_norm: seg1=1.0, seg2=0.0；keyword_norm: seg1=0.0, seg2=1.0
        # seg1 = 0.7*1.0 + 0.3*0.0 = 0.7；seg2 = 0.7*0.0 + 0.3*1.0 = 0.3
        self.assertEqual([r.segment_id for r in results], [1, 2])
        self.assertAlmostEqual(float(results[0].score), 0.7, places=6)
        self.assertAlmostEqual(float(results[1].score), 0.3, places=6)

    def test_search_vector_only_hit(self):
        """仅向量路命中：norm=0 的 segment 融合分 0.0 被 normal 阈值过滤。"""
        self._patch_searches(
            vector_hits=[_hit(1, 0.9), _hit(2, 0.5)],
            keyword_hits=[],
        )
        results = retriever.search("q", kb_ids=None, top_k=None, strictness=None)
        # vector_norm: seg1=1.0, seg2=0.0 → seg1=0.7 保留；seg2=0.0 < 0.15 被过滤
        self.assertEqual([r.segment_id for r in results], [1])
        self.assertAlmostEqual(float(results[0].score), 0.7, places=6)

    def test_search_keyword_only_hit(self):
        """仅关键词路命中：融合分 = 0.3*norm，norm=0 侧被过滤。"""
        self._patch_searches(
            vector_hits=[],
            keyword_hits=[_hit(1, 0.8), _hit(2, 0.4)],
        )
        results = retriever.search("q", kb_ids=None, top_k=None, strictness=None)
        # keyword_norm: seg1=1.0, seg2=0.0 → seg1=0.3 保留；seg2=0.0 < 0.15 被过滤
        self.assertEqual([r.segment_id for r in results], [1])
        self.assertAlmostEqual(float(results[0].score), 0.3, places=6)

    def test_search_hit_fields_assembled(self):
        """结果 SegmentHit 字段组装正确。"""
        self._patch_searches(vector_hits=[_hit(1, 0.9)], keyword_hits=[])
        results = retriever.search("q", kb_ids=[7], top_k=None, strictness=None)
        hit = results[0]
        self.assertEqual(hit.doc_id, 10)
        self.assertEqual(hit.content, "c")
        self.assertEqual(hit.chapter, "ch")
        self.assertEqual(hit.page_no, 3)
        self.assertIsNone(hit.doc_name)

    def test_search_kb_ids_passed_through(self):
        """kb_ids 透传给两路召回。"""
        self._patch_searches([], [])
        retriever.search("q", kb_ids=[7, 8], top_k=None, strictness=None)
        # patch 后 retriever.repository.vector_search / keyword_search 即 mock 对象
        self.assertEqual(retriever.repository.vector_search.call_args.kwargs["kb_ids"], [7, 8])
        self.assertEqual(retriever.repository.keyword_search.call_args.kwargs["kb_ids"], [7, 8])


class TestRetrieverSearchStrictness(RetrieverSearchTestBase):
    """strictness 阈值过滤。"""

    def test_search_strict_filters_low_fusion(self):
        """strict 时融合分 < 0.35 的结果被过滤。"""
        self._patch_searches(
            vector_hits=[_hit(1, 0.9), _hit(2, 0.5)],
            keyword_hits=[_hit(1, 0.2), _hit(2, 0.8)],
        )
        results = retriever.search("q", kb_ids=None, top_k=None, strictness="strict")
        # seg2 融合分 0.3 < 0.35 被过滤
        self.assertEqual([r.segment_id for r in results], [1])

    def test_search_normal_threshold_015(self):
        """normal 阈值 0.15：融合分 0.3 保留、低于 0.15 过滤。"""
        self._patch_searches(
            vector_hits=[_hit(1, 0.9), _hit(2, 0.5)],
            keyword_hits=[_hit(3, 0.6)],
        )
        results = retriever.search("q", kb_ids=None, top_k=None, strictness="normal")
        # vector_norm{1:1,2:0}，keyword_norm{3:1.0} → seg1=0.7, seg2=0.0, seg3=0.3
        self.assertEqual([r.segment_id for r in results], [1, 3])

    def test_search_loose_keeps_all(self):
        """loose 阈值 0.0：全部保留。"""
        self._patch_searches(
            vector_hits=[_hit(1, 0.9), _hit(2, 0.5)],
            keyword_hits=[],
        )
        results = retriever.search("q", kb_ids=None, top_k=None, strictness="loose")
        self.assertEqual([r.segment_id for r in results], [1, 2])

    def test_search_unknown_strictness_falls_back_normal(self):
        """非法严格度兜底 normal 阈值 0.15。"""
        self._patch_searches(
            vector_hits=[_hit(1, 0.9), _hit(2, 0.5)],
            keyword_hits=[],
        )
        results = retriever.search("q", kb_ids=None, top_k=None, strictness="unknown-level")
        # seg2 融合分 0.0 < 0.15 被过滤，与 normal 行为一致
        self.assertEqual([r.segment_id for r in results], [1])

    def test_search_strictness_case_insensitive(self):
        """大写 STRICT 等价 strict。"""
        self._patch_searches(
            vector_hits=[_hit(1, 0.9), _hit(2, 0.5)],
            keyword_hits=[_hit(1, 0.2), _hit(2, 0.8)],
        )
        results = retriever.search("q", kb_ids=None, top_k=None, strictness="STRICT")
        self.assertEqual([r.segment_id for r in results], [1])


class TestRetrieverSearchLimits(RetrieverSearchTestBase):
    """top_k 截断与空结果。"""

    def test_search_top_k_truncates(self):
        """top_k 截断结果数量。"""
        self._patch_searches(
            vector_hits=[_hit(1, 0.9), _hit(2, 0.8), _hit(3, 0.7), _hit(4, 0.6)],
            keyword_hits=[],
        )
        results = retriever.search("q", kb_ids=None, top_k=2, strictness=None)
        self.assertEqual(len(results), 2)
        self.assertEqual([r.segment_id for r in results], [1, 2])

    def test_search_both_empty_returns_empty(self):
        """双路召回全空 → []。"""
        self._patch_searches(vector_hits=[], keyword_hits=[])
        self.assertEqual(retriever.search("q", kb_ids=None, top_k=None, strictness=None), [])

    def test_search_empty_vector_uses_keyword_only(self):
        """embed_query 返回空向量时跳过向量路，仅关键词召回。"""
        with patch.object(retriever, "embed_query", return_value=[]):
            vs, ks = self._patch_searches(
                vector_hits=[_hit(9, 0.99)],  # 不应被使用
                keyword_hits=[_hit(1, 0.8)],
            )
            results = retriever.search("q", kb_ids=None, top_k=None, strictness=None)
        retriever.repository.vector_search.assert_not_called()
        self.assertEqual([r.segment_id for r in results], [1])

    def test_search_keyword_failure_propagates(self):
        """关键词路异常时向上传播（源码无 try/except，按实际行为断言）。"""
        with patch.object(retriever.repository, "vector_search", return_value=[]):
            with patch.object(
                retriever.repository, "keyword_search", side_effect=RuntimeError("db down")
            ):
                with self.assertRaises(RuntimeError):
                    retriever.search("q", kb_ids=None, top_k=None, strictness=None)


if __name__ == "__main__":
    unittest.main()