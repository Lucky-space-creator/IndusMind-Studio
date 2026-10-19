# -*- coding: utf-8 -*-
"""app/core/providers/ 单元测试。

lru_cache 单例隔离（经验 2026-10-18-provider-singleton-process-cache-test-isolation）：
涉及 factory 的用例在 finally 中调用 reset_providers() 清缓存，防止污染其他测试。
"""
import sys
import pathlib
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "code" / "ai-service"))

from app.core.errors import AiServiceError  # noqa: E402
from app.core.providers import factory, reset_providers  # noqa: E402
from app.core.providers.http import as_text, bearer  # noqa: E402
from app.core.providers.ollama import OLLAMA_DEFAULT_BASE_URL, OllamaLLM  # noqa: E402
from app.core.providers.openai_compat import (  # noqa: E402
    OpenAICompatEmbedding,
    OpenAICompatLLM,
)
from app.core.providers.reranker import HttpReranker, NoopReranker  # noqa: E402


class TestAsText(unittest.TestCase):
    """http.as_text 响应解析。"""

    def test_as_text_standard_choices(self):
        """标准 choices/message/content 结构。"""
        payload = {"choices": [{"message": {"content": "x"}}]}
        self.assertEqual(as_text(payload), "x")

    def test_as_text_content_stripped(self):
        """content 两侧空白被 strip。"""
        payload = {"choices": [{"message": {"content": "  hi  "}}]}
        self.assertEqual(as_text(payload), "hi")

    def test_as_text_plain_text_fallback(self):
        """content 为 None 时回退 choices[0].text。"""
        payload = {"choices": [{"message": {}, "text": "hello"}]}
        self.assertEqual(as_text(payload), "hello")

    def test_as_text_empty_choices(self):
        """choices 为空列表 → 空串。"""
        self.assertEqual(as_text({"choices": []}), "")

    def test_as_text_empty_payload(self):
        """空 dict → 空串。"""
        self.assertEqual(as_text({}), "")

    def test_as_text_none_payload(self):
        """None 输入 → 空串（不抛错）。"""
        self.assertEqual(as_text(None), "")

    def test_as_text_custom_key(self):
        """自定义 key 取值。"""
        payload = {"choices": [{"message": {"reasoning": "r"}}]}
        self.assertEqual(as_text(payload, key="reasoning"), "r")


class TestBearer(unittest.TestCase):
    """http.bearer 鉴权头。"""

    def test_bearer_empty_key_empty_dict(self):
        """api_key 为空 → {}。"""
        self.assertEqual(bearer(""), {})

    def test_bearer_none_key_empty_dict(self):
        """api_key 为 None → {}。"""
        self.assertEqual(bearer(None), {})

    def test_bearer_non_empty(self):
        """api_key 非空 → Authorization: Bearer xxx。"""
        self.assertEqual(bearer("sk-123"), {"Authorization": "Bearer sk-123"})


class TestNoopReranker(unittest.TestCase):
    """NoopReranker 顺序分。"""

    def test_noop_rerank_descending_scores(self):
        """顺序递减分数：[(0,n),(1,n-1),...]。"""
        results = NoopReranker().rerank("q", ["a", "b", "c"])
        self.assertEqual(results, [(0, 3.0), (1, 2.0), (2, 1.0)])

    def test_noop_rerank_top_n_truncates(self):
        """top_n 截断。"""
        results = NoopReranker().rerank("q", ["a", "b", "c"], top_n=2)
        self.assertEqual(results, [(0, 3.0), (1, 2.0)])

    def test_noop_rerank_empty_documents(self):
        """空文档列表 → 空结果。"""
        self.assertEqual(NoopReranker().rerank("q", []), [])

    def test_noop_disabled(self):
        """enabled 恒 False。"""
        self.assertFalse(NoopReranker().enabled)


