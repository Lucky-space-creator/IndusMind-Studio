# -*- coding: utf-8 -*-
"""app/core/response.py + errors.py + trace.py 单元测试。"""
import sys
import pathlib
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "code" / "ai-service"))

from app.core.errors import (  # noqa: E402
    AiServiceError,
    ErrorCode,
    bad_request,
    graph_unavailable,
    model_unavailable,
    service_error,
    vector_unavailable,
)
from app.core.response import ApiEnvelope, dump, failure, success  # noqa: E402
from app.core.trace import get_trace_id, new_trace_id, set_trace_id  # noqa: E402


class TestSuccessEnvelope(unittest.TestCase):
    """success 信封结构（经验：成功码为 0，非 200）。"""

    def test_success_default_fields(self):
        """默认 success：code=0、message=ok、data=None、traceId 空串。"""
        body = success()
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["message"], "ok")
        self.assertIsNone(body["data"])
        self.assertEqual(body["traceId"], "")

    def test_success_with_payload(self):
        """携带 data 与 trace_id 时透传。"""
        body = success({"k": 1}, "trace-1")
        self.assertEqual(body["code"], 0)
        self.assertEqual(body["data"], {"k": 1})
        self.assertEqual(body["traceId"], "trace-1")

    def test_success_exact_keys(self):
        """信封固定四键结构。"""
        self.assertEqual(set(success().keys()), {"code", "message", "data", "traceId"})


class TestFailureEnvelope(unittest.TestCase):
    """failure 信封结构。"""

    def test_failure_fields(self):
        """failure：data 恒为 None，code/message/traceId 透传。"""
        body = failure(40001, "参数校验失败", "trace-2")
        self.assertEqual(body["code"], 40001)
        self.assertEqual(body["message"], "参数校验失败")
        self.assertIsNone(body["data"])
        self.assertEqual(body["traceId"], "trace-2")

    def test_failure_default_trace_empty(self):
        """failure 默认 traceId 为空串。"""
        self.assertEqual(failure(50000, "x")["traceId"], "")


class TestDumpAndEnvelopeModel(unittest.TestCase):
    """dump 序列化与 ApiEnvelope 模型。"""

    def test_dump_by_alias(self):
        """dump 使用 by_alias 输出 camelCase 键。"""
        envelope = ApiEnvelope(code=1, message="m", data=[1], traceId="t")
        self.assertEqual(dump(envelope), {"code": 1, "message": "m", "data": [1], "traceId": "t"})

    def test_api_envelope_defaults(self):
        """ApiEnvelope 默认值：code=0、message=ok。"""
        envelope = ApiEnvelope()
        self.assertEqual(envelope.code, 0)
        self.assertEqual(envelope.message, "ok")
        self.assertIsNone(envelope.data)
        self.assertEqual(envelope.traceId, "")


class TestErrorCodeEnum(unittest.TestCase):
    """ErrorCode 枚举关键取值（与源码 app/core/errors.py 对齐）。"""

    def test_error_code_values(self):
        """枚举数值逐一锁定。"""
        expect = {
            "OK": 0,
            "BAD_REQUEST": 40000,
            "VALIDATION_ERROR": 40001,
            "UNSUPPORTED": 40002,
            "NOT_FOUND": 40400,
            "INTERNAL_ERROR": 50000,
            "SERVICE_ERROR": 50001,
            "RETRIEVAL_ERROR": 50002,
            "INDEX_ERROR": 50003,
            "MODEL_UNAVAILABLE": 50301,
            "VECTOR_UNAVAILABLE": 50302,
            "GRAPH_UNAVAILABLE": 50303,
        }
        for name, value in expect.items():
            self.assertEqual(int(ErrorCode[name]), value, name)

    def test_error_code_is_int_enum(self):
        """ErrorCode 成员可直接当 int 使用。"""
        self.assertEqual(ErrorCode.OK + 0, 0)


class TestAiServiceError(unittest.TestCase):
    """AiServiceError 与便捷构造函数。"""

    def test_ai_service_error_attributes(self):
        """异常携带 code/message/detail。"""
        exc = AiServiceError(ErrorCode.BAD_REQUEST, "msg", detail="d")
        self.assertEqual(exc.code, 40000)
        self.assertEqual(exc.message, "msg")
        self.assertEqual(exc.detail, "d")
        self.assertEqual(str(exc), "msg")

    def test_ai_service_error_code_is_int(self):
        """code 被转换为 int 类型。"""
        exc = AiServiceError(ErrorCode.OK, "m")
        self.assertIsInstance(exc.code, int)

    def test_bad_request_helper(self):
        """bad_request → 40000。"""
        exc = bad_request("参数错误")
        self.assertIsInstance(exc, AiServiceError)
        self.assertEqual(exc.code, 40000)
        self.assertEqual(exc.message, "参数错误")

    def test_service_error_helper(self):
        """service_error → 50001。"""
        self.assertEqual(service_error("svc").code, 50001)

    def test_model_unavailable_helper_default_message(self):
        """model_unavailable 默认文案与 50301 码。"""
        exc = model_unavailable()
        self.assertEqual(exc.code, 50301)
        self.assertIn("模型服务暂不可用", exc.message)

    def test_vector_unavailable_helper_default_message(self):
        """vector_unavailable → 50302 默认文案。"""
        exc = vector_unavailable()
        self.assertEqual(exc.code, 50302)
        self.assertIn("向量库暂不可用", exc.message)

    def test_graph_unavailable_helper_default_message(self):
        """graph_unavailable → 50303 默认文案。"""
        exc = graph_unavailable()
        self.assertEqual(exc.code, 50303)
        self.assertIn("文档关联图暂不可用", exc.message)


class TestTrace(unittest.TestCase):
    """trace_id 上下文管理。"""

    def tearDown(self):
        set_trace_id("")

    def test_new_trace_id_format(self):
        """new_trace_id 为 32 位小写十六进制。"""
        value = new_trace_id()
        self.assertEqual(len(value), 32)
        self.assertEqual(value, value.lower())
        int(value, 16)  # 可解析为十六进制

    def test_new_trace_id_unique(self):
        """两次生成不重复。"""
        self.assertNotEqual(new_trace_id(), new_trace_id())

    def test_set_and_get_trace_id(self):
        """set 后 get 返回同值。"""
        set_trace_id("trace-abc")
        self.assertEqual(get_trace_id(), "trace-abc")

    def test_set_empty_normalizes(self):
        """set 空串归一为空串。"""
        set_trace_id("x")
        set_trace_id("")
        self.assertEqual(get_trace_id(), "")

    def test_set_none_normalizes_empty(self):
        """set None 归一为空串。"""
        set_trace_id(None)
        self.assertEqual(get_trace_id(), "")

    def test_default_trace_id_empty(self):
        """未设置时默认空串。"""
        set_trace_id("")
        self.assertEqual(get_trace_id(), "")


if __name__ == "__main__":
    unittest.main()