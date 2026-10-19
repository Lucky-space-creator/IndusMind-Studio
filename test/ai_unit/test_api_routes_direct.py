# -*- coding: utf-8 -*-
"""app/api/ + app/main.py 直调测试（不依赖 asyncio 事件循环）。

背景：TestClient（test_api_routes.py）在拦截 127.0.0.1 回环的沙箱环境不可用
（Windows asyncio 事件循环构造依赖 socketpair → 回环 TCP）。本文件用裸协程
驱动器直调 ASGI handler / exception handler / 中间件，覆盖同等断言点：

- 各路由 handler 直调（业务 mock + 信封结构）
- pydantic 校验失败 → RequestValidationError → 全局 handler → code=40001
- AiServiceError / 未捕获异常 handler → 50302 / 50000
- trace_id_middleware 直调（X-Trace-Id / X-Response-Time）
- 缺陷 D4 回归锁定：包属性 app.graphrag.query 必须为子模块（含 extract/query/sync）
"""
import sys
import pathlib
import unittest
from decimal import Decimal
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "code" / "ai-service"))

from fastapi.exceptions import RequestValidationError  # noqa: E402
from pydantic import ValidationError  # noqa: E402
from starlette.requests import Request  # noqa: E402
from starlette.responses import PlainTextResponse  # noqa: E402

import app.api.chat as chat_api  # noqa: E402
import app.api.diagnosis as diag_api  # noqa: E402
import app.api.rag as rag_api  # noqa: E402
from app.api.chat import chat as chat_handler  # noqa: E402
from app.api.diagnosis import run as diagnosis_run_handler  # noqa: E402
from app.api.graph import extract as graph_extract_handler  # noqa: E402
from app.api.graph import query as graph_query_handler  # noqa: E402
from app.api.graph import sync as graph_sync_handler  # noqa: E402
from app.api.rag import delete as rag_delete_handler  # noqa: E402
from app.api.rag import index as rag_index_handler  # noqa: E402
from app.api.rag import search as rag_search_handler  # noqa: E402
from app.core.errors import AiServiceError, ErrorCode  # noqa: E402
from app.main import (  # noqa: E402
    ai_service_error_handler,
    health as health_handler,
    trace_id_middleware,
    unhandled_error_handler,
    validation_error_handler,
)
from app.models.chat import ChatRequest, ChatResponse  # noqa: E402
from app.models.diagnosis import DiagnosisRunRequest, DiagnosisRunResponse, StepResult  # noqa: E402
from app.models.graph import (  # noqa: E402
    CandidateEdge,
    GraphExtractRequest,
    GraphQueryRequest,

    GraphSyncRequest,
    GraphSyncResponse,
    RelatedNode,
)
from app.models.rag import RagDeleteRequest, RagIndexRequest, RagSearchRequest, SegmentHit  # noqa: E402


def run_coro(coro):
    """裸协程驱动器：适用于内部只 await 裸协程的 async 函数。

    我们的 handler / exception handler / trace 中间件均为简单 async def，
    无 Task/Future/IO，可直接 send(None) 驱动至完成。
    """
    try:
        coro.send(None)
    except StopIteration as exc:
        return exc.value
    raise RuntimeError("协程挂起了需要事件循环的对象")


def _request(path="/x", headers=(), state=None):
    scope = {
        "type": "http",
        "method": "POST",
        "path": path,
        "headers": list(headers),
        "query_string": b"",
    }
    if state is not None:
        scope["state"] = state
    return Request(scope)


class TestHealthHandlerDirect(unittest.TestCase):
    """health handler 直调。"""

    def test_health_handler_envelope(self):
        """health 返回 code=0、服务名与版本。"""
        body = run_coro(health_handler(_request("/health")))
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["message"], "ok")
        self.assertEqual(body["data"]["service"], "hwc-ai-service")
        self.assertEqual(body["data"]["version"], "1.0.0")
        self.assertEqual(len(body["traceId"]), 32)


