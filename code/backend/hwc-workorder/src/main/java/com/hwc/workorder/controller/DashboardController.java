package com.hwc.workorder.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.domain.workorder.WoDashboardMetric;
import com.hwc.workorder.mapper.WoDashboardMetricMapper;
import com.hwc.workorder.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "设备健康看板")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DashboardController {

    private final WoDashboardMetricMapper metricMapper;
    private final DashboardService dashboardService;

    @Operation(summary = "看板概览（各设备最新快照）")
    @GetMapping("/user/dashboard")
    @PreAuthorize("hasAuthority('dashboard:read')")
    public Result<List<WoDashboardMetric>> overview(@RequestParam(required = false) List<Long> deviceIds) {
        if (deviceIds != null && !deviceIds.isEmpty()) {
            return Result.ok(dashboardService.latestSnapshots(deviceIds));
        }
        return Result.ok(metricMapper.selectList(new LambdaQueryWrapper<WoDashboardMetric>()
                .inSql(WoDashboardMetric::getId,
                        "SELECT MAX(id) FROM wo_dashboard_metric WHERE deleted = 0 GROUP BY device_id")
                .orderByDesc(WoDashboardMetric::getSnapshotTime)));
    }

    @Operation(summary = "设备看板历史快照")
    @GetMapping("/user/dashboard/devices/{deviceId}/history")
    @PreAuthorize("hasAuthority('dashboard:read')")
    public Result<PageResult<WoDashboardMetric>> history(@PathVariable Long deviceId,
                                                         @RequestParam(defaultValue = "1") long current,
                                                         @RequestParam(defaultValue = "10") long size) {
        Page<WoDashboardMetric> page = metricMapper.selectPage(new Page<>(current, size),
                new LambdaQueryWrapper<WoDashboardMetric>()
                        .eq(WoDashboardMetric::getDeviceId, deviceId)
                        .orderByDesc(WoDashboardMetric::getId));
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "手动刷新看板快照")
    @PostMapping("/user/dashboard/refresh")
    @PreAuthorize("hasAuthority('dashboard:read')")
    public Result<WoDashboardMetric> refresh(@RequestParam Long datasetId) {
        return Result.ok(dashboardService.refresh(datasetId));
    }
}