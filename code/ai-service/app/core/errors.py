from enum import IntEnum


class ErrorCode(IntEnum):
    OK = 0
    BAD_REQUEST = 40000
    VALIDATION_ERROR = 40001
    NOT_FOUND = 40400
    UNSUPPORTED = 40002
    INTERNAL_ERROR = 50000
    SERVICE_ERROR = 50001
    RETRIEVAL_ERROR = 50002
    INDEX_ERROR = 50003
    MODEL_UNAVAILABLE = 50301
    VECTOR_UNAVAILABLE = 50302
    GRAPH_UNAVAILABLE = 50303


class AiServiceError(Exception):
    def __init__(self, code: ErrorCode, message: str, *, detail: str | None = None):
        super().__init__(message)
        self.code = int(code)
        self.message = message
        self.detail = detail


def bad_request(message: str, *, detail: str | None = None) -> AiServiceError:
    return AiServiceError(ErrorCode.BAD_REQUEST, message, detail=detail)


def service_error(message: str, *, detail: str | None = None) -> AiServiceError:
    return AiServiceError(ErrorCode.SERVICE_ERROR, message, detail=detail)


def model_unavailable(message: str = "模型服务暂不可用，请稍后重试", *, detail: str | None = None) -> AiServiceError:
    return AiServiceError(ErrorCode.MODEL_UNAVAILABLE, message, detail=detail)


def vector_unavailable(message: str = "向量库暂不可用，请稍后重试", *, detail: str | None = None) -> AiServiceError:
    return AiServiceError(ErrorCode.VECTOR_UNAVAILABLE, message, detail=detail)


def graph_unavailable(message: str = "文档关联图暂不可用，请稍后重试", *, detail: str | None = None) -> AiServiceError:
    return AiServiceError(ErrorCode.GRAPH_UNAVAILABLE, message, detail=detail)