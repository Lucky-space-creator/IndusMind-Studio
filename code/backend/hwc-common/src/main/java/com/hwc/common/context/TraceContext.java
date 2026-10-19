package com.hwc.common.context;

import org.slf4j.MDC;

import java.util.UUID;

public final class TraceContext {

    public static final String TRACE_ID_KEY = "traceId";

    private TraceContext() {
    }

    public static String getTraceId() {
        String traceId = MDC.get(TRACE_ID_KEY);
        return traceId == null ? "" : traceId;
    }

    public static void setTraceId(String traceId) {
        if (traceId == null || traceId.isBlank()) {
            traceId = generate();
        }
        MDC.put(TRACE_ID_KEY, traceId);
    }

    public static String ensureTraceId() {
        String traceId = MDC.get(TRACE_ID_KEY);
        if (traceId == null || traceId.isBlank()) {
            traceId = generate();
            MDC.put(TRACE_ID_KEY, traceId);
        }
        return traceId;
    }

    public static void clear() {
        MDC.remove(TRACE_ID_KEY);
    }

    private static String generate() {
        return UUID.randomUUID().toString().replace("-", "");
    }
}