package com.hwc.devicedata.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.devicedata.service.DataAnomalyService;
import com.hwc.domain.devicedata.DataAnomaly;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Tag(name = "数据异常")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DataAnomalyController {

    private final DataAnomalyService anomalyService;

    @Operation(summary = "执行异常提取")
    @PostMapping("/admin/data/datasets/{id}/anomalies/extract")
    @PreAuthorize("hasAuthority('data:clean:write')")
    public Result<Map<String, Integer>> extract(@PathVariable Long id) {
        int count = anomalyService.extract(id);
        return Result.ok(Map.of("anomalyCount", count));
    }

    @Operation(summary = "异常清单分页")
    @GetMapping("/admin/data/datasets/{id}/anomalies")
    @PreAuthorize("hasAuthority('data:anomaly:read')")
    public Result<PageResult<DataAnomaly>> page(@PathVariable Long id,
                                                @RequestParam(defaultValue = "1") long current,
                                                @RequestParam(defaultValue = "10") long size,
                                                @RequestParam(required = false) Long metricId,
                                                @RequestParam(required = false) String severity,
                                                @RequestParam(required = false) String anomalyType) {
        LambdaQueryWrapper<DataAnomaly> wrapper = new LambdaQueryWrapper<DataAnomaly>()
                .eq(DataAnomaly::getDatasetId, id)
                .eq(metricId != null, DataAnomaly::getMetricId, metricId)
                .eq(severity != null && !severity.isBlank(), DataAnomaly::getSeverity, severity)
                .eq(anomalyType != null && !anomalyType.isBlank(), DataAnomaly::getAnomalyType, anomalyType)
                .orderByDesc(DataAnomaly::getSeverity)
                .orderByAsc(DataAnomaly::getStartTime);
        Page<DataAnomaly> page = anomalyService.page(new Page<>(current, size), wrapper);
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "异常清单导出 CSV")
    @GetMapping("/admin/data/anomalies/export")
    @PreAuthorize("hasAuthority('data:anomaly:export')")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) Long datasetId,
                                         @RequestParam(required = false) String severity) {
        LambdaQueryWrapper<DataAnomaly> wrapper = new LambdaQueryWrapper<DataAnomaly>()
                .eq(datasetId != null, DataAnomaly::getDatasetId, datasetId)
                .eq(severity != null && !severity.isBlank(), DataAnomaly::getSeverity, severity)
                .orderByAsc(DataAnomaly::getStartTime);
        List<DataAnomaly> anomalies = anomalyService.list(wrapper);

        StringBuilder csv = new StringBuilder("id,datasetId,deviceId,metricId,anomalyType,severity,startTime,endTime,sampleCount,peakValue,avgValue,summary\n");
        for (DataAnomaly item : anomalies) {
            csv.append(item.getId()).append(',')
                    .append(item.getDatasetId()).append(',')
                    .append(item.getDeviceId()).append(',')
                    .append(item.getMetricId()).append(',')
                    .append(item.getAnomalyType()).append(',')
                    .append(item.getSeverity()).append(',')
                    .append(item.getStartTime()).append(',')
                    .append(item.getEndTime()).append(',')
                    .append(item.getSampleCount()).append(',')
                    .append(item.getPeakValue()).append(',')
                    .append(item.getAvgValue()).append(',')
                    .append('"').append(item.getSummary() == null ? "" : item.getSummary().replace("\"", "\"\"")).append('"')
                    .append('\n');
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=anomalies.csv")
                .contentType(new MediaType(MediaType.TEXT_PLAIN, StandardCharsets.UTF_8))
                .body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }
}