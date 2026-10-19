# -*- coding: utf-8 -*-
"""app/api/ + app/main.py TestClient 集成测试。

信封断言模板（经验 2026-10-18-fastapi-error-envelope-http200-assertion）：
- 业务成功：HTTP 200 + code=0 + message="ok"
- 业务失败：HTTP 200 + code=<错误码> + data=None（全局 handler 均 JSONResponse(200)）
- 参数校验失败：HTTP 200 + code=40001
- 未匹配路由：HTTP 404 + {"detail": ...}（框架默认，非信封）

环境说明：TestClient 依赖 anyio 阻塞 portal（Windows asyncio 事件循环构造需要
socket.socketpair，其内部使用 127.0.0.1 回环 TCP）。若执行环境沙箱拦截回环连接，
本文件全部用例自动 skip（非产品缺陷）；同等断言点由
test_api_routes_direct.py（裸协程直驱 ASGI handler，无事件循环）覆盖。
"""
import socket
import sys
import pathlib
import unittest
from decimal import Decimal
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "code" / "ai-service"))


def _loopback_available() -> bool:
    """探测 socketpair（Windows 上经 127.0.0.1 回环实现）是否可用。"""
    try:
        a, b = socket.socketpair()
    except OSError:
        return False
    a.close()
    b.close()
    return True


TESTCLIENT_OK = _loopback_available()
TESTCLIENT_SKIP_REASON = (
    "执行环境沙箱拦截 127.0.0.1 回环连接，asyncio 事件循环（socketpair）不可用，"
    "TestClient 无法运行；同等断言点见 test_api_routes_direct.py"
)

from fastapi.testclient import TestClient  # noqa: E402

import app.api.chat as chat_api  # noqa: E402
import app.api.diagnosis as diag_api  # noqa: E402
import app.api.rag as rag_api  # noqa: E402
from app.core.errors import AiServiceError, ErrorCode  # noqa: E402
from app.main import app  # noqa: E402
from app.models.chat import ChatResponse  # noqa: E402
from app.models.diagnosis import DiagnosisRunResponse, StepResult  # noqa: E402
from app.models.graph import GraphSyncResponse  # noqa: E402
from app.models.rag import SegmentHit  # noqa: E402

# raise_server_exceptions=False：starlette ServerErrorMiddleware 即使由
# @app.exception_handler(Exception) 生成 50000 信封响应后仍会 re-raise 异常
# （便于服务器日志/测试客户端感知），TestClient 默认 True 会把异常抛进测试。
# 生产环境实际返回 HTTP 200 + code=50000 信封，故此处关闭重抛以断言响应体。
client = TestClient(app, raise_server_exceptions=False)


@unittest.skipUnless(TESTCLIENT_OK, TESTCLIENT_SKIP_REASON)
class TestHealth(unittest.TestCase):
    """/health 健康检查。"""

    def test_health_ok_envelope(self):
        """健康检查返回 code=0 与服务名。"""
        resp = client.get("/health")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["message"], "ok")
        self.assertEqual(body["data"]["service"], "hwc-ai-service")
        self.assertEqual(body["data"]["version"], "1.0.0")
        self.assertEqual(len(body["traceId"]), 32)


@unittest.skipUnless(TESTCLIENT_OK, TESTCLIENT_SKIP_REASON)
class TestTraceMiddleware(unittest.TestCase):
    """trace 中间件与响应头。"""

    def test_trace_id_header_echoed(self):
        """X-Trace-Id 请求头回显，且与信封 traceId 一致。"""
        with patch.object(chat_api.agent, "answer", return_value=ChatResponse(answer="a", hit=True)):
            resp = client.post(
                "/chat", json={"question": "q"}, headers={"X-Trace-Id": "my-trace-123"}
            )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers["X-Trace-Id"], "my-trace-123")
        body = resp.json()
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["traceId"], "my-trace-123")

    def test_response_time_header_present(self):
        """X-Response-Time 响应头存在且带 ms 后缀。"""
        resp = client.get("/health")
        self.assertIn("X-Response-Time", resp.headers)
        self.assertTrue(resp.headers["X-Response-Time"].endswith("ms"))

    def test_unknown_route_404_plain_detail(self):
        """未匹配路由：HTTP 404 + 框架默认 detail（非信封结构）。"""
        resp = client.get("/not-exist-route")
        self.assertEqual(resp.status_code, 404)
        body = resp.json()
        self.assertNotIn("code", body)
        self.assertIn("detail", body)


