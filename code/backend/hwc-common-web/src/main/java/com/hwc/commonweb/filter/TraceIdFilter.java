package com.hwc.commonweb.filter;

import com.hwc.common.constant.HwcConstants;
import com.hwc.common.context.TraceContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TraceIdFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String traceId = request.getHeader(HwcConstants.HEADER_TRACE_ID);
            TraceContext.setTraceId(traceId);
            response.setHeader(HwcConstants.HEADER_TRACE_ID, TraceContext.getTraceId());
            filterChain.doFilter(request, response);
        } finally {
            TraceContext.clear();
        }
    }
}