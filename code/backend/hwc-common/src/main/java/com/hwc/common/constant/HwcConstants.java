package com.hwc.common.constant;

public final class HwcConstants {

    public static final String END_USER = "user";
    public static final String END_ADMIN = "admin";
    public static final String END_BOTH = "both";

    public static final String HEADER_TRACE_ID = "X-Trace-Id";
    public static final String HEADER_AUTHORIZATION = "Authorization";
    public static final String BEARER_PREFIX = "Bearer ";

    public static final String CLAIM_END = "end";
    public static final String CLAIM_USER_ID = "uid";
    public static final String CLAIM_USERNAME = "username";

    public static final long NOT_DELETED = 0L;
    public static final int STATUS_ENABLED = 1;
    public static final int STATUS_DISABLED = 0;

    public static final String API_PREFIX = "/api";
    public static final String OPEN_API_PREFIX = "/api/open/v1";

    private HwcConstants() {
    }
}