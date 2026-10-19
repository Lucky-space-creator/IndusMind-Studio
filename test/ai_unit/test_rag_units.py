# -*- coding: utf-8 -*-
"""app/rag/ 纯函数与轻量 mock 单元测试。

lru_cache 进程缓存隔离（经验 2026-10-18-provider-singleton-process-cache-test-isolation）：
所有涉及 get_embedder 的用例均 patch 模块内引用名，并清理 embedding 模块级缓存。
"""
import sys
import pathlib
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "code" / "ai-service"))

from app.core.errors import AiServiceError  # noqa: E402
from app.models.rag import RagDeleteRequest, RagIndexRequest  # noqa: E402
from app.rag import embedding, indexer, repository, retriever  # noqa: E402


class TestRetrieverNormalize(unittest.TestCase):
    """retriever._normalize min-max 归一。"""

    def test_normalize_empty_dict(self):
        """空 dict → 空。"""
        self.assertEqual(retriever._normalize({}), {})

    def test_normalize_equal_values_all_one(self):
        """极差 < 1e-9 时全部归 1.0。"""
        result = retriever._normalize({1: 0.5, 2: 0.5, 3: 0.5})
        self.assertEqual(result, {1: 1.0, 2: 1.0, 3: 1.0})

    def test_normalize_min_max(self):
        """正常 min-max 归一：最小 0、最大 1。"""
        result = retriever._normalize({1: 2.0, 2: 3.0, 3: 6.0})
        self.assertAlmostEqual(result[1], 0.0)
        self.assertAlmostEqual(result[2], 1.0 / 4.0)
        self.assertAlmostEqual(result[3], 1.0)

    def test_normalize_single_entry(self):
        """单条目极差为 0 → 1.0。"""
        self.assertEqual(retriever._normalize({7: 3.0}), {7: 1.0})


class TestStrictnessThreshold(unittest.TestCase):
    """严格度阈值表（模块级常量）。"""

    def test_threshold_table_values(self):
        """loose=0.0 / normal=0.15 / strict=0.35。"""
        table = retriever._STRICTNESS_THRESHOLD
        self.assertEqual(table["loose"], 0.0)
        self.assertEqual(table["normal"], 0.15)
        self.assertEqual(table["strict"], 0.35)

    def test_threshold_lookup_default(self):
        """非法严格度在 search 侧兜底为 0.15（模拟 .get 缺省）。"""
        # 兜底逻辑为 _STRICTNESS_THRESHOLD.get(x, 0.15)，直接验证 get 缺省
        self.assertEqual(retriever._STRICTNESS_THRESHOLD.get("unknown-level", 0.15), 0.15)

    def test_threshold_case_insensitive_key_absent(self):
        """表内键均为小写，大写输入靠 search 内 lower() 处理。"""
        self.assertNotIn("STRICT", retriever._STRICTNESS_THRESHOLD)


class TestVectorLiteral(unittest.TestCase):
    """repository._vector_literal 向量字面量。"""

    def test_vector_literal_format(self):
        """向量 → 8 位小数逗号拼接的中括号字符串。"""
        self.assertEqual(repository._vector_literal([0.5, 0.25]), "[0.50000000,0.25000000]")

    def test_vector_literal_single(self):
        """单元素向量。"""
        self.assertEqual(repository._vector_literal([1]), "[1.00000000]")

    def test_vector_literal_rounding(self):
        """超过 8 位的小数被截断格式化。"""
        self.assertEqual(repository._vector_literal([0.123456789]), "[0.12345679]")

    def test_vector_literal_int_input(self):
        """int 元素被 float 格式化。"""
        self.assertEqual(repository._vector_literal((1, 2)), "[1.00000000,2.00000000]")