class TestExceptionHandlersDirect(unittest.TestCase):
    """main.py 三个全局 exception handler 直调（HTTP 200 + 信封）。"""

    def _req(self):
        return _request(state={"trace_id": "t-1"})

    def test_validation_error_handler_40001(self):
        """RequestValidationError → HTTP 200 + code=40001 + message 含首条原因。"""
        exc = RequestValidationError(
            [{"type": "missing", "loc": ("body", "query"), "msg": "Field required", "input": {}}]
        )
        resp = run_coro(validation_error_handler(self._req(), exc))
        self.assertEqual(resp.status_code, 200)
        import json

        body = json.loads(resp.body)
        self.assertEqual(body["code"], 40001)
        self.assertIn("Field required", body["message"])
        self.assertIsNone(body["data"])
        self.assertEqual(body["traceId"], "t-1")

    def test_ai_service_error_handler_maps_code(self):
        """AiServiceError(50302) → HTTP 200 + code=50302。"""
        exc = AiServiceError(ErrorCode.VECTOR_UNAVAILABLE, "向量库暂不可用，请稍后重试")
        resp = run_coro(ai_service_error_handler(self._req(), exc))
        self.assertEqual(resp.status_code, 200)
        import json

        body = json.loads(resp.body)
        self.assertEqual(body["code"], 50302)
        self.assertIn("向量库暂不可用", body["message"])
        self.assertIsNone(body["data"])

    def test_unhandled_error_handler_50000(self):
        """未捕获异常 → HTTP 200 + code=50000 + 固定文案。"""
        resp = run_coro(unhandled_error_handler(self._req(), RuntimeError("boom")))
        self.assertEqual(resp.status_code, 200)
        import json

        body = json.loads(resp.body)
        self.assertEqual(body["code"], 50000)
        self.assertEqual(body["message"], "服务内部错误，请稍后重试")
        self.assertIsNone(body["data"])

    def test_validation_from_pydantic_model(self):
        """pydantic ValidationError.errors() 可直接构造 RequestValidationError（链路等价）。"""
        try:
            RagSearchRequest.model_validate({})
        except ValidationError as exc:
            request_validation = RequestValidationError(exc.errors())
        else:
            self.fail("应抛 ValidationError")
        resp = run_coro(validation_error_handler(self._req(), request_validation))
        self.assertEqual(resp.status_code, 200)
        import json

        self.assertEqual(json.loads(resp.body)["code"], 40001)


class TestTraceMiddlewareDirect(unittest.TestCase):
    """trace_id_middleware 直调。"""

    def test_middleware_trace_id_echoed(self):
        """X-Trace-Id 请求头回显。"""

        async def call_next(req):
            return PlainTextResponse("ok")

        request = _request("/chat", headers=[(b"x-trace-id", b"my-trace")])
        resp = run_coro(trace_id_middleware(request, call_next))
        self.assertEqual(resp.headers["x-trace-id"], "my-trace")
        self.assertEqual(resp.status_code, 200)

    def test_middleware_generates_trace_id(self):
        """无请求头时自动生成 32 位 hex。"""

        async def call_next(req):
            return PlainTextResponse("ok")

        request = _request("/chat")
        resp = run_coro(trace_id_middleware(request, call_next))
        self.assertEqual(len(resp.headers["x-trace-id"]), 32)

    def test_middleware_response_time_header(self):
        """X-Response-Time 响应头存在且带 ms 后缀。"""

        async def call_next(req):
            return PlainTextResponse("ok")

        resp = run_coro(trace_id_middleware(_request("/chat"), call_next))
        self.assertTrue(resp.headers["x-response-time"].endswith("ms"))

    def test_middleware_sets_request_state(self):
        """中间件把 trace_id 写入 request.state 供 handler 使用。"""
        captured = {}

        async def call_next(req):
            captured["trace_id"] = getattr(req.state, "trace_id", None)
            return PlainTextResponse("ok")

        run_coro(trace_id_middleware(_request("/chat", headers=[(b"x-trace-id", b"abc")]), call_next))
        self.assertEqual(captured["trace_id"], "abc")


