package com.hwc.common.exception;

import com.hwc.common.result.ErrorCodeHolder;
import lombok.Getter;

@Getter
public class BizException extends RuntimeException {

    private final String errorCode;
    private final int httpStatus;

    public BizException(ErrorCodeHolder holder, String message) {
        super(message);
        this.errorCode = holder.getCode();
        this.httpStatus = holder.getHttpStatus();
    }

    public BizException(ErrorCodeHolder holder) {
        super(holder.getCode());
        this.errorCode = holder.getCode();
        this.httpStatus = holder.getHttpStatus();
    }

    public static BizException of(ErrorCodeHolder holder, String message) {
        return new BizException(holder, message);
    }
}