package com.hwc.common.result;

import com.hwc.common.context.TraceContext;
import lombok.Getter;

@Getter
public class Result<T> {

    private final int code;
    private final String errorCode;
    private final String message;
    private final T data;
    private final String traceId;

    private Result(int code, String errorCode, String message, T data) {
        this.code = code;
        this.errorCode = errorCode;
        this.message = message;
        this.data = data;
        this.traceId = TraceContext.getTraceId();
    }

    public static <T> Result<T> ok() {
        return new Result<>(0, null, "ok", null);
    }

    public static <T> Result<T> ok(T data) {
        return new Result<>(0, null, "ok", data);
    }

    public static <T> Result<T> fail(int code, String errorCode, String message) {
        return new Result<>(code, errorCode, message, null);
    }

    public static <T> Result<T> fail(ErrorCodeHolder holder, String message) {
        return new Result<>(holder.getHttpStatus(), holder.getCode(), message, null);
    }

    public static <T> Result<T> fail(ErrorCodeHolder holder) {
        return new Result<>(holder.getHttpStatus(), holder.getCode(), holder.getCode(), null);
    }
}