class TestRagHandlersDirect(unittest.TestCase):
    """rag 路由 handler 直调。"""

    def test_rag_search_handler_success(self):
        """mock 检索层 → 信封 code=0 + segments。"""
        hit = SegmentHit(
            segmentId=1, docId=2, docName="手册", chapter="ch", pageNo=3,
            content="内容", score=Decimal("0.9"),
        )
        with patch.object(rag_api.retriever, "search", return_value=[hit]) as mock_search:
            body = run_coro(rag_search_handler(RagSearchRequest(query="密封件", kbIds=[1], topK=5), "t-1"))
        mock_search.assert_called_once_with("密封件", kb_ids=[1], top_k=5, strictness=None)
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["message"], "ok")
        self.assertEqual(body["traceId"], "t-1")
        self.assertEqual(body["data"]["segments"][0]["segmentId"], 1)
        self.assertEqual(body["data"]["segments"][0]["docName"], "手册")

    def test_rag_search_handler_empty_result(self):
        """空结果 → data.segments 为空列表。"""
        with patch.object(rag_api.retriever, "search", return_value=[]):
            body = run_coro(rag_search_handler(RagSearchRequest(query="q"), "t"))
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["data"]["segments"], [])

    def test_rag_delete_handler_success(self):
        """mock 删除 → affected 回传。"""
        with patch.object(rag_api.indexer, "delete", return_value=3):
            body = run_coro(rag_delete_handler(RagDeleteRequest(docId=5), "t"))
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["data"]["affected"], 3)

    def test_rag_index_handler_success(self):
        """mock 索引 → taskId/status 回传。"""
        request = RagIndexRequest(
            kbId=1, docId=2, segments=[{"segmentId": 1, "content": "c"}]
        )
        with patch.object(rag_api.indexer, "index_document", return_value=("task-1", "success")):
            body = run_coro(rag_index_handler(request, "t"))
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["data"]["taskId"], "task-1")
        self.assertEqual(body["data"]["status"], "success")

    def test_rag_delete_empty_scope_validation_error(self):
        """空删除范围 → 模型层拦截 ValidationError（D5 修复后行为）。

        修复内容（2026-10-18）：RagDeleteRequest.doc_id 增加
        Field(default=None, alias="docId", validate_default=True)，
        使全缺省构造也运行 _require_scope 验证器。空 body 请求在进入业务层前
        即被 pydantic 拒绝，由全局 validation_error_handler 返回 code=40001
        （不再依赖 indexer.delete 业务层 40000 兜底）。
        """
        with self.assertRaises(ValidationError):
            RagDeleteRequest()


class TestChatHandlerDirect(unittest.TestCase):
    """chat 路由 handler 直调。"""

    def test_chat_handler_success(self):
        """mock 单 Agent → 信封 + answer/hit/citations。"""
        chat_resp = ChatResponse(
            answer="回答内容",
            citations=[{"docId": 1, "segmentId": 2}],
            hit=True,
            traceId="t",
        )
        with patch.object(chat_api.agent, "answer", return_value=chat_resp) as mock_answer:
            body = run_coro(
                chat_handler(ChatRequest(question="怎么换密封件", kbIds=[1], matchStrictness="strict"), "t-9")
            )
        self.assertEqual(mock_answer.call_args.kwargs["strictness"], "strict")
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["data"]["answer"], "回答内容")
        self.assertTrue(body["data"]["hit"])
        self.assertEqual(body["data"]["citations"][0]["docId"], 1)

    def test_chat_handler_question_stripped(self):
        """question 先经 pydantic strip 再进业务层。"""
        chat_resp = ChatResponse(answer="a", hit=True)
        with patch.object(chat_api.agent, "answer", return_value=chat_resp) as mock_answer:
            run_coro(chat_handler(ChatRequest(question="  问题  "), "t"))
        self.assertEqual(mock_answer.call_args.args[0], "问题")


class TestDiagnosisHandlerDirect(unittest.TestCase):
    """diagnosis 路由 handler 直调。"""

    def test_diagnosis_handler_success(self):
        """mock 编排层 → 信封 + DiagnosisRunResponse 结构。"""
        run_resp = DiagnosisRunResponse(
            runId="run-1",
            steps=[StepResult(stepOrder=1, agentCode="monitor", status="success", summary="s")],
            conclusion="结论",
            riskLevel="high",
            citations=[],
            traceId="t",
        )
        with patch.object(diag_api, "run_diagnosis", return_value=run_resp) as mock_run:
            body = run_coro(diagnosis_run_handler(DiagnosisRunRequest(deviceId=1), "t-2"))
        mock_run.assert_called_once()
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["data"]["runId"], "run-1")
        self.assertEqual(body["data"]["steps"][0]["agentCode"], "monitor")
        self.assertEqual(body["data"]["riskLevel"], "high")