class TestHttpReranker(unittest.TestCase):
    """HttpReranker 远端重排与降级。"""

    def _reranker(self):
        return HttpReranker(model="m", base_url="http://rerank.local/v1/", api_key="k")

    def test_http_reranker_remote_scores_used(self):
        """正常返回时使用远端 relevance_score。"""
        payload = {
            "results": [
                {"index": 1, "relevance_score": 0.9},
                {"index": 0, "relevance_score": 0.5},
            ]
        }
        with patch("app.core.providers.reranker.post_json", return_value=payload) as mock_post:
            results = self._reranker().rerank("q", ["a", "b"])
        self.assertEqual(results, [(1, 0.9), (0, 0.5)])
        # 请求 URL 去掉尾部斜杠后拼接 /rerank
        self.assertTrue(mock_post.call_args.args[0].endswith("/v1/rerank"))

    def test_http_reranker_remote_failure_falls_back_noop(self):
        """远端调用抛异常 → 回退 Noop 顺序分。"""
        with patch(
            "app.core.providers.reranker.post_json", side_effect=RuntimeError("down")
        ):
            results = self._reranker().rerank("q", ["a", "b", "c"])
        self.assertEqual(results, [(0, 3.0), (1, 2.0), (2, 1.0)])

    def test_http_reranker_empty_results_falls_back(self):
        """远端返回空 results → 回退 Noop。"""
        with patch("app.core.providers.reranker.post_json", return_value={"results": []}):
            results = self._reranker().rerank("q", ["a", "b"])
        self.assertEqual(results, [(0, 2.0), (1, 1.0)])

    def test_http_reranker_score_alias(self):
        """relevance_score 缺失时用 score 字段。"""
        payload = {"results": [{"index": 0, "score": 0.7}]}
        with patch("app.core.providers.reranker.post_json", return_value=payload):
            results = self._reranker().rerank("q", ["a"])
        self.assertEqual(results, [(0, 0.7)])

    def test_http_reranker_enabled_true(self):
        """enabled 恒 True。"""
        self.assertTrue(self._reranker().enabled)

    def test_http_reranker_empty_documents_no_request(self):
        """空文档直接返回空，不发请求。"""
        with patch(
            "app.core.providers.reranker.post_json", side_effect=AssertionError("不应请求")
        ):
            self.assertEqual(self._reranker().rerank("q", []), [])


class TestFactory(unittest.TestCase):
    """factory 单例构造。"""

    def tearDown(self):
        reset_providers()

    def test_get_llm_invalid_provider_raises(self):
        """非法 provider 名 → AiServiceError。"""
        fake = SimpleNamespace(
            llm_provider="unknown",
            llm_model="m",
            llm_base_url="http://x",
            llm_api_key="",
            llm_timeout=1,
            llm_max_retries=0,
        )
        with patch.object(factory, "settings", fake):
            with self.assertRaises(AiServiceError) as ctx:
                factory.get_llm()
        self.assertIn("不支持的 LLM provider", ctx.exception.message)

    def test_get_llm_valid_provider_constructs(self):
        """合法 provider 能构造对象（不发请求）。"""
        fake = SimpleNamespace(
            llm_provider="ollama",
            llm_model="qwen",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="",
            llm_timeout=5,
            llm_max_retries=1,
        )
        with patch.object(factory, "settings", fake):
            llm = factory.get_llm()
        try:
            self.assertIsInstance(llm, OllamaLLM)
            self.assertEqual(llm.model, "qwen")
        finally:
            del llm

    def test_get_embedder_invalid_provider_raises(self):
        """非法 embedding provider → AiServiceError。"""
        fake = SimpleNamespace(
            embedding_provider="bad",
            embedding_model="m",
            embedding_base_url="http://x",
            embedding_api_key="",
            embedding_dim=8,
            embedding_timeout=1,
            embedding_max_retries=0,
        )
        with patch.object(factory, "settings", fake):
            with self.assertRaises(AiServiceError) as ctx:
                factory.get_embedder()
        self.assertIn("不支持的 Embedding provider", ctx.exception.message)

    def test_get_reranker_disabled_returns_noop(self):
        """reranker 关闭 → NoopReranker。"""
        fake = SimpleNamespace(
            reranker_enabled=False, reranker_model="", reranker_base_url="http://x",
            reranker_api_key="", reranker_timeout=1,
        )
        with patch.object(factory, "settings", fake):
            reranker = factory.get_reranker()
        self.assertIsInstance(reranker, NoopReranker)
        self.assertFalse(reranker.enabled)

    def test_get_reranker_enabled_returns_http(self):
        """reranker 开启且有 model → HttpReranker。"""
        fake = SimpleNamespace(
            reranker_enabled=True, reranker_model="bge-reranker",
            reranker_base_url="http://rerank.local/v1",
            reranker_api_key="k", reranker_timeout=3,
        )
        with patch.object(factory, "settings", fake):
            reranker = factory.get_reranker()
        self.assertIsInstance(reranker, HttpReranker)
        self.assertTrue(reranker.enabled)