@unittest.skipUnless(TESTCLIENT_OK, TESTCLIENT_SKIP_REASON)
class TestRagRoutes(unittest.TestCase):
    """/rag/* 路由。"""

    def test_rag_search_success_envelope(self):
        """mock 检索层 → code=0 信封 + segments 数据。"""
        hit = SegmentHit(
            segmentId=1, docId=2, docName="手册", chapter="ch", pageNo=3,
            content="内容", score=Decimal("0.9"),
        )
        with patch.object(rag_api.retriever, "search", return_value=[hit]) as mock_search:
            resp = client.post("/rag/search", json={"query": "密封件", "kbIds": [1], "topK": 5})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["message"], "ok")
        self.assertEqual(body["data"]["segments"][0]["segmentId"], 1)
        self.assertEqual(body["data"]["segments"][0]["docName"], "手册")
        mock_search.assert_called_once_with(
            "密封件", kb_ids=[1], top_k=5, strictness=None
        )

    def test_rag_search_missing_query_validation_error(self):
        """缺必填 query → HTTP 200 + code=40001。"""
        resp = client.post("/rag/search", json={"kbIds": [1]})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["code"], 40001)
        self.assertIsNone(body["data"])
        self.assertIn("参数校验失败", body["message"])

    def test_rag_search_unknown_field_rejected(self):
        """多传未知字段 → code=40001。"""
        resp = client.post("/rag/search", json={"query": "q", "foo": 1})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["code"], 40001)

    def test_rag_search_blank_query_reaches_business(self):
        """query 空串无模型层校验，透传业务层（行为锁定）。"""
        with patch.object(rag_api.retriever, "search", return_value=[]) as mock_search:
            resp = client.post("/rag/search", json={"query": ""})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["code"], 0)
        mock_search.assert_called_once()

    def test_rag_delete_success(self):
        """mock 删除 → code=0 + affected。"""
        with patch.object(rag_api.indexer, "delete", return_value=3):
            resp = client.post("/rag/delete", json={"docId": 5})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["data"]["affected"], 3)

    def test_rag_delete_empty_body_validation_error(self):
        """空 body → 模型层拦截 → code=40001（D5 修复后行为，2026-10-18）。"""
        resp = client.post("/rag/delete", json={})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["code"], 40001)
        self.assertIsNone(body["data"])

    def test_rag_index_success(self):
        """mock 索引 → code=0 + taskId/status。"""
        with patch.object(
            rag_api.indexer, "index_document", return_value=("task-1", "success")
        ) as mock_index:
            resp = client.post(
                "/rag/index",
                json={
                    "kbId": 1,
                    "docId": 2,
                    "segments": [{"segmentId": 1, "content": "c"}],
                },
            )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["data"]["taskId"], "task-1")
        self.assertEqual(body["data"]["status"], "success")
        mock_index.assert_called_once()