class TestGraphHandlersDirect(unittest.TestCase):
    """graph 路由 handler 直调（原 D4 缺陷已修复：2026-10-18）。

    修复内容：app/graphrag/__init__.py 移除 `from app.graphrag.query import
    extract, query, sync` 及其 __all__ 项，包属性 query 恢复为子模块；
    app/agents/single/agent.py 改为 `from app.graphrag.query import query as
    graph_query`。于是 app/api/graph.py:5 `from app.graphrag import query as
    graph_query` 拿到【模块】，graph_query.extract/query/sync 正常调用。
    """

    def test_graph_extract_handler_success(self):
        """extract handler → 信封 code=0 + 边列表（原 D4 缺陷已修复：2026-10-18）。"""
        edge = CandidateEdge(
            fromRefId=1, fromNodeType="segment", toRefId=2, toNodeType="segment",
            relationType="SUPPLEMENT",
        )
        request = GraphExtractRequest(
            kbId=1, segments=[{"segmentId": 1, "content": "a"}, {"segmentId": 2, "content": "b"}]
        )
        with patch("app.graphrag.query.extract", return_value=[edge]) as mock_extract:
            body = run_coro(graph_extract_handler(request, "t"))
        mock_extract.assert_called_once()
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["message"], "ok")
        self.assertEqual(body["data"][0]["fromRefId"], 1)
        self.assertEqual(body["data"][0]["relationType"], "SUPPLEMENT")

    def test_graph_query_handler_success(self):
        """query handler → 信封 code=0 + nodes（原 D4 缺陷已修复：2026-10-18）。"""
        node = RelatedNode(refId=9, nodeType="segment", relationType="SUPPLEMENT")
        with patch("app.graphrag.query.query", return_value=[node]) as mock_query:
            body = run_coro(graph_query_handler(GraphQueryRequest(nodeRefId=1), "t"))
        mock_query.assert_called_once()
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["data"]["nodes"][0]["refId"], 9)
        self.assertEqual(body["data"]["nodes"][0]["nodeType"], "segment")

    def test_graph_sync_handler_success(self):
        """sync handler → 信封 code=0 + kbId/nodeCount（原 D4 缺陷已修复：2026-10-18）。"""
        result = GraphSyncResponse(kbId=1, nodeCount=2, edgeCount=1)
        with patch("app.graphrag.query.sync", return_value=result) as mock_sync:
            body = run_coro(graph_sync_handler(GraphSyncRequest(kbId=1), "t"))
        mock_sync.assert_called_once()
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["data"]["kbId"], 1)
        self.assertEqual(body["data"]["nodeCount"], 2)

    def test_graph_handlers_business_logic_reachable(self):
        """query.py 的三个函数确实存在且可调用（模块未丢功能）。"""
        from app.graphrag.query import extract, query, sync  # noqa: F401

        self.assertTrue(callable(extract))
        self.assertTrue(callable(query))
        self.assertTrue(callable(sync))

    def test_graphrag_package_query_attribute_is_module(self):
        """【D4 回归锁定】包属性 query 必须是子模块（模块对象），而非被遮蔽的函数。

        修复前 __init__.py 把 app.graphrag.query 遮蔽为函数导致 graph 三接口 50000；
        本用例锁定修复不被回退：from app.graphrag import query 得到模块，
        且它具有 extract/query/sync 三个可调用属性。
        """
        import types

        from app.graphrag import query as graph_query_module

        self.assertIsInstance(graph_query_module, types.ModuleType)
        self.assertTrue(callable(graph_query_module.extract))
        self.assertTrue(callable(graph_query_module.query))
        self.assertTrue(callable(graph_query_module.sync))


if __name__ == "__main__":
    unittest.main()