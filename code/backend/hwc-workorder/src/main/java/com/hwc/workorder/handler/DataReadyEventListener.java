package com.hwc.workorder.handler;

import com.hwc.devicedata.event.DataReadyEvent;
import com.hwc.workorder.service.DashboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * 数据就绪事件监听：异步刷新设备健康看板快照。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataReadyEventListener {

    private final DashboardService dashboardService;

    @Async
    @EventListener
    public void onDataReady(DataReadyEvent event) {
        try {
            dashboardService.refresh(event.datasetId());
            log.info("看板快照已刷新: datasetId={}", event.datasetId());
        } catch (Exception e) {
            log.warn("看板快照刷新失败: datasetId={}, {}", event.datasetId(), e.getMessage());
        }
    }
}