class TestOpenAICompat(unittest.TestCase):
    """openai_compat 纯内存方法。"""

    def test_llm_chat_parses_response(self):
        """chat 解析 choices 内容并 strip。"""
        llm = OpenAICompatLLM(model="m", base_url="http://llm.local/v1/")
        payload = {"choices": [{"message": {"content": "  回答  "}}]}
        with patch("app.core.providers.openai_compat.post_json", return_value=payload) as mock_post:
            text = llm.chat([{"role": "user", "content": "q"}])
        self.assertEqual(text, "回答")
        self.assertTrue(mock_post.call_args.args[0].endswith("/v1/chat/completions"))

    def test_llm_chat_empty_content(self):
        """模型返回空内容 → 空串。"""
        llm = OpenAICompatLLM(model="m", base_url="http://llm.local")
        payload = {"choices": [{"message": {"content": ""}}]}
        with patch("app.core.providers.openai_compat.post_json", return_value=payload):
            self.assertEqual(llm.chat([]), "")

    def test_llm_chat_max_tokens_optional(self):
        """max_tokens 可选传递。"""
        llm = OpenAICompatLLM(model="m", base_url="http://llm.local")
        payload = {"choices": [{"message": {"content": "x"}}]}
        with patch("app.core.providers.openai_compat.post_json", return_value=payload) as mock_post:
            llm.chat([], max_tokens=128)
            llm.chat([])
        payloads = [call.args[1] for call in mock_post.call_args_list]
        self.assertEqual(payloads[0]["max_tokens"], 128)
        self.assertNotIn("max_tokens", payloads[1])

    def test_embedding_sorted_by_index(self):
        """embed 按 index 排序返回向量。"""
        embedder = OpenAICompatEmbedding(model="m", base_url="http://e.local", dimension=2)
        payload = {
            "data": [
                {"index": 1, "embedding": [0.4, 0.4]},
                {"index": 0, "embedding": [0.1, 0.2]},
            ]
        }
        with patch("app.core.providers.openai_compat.post_json", return_value=payload):
            vectors = embedder.embed(["a", "b"])
        self.assertEqual(vectors, [[0.1, 0.2], [0.4, 0.4]])

    def test_embedding_dimension_adapted(self):
        """返回向量维度与预设不符时自适应更新 dimension。"""
        embedder = OpenAICompatEmbedding(model="m", base_url="http://e.local", dimension=1024)
        payload = {"data": [{"index": 0, "embedding": [0.1]}]}
        with patch("app.core.providers.openai_compat.post_json", return_value=payload):
            embedder.embed(["a"])
        self.assertEqual(embedder.dimension, 1)

    def test_embedding_empty_texts(self):
        """空输入直接返回空，不发请求。"""
        embedder = OpenAICompatEmbedding(model="m", base_url="http://e.local")
        with patch(
            "app.core.providers.openai_compat.post_json", side_effect=AssertionError("不应请求")
        ):
            self.assertEqual(embedder.embed([]), [])

    def test_ollama_default_base_url(self):
        """OllamaLLM 缺省 base_url 使用默认地址。"""
        llm = OllamaLLM(model="m")
        self.assertEqual(llm.base_url, OLLAMA_DEFAULT_BASE_URL)

    def test_ollama_explicit_base_url_kept(self):
        """显式 base_url 原样保留（去尾斜杠）。"""
        llm = OllamaLLM(model="m", base_url="http://my-ollama:11434/v1/")
        self.assertEqual(llm.base_url, "http://my-ollama:11434/v1")


if __name__ == "__main__":
    unittest.main()