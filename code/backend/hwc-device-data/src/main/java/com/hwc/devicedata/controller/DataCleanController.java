package com.hwc.devicedata.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.devicedata.service.DataCleanService;
import com.hwc.domain.devicedata.DataCleaned;
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

import java.util.Map;

@Tag(name = "数据清洗")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DataCleanController {

    private final DataCleanService cleanService;

    @Operation(summary = "执行清洗")
    @PostMapping("/admin/data/datasets/{id}/clean")
    @PreAuthorize("hasAuthority('data:clean:write')")
    public Result<Map<String, Integer>> clean(@PathVariable Long id) {
        int cleaned = cleanService.clean(id);
        return Result.ok(Map.of("cleanedCount", cleaned));
    }

    @Operation(summary = "清洗结果分页")
    @GetMapping("/admin/data/datasets/{id}/cleaned")
    @PreAuthorize("hasAuthority('data:clean:read')")
    public Result<PageResult<DataCleaned>> cleaned(@PathVariable Long id,
                                                   @RequestParam(defaultValue = "1") long current,
                                                   @RequestParam(defaultValue = "20") long size,
                                                   @RequestParam(required = false) Long metricId,
                                                   @RequestParam(required = false) Integer modified) {
        LambdaQueryWrapper<DataCleaned> wrapper = new LambdaQueryWrapper<DataCleaned>()
                .eq(DataCleaned::getDatasetId, id)
                .eq(metricId != null, DataCleaned::getMetricId, metricId)
                .eq(modified != null, DataCleaned::getIsModified, modified)
                .orderByAsc(DataCleaned::getCollectTime);
        Page<DataCleaned> page = cleanService.page(new Page<>(current, size), wrapper);
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "清洗修改点统计")
    @GetMapping("/admin/data/datasets/{id}/cleaned/stats")
    @PreAuthorize("hasAuthority('data:clean:read')")
    public Result<Map<String, Long>> stats(@PathVariable Long id) {
        Long total = cleanService.count(new LambdaQueryWrapper<DataCleaned>()
                .eq(DataCleaned::getDatasetId, id));
        Long modified = cleanService.count(new LambdaQueryWrapper<DataCleaned>()
                .eq(DataCleaned::getDatasetId, id)
                .eq(DataCleaned::getIsModified, 1));
        return Result.ok(Map.of("total", total, "modified", modified));
    }
}