class TestIndexerReindex(unittest.TestCase):
    """indexer.reindex_document 业务校验。"""

    def test_reindex_missing_doc_id_raises(self):
        """请求缺 docId → AiServiceError(code=40000)。"""
        request = RagIndexRequest(kbId=1, docId=2, segments=[])
        request.doc_id = None  # pydantic 默认不校验赋值，模拟防御分支
        with self.assertRaises(AiServiceError) as ctx:
            indexer.reindex_document(request)
        self.assertEqual(ctx.exception.code, 40000)

    def test_reindex_deletes_then_indexes(self):
        """正常 reindex：先删旧索引再走索引流程。"""
        request = RagIndexRequest(kbId=1, docId=2, segments=[])
        with patch.object(indexer.repository, "delete_by_doc", return_value=1) as mock_del:
            task_id, status = indexer.reindex_document(request)
        mock_del.assert_called_once_with(2)
        self.assertEqual(status, "success")
        self.assertEqual(len(task_id), 32)

    def test_index_document_no_segments_skips(self):
        """无片段请求直接 success 且不写库。"""
        request = RagIndexRequest(kbId=1, docId=2, segments=[])
        with patch.object(indexer.repository, "upsert_segments") as mock_upsert:
            task_id, status = indexer.index_document(request)
        mock_upsert.assert_not_called()
        self.assertEqual(status, "success")


class TestIndexerDelete(unittest.TestCase):
    """indexer.delete 业务校验。"""

    def test_delete_both_missing_raises(self):
        """kbId/docId 双空 → indexer.delete 防御分支仍抛 AiServiceError(40000)。

        D5 修复后（2026-10-18）模型层 RagDeleteRequest 已先行拦截空 scope
        （见 test_models_validators），正常请求无法构造出双空对象。此处用轻量
        对象绕过模型层，锁定 indexer.delete 自身防御性校验不被删除。
        """
        import types

        request = types.SimpleNamespace(doc_id=None, kb_id=None)
        with self.assertRaises(AiServiceError) as ctx:
            indexer.delete(request)
        self.assertEqual(ctx.exception.code, 40000)

    def test_delete_by_doc_id(self):
        """有 docId 时按文档删除。"""
        with patch.object(indexer.repository, "delete_by_doc", return_value=7) as mock_del:
            affected = indexer.delete(RagDeleteRequest(docId=5))
        mock_del.assert_called_once_with(5)
        self.assertEqual(affected, 7)

    def test_delete_by_kb_id_fallback(self):
        """仅 kbId 时按知识库删除。"""
        with patch.object(indexer.repository, "delete_by_kb", return_value=9) as mock_del:
            affected = indexer.delete(RagDeleteRequest(kbId=3))
        mock_del.assert_called_once_with(3)
        self.assertEqual(affected, 9)


class TestEmbeddingCache(unittest.TestCase):
    """embedding.embed_texts 进程内缓存。"""

    def setUp(self):
        embedding._CACHE.clear()
        self.embedder = MagicMock()
        self.embedder.embed = MagicMock(side_effect=lambda texts: [[0.1, 0.2] for _ in texts])
        patcher = patch.object(embedding, "get_embedder", return_value=self.embedder)
        patcher.start()
        self.addCleanup(patcher.stop)

    def tearDown(self):
        embedding._CACHE.clear()

    def test_embed_texts_cached_second_call(self):
        """相同文本第二次调用不再请求 embedder。"""
        first = embedding.embed_texts(["文本A"])
        second = embedding.embed_texts(["文本A"])
        self.assertEqual(first, second)
        self.assertEqual(self.embedder.embed.call_count, 1)

    def test_embed_texts_different_text_calls_embedder(self):
        """不同文本正常调用 embedder。"""
        embedding.embed_texts(["文本A"])
        embedding.embed_texts(["文本B"])
        self.assertEqual(self.embedder.embed.call_count, 2)
        self.assertEqual(self.embedder.embed.call_args_list[1], ((["文本B"],), {}))

    def test_embed_texts_mixed_cache_and_missing(self):
        """混合输入时只对缺失文本发起请求。"""
        embedding.embed_texts(["文本A"])
        result = embedding.embed_texts(["文本A", "文本B"])
        # 第二次调用仅对“文本B”发起 embed
        self.assertEqual(self.embedder.embed.call_count, 2)
        self.assertEqual(self.embedder.embed.call_args_list[1], ((["文本B"],), {}))
        self.assertEqual(result, [[0.1, 0.2], [0.1, 0.2]])

    def test_embed_texts_empty_list(self):
        """空列表直接返回空。"""
        self.assertEqual(embedding.embed_texts([]), [])
        self.embedder.embed.assert_not_called()

    def test_embed_query_uses_single_text(self):
        """embed_query 复用 embed_texts 单文本路径。"""
        vector = embedding.embed_query("问题")
        self.assertEqual(vector, [0.1, 0.2])
        self.assertEqual(self.embedder.embed.call_count, 1)


if __name__ == "__main__":
    unittest.main()