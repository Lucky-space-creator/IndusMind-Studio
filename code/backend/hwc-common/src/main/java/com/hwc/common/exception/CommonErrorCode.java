package com.hwc.common.exception;

import com.hwc.common.result.ErrorCodeHolder;
import lombok.Getter;

@Getter
public enum CommonErrorCode implements ErrorCodeHolder {

    BAD_REQUEST("COMMON_4000", 400),
    UNAUTHORIZED("COMMON_4001", 401),
    FORBIDDEN("COMMON_4003", 403),
    NOT_FOUND("COMMON_4004", 404),
    CONFLICT("COMMON_4009", 409),
    PARAM_INVALID("COMMON_4100", 400),
    INTERNAL_ERROR("COMMON_5000", 500),
    SERVICE_UNAVAILABLE("COMMON_5003", 503),
    AI_SERVICE_UNAVAILABLE("COMMON_5100", 503),
    AI_SERVICE_TIMEOUT("COMMON_5101", 504);

    private final String code;
    private final int httpStatus;

    CommonErrorCode(String code, int httpStatus) {
        this.code = code;
        this.httpStatus = httpStatus;
    }
}