@unittest.skipUnless(TESTCLIENT_OK, TESTCLIENT_SKIP_REASON)
class TestChatRoute(unittest.TestCase):
    """/chat 路由。"""

    def test_chat_success_envelope(self):
        """mock 单 Agent → code=0 + answer/hit。"""
        chat_resp = ChatResponse(
            answer="回答内容",
            citations=[{"docId": 1, "segmentId": 2}],
            hit=True,
            traceId="t",
        )
        with patch.object(chat_api.agent, "answer", return_value=chat_resp) as mock_answer:
            resp = client.post(
                "/chat", json={"question": "怎么换密封件", "kbIds": [1], "matchStrictness": "strict"}
            )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["data"]["answer"], "回答内容")
        self.assertTrue(body["data"]["hit"])
        self.assertEqual(body["data"]["citations"][0]["docId"], 1)
        mock_answer.assert_called_once_with(
            "怎么换密封件", kb_ids=[1], strictness="strict", trace_id=mock_answer.call_args.kwargs["trace_id"]
        )

    def test_chat_blank_question_validation_error(self):
        """question 空白 → HTTP 200 + code=40001。"""
        resp = client.post("/chat", json={"question": "   "})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["code"], 40001)

    def test_chat_missing_question_validation_error(self):
        """缺 question → code=40001。"""
        resp = client.post("/chat", json={})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["code"], 40001)

    def test_chat_unknown_field_rejected(self):
        """多传未知字段 → code=40001。"""
        resp = client.post("/chat", json={"question": "q", "foo": "bar"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["code"], 40001)


@unittest.skipUnless(TESTCLIENT_OK, TESTCLIENT_SKIP_REASON)
class TestDiagnosisRoute(unittest.TestCase):
    """/diagnosis/run 路由。"""

    def test_diagnosis_run_success(self):
        """mock 编排层 → code=0 + DiagnosisRunResponse 结构。"""
        run_resp = DiagnosisRunResponse(
            runId="run-1",
            steps=[StepResult(stepOrder=1, agentCode="monitor", status="success", summary="s")],
            conclusion="结论",
            riskLevel="high",
            citations=[],
            traceId="t",
        )
        with patch.object(diag_api, "run_diagnosis", return_value=run_resp) as mock_run:
            resp = client.post("/diagnosis/run", json={"deviceId": 1, "phenomenon": "异响"})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["data"]["runId"], "run-1")
        self.assertEqual(body["data"]["steps"][0]["agentCode"], "monitor")
        self.assertEqual(body["data"]["riskLevel"], "high")
        mock_run.assert_called_once()

    def test_diagnosis_run_invalid_anomalies_type(self):
        """anomalies 类型非法 → code=40001。"""
        resp = client.post("/diagnosis/run", json={"anomalies": "not-a-list"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["code"], 40001)


@unittest.skipUnless(TESTCLIENT_OK, TESTCLIENT_SKIP_REASON)
class TestGraphRoutes(unittest.TestCase):
    """/graph/* 路由（原 D4 缺陷已修复：2026-10-18）。

    修复内容：app/graphrag/__init__.py 不再遮蔽包属性 query 为函数，app/api/graph.py:5
    `from app.graphrag import query as graph_query` 拿到子模块，graph_query.extract/
    query/sync 正常调用。此处 mock 模块级函数以隔离图库存储依赖，断言成功信封。
    """

    def test_graph_extract_success(self):
        """/graph/extract → code=0 + 边列表（D4 修复后行为）。"""
        with patch("app.graphrag.query.extract", return_value=[]) as mock_extract:
            resp = client.post(
                "/graph/extract",
                json={
                    "kbId": 1,
                    "segments": [
                        {"segmentId": 1, "content": "液压泵异常"},
                        {"segmentId": 2, "content": "液压泵检修"},
                    ],
                },
            )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        mock_extract.assert_called_once()
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["message"], "ok")
        self.assertEqual(body["data"], [])

    def test_graph_query_success(self):
        """/graph/query → code=0 + nodes（D4 修复后行为）。"""
        with patch("app.graphrag.query.query", return_value=[]) as mock_query:
            resp = client.post("/graph/query", json={"nodeRefId": 1, "depth": 2})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        mock_query.assert_called_once()
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["data"]["nodes"], [])

    def test_graph_sync_success(self):
        """/graph/sync → code=0 + kbId/nodeCount（D4 修复后行为）。"""
        with patch(
            "app.graphrag.query.sync",
            return_value=GraphSyncResponse(kbId=1, nodeCount=0, edgeCount=0),
        ) as mock_sync:
            resp = client.post("/graph/sync", json={"kbId": 1, "nodes": [], "edges": []})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        mock_sync.assert_called_once()
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["data"]["kbId"], 1)
        self.assertEqual(body["data"]["nodeCount"], 0)

    def test_graph_query_validation_error(self):
        """/graph/query 缺 nodeRefId → code=40001（校验层先于业务触发）。"""
        resp = client.post("/graph/query", json={})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["code"], 40001)


@unittest.skipUnless(TESTCLIENT_OK, TESTCLIENT_SKIP_REASON)
class TestAiServiceErrorHandler(unittest.TestCase):
    """AiServiceError 全局处理器。"""

    def test_ai_service_error_mapped_to_code(self):
        """业务层抛 AiServiceError(50302) → HTTP 200 + code=50302。"""
        with patch.object(
            rag_api.retriever,
            "search",
            side_effect=AiServiceError(ErrorCode.VECTOR_UNAVAILABLE, "向量库暂不可用，请稍后重试"),
        ):
            resp = client.post("/rag/search", json={"query": "q"})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["code"], 50302)
        self.assertIn("向量库暂不可用", body["message"])
        self.assertIsNone(body["data"])

    def test_unhandled_exception_mapped_to_50000(self):
        """业务层抛普通异常 → HTTP 200 + code=50000。"""
        with patch.object(
            chat_api.agent, "answer", side_effect=RuntimeError("unexpected")
        ):
            resp = client.post("/chat", json={"question": "q"})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["code"], 50000)
        self.assertEqual(body["message"], "服务内部错误，请稍后重试")


if __name__ == "__main__":
    unittest.main()