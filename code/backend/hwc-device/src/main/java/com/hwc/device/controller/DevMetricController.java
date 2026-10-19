package com.hwc.device.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.device.service.DevMetricThresholdService;
import com.hwc.device.mapper.DevAlarmRuleMapper;
import com.hwc.device.mapper.DevMetricMapper;
import com.hwc.domain.device.DevAlarmRule;
import com.hwc.domain.device.DevMetric;
import com.hwc.domain.device.DevMetricThreshold;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "指标/阈值/告警规则")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DevMetricController {

    private final DevMetricMapper devMetricMapper;
    private final DevMetricThresholdService thresholdService;
    private final DevAlarmRuleMapper devAlarmRuleMapper;

    @Operation(summary = "指标分页")
    @GetMapping({"/admin/device/metrics", "/user/device/metrics"})
    public Result<PageResult<DevMetric>> page(@RequestParam(defaultValue = "1") long current,
                                              @RequestParam(defaultValue = "10") long size,
                                              @RequestParam(required = false) Long typeId,
                                              @RequestParam(required = false) String keyword) {
        Page<DevMetric> page = devMetricMapper.selectPage(new Page<>(current, size),
                new LambdaQueryWrapper<DevMetric>()
                        .eq(typeId != null, DevMetric::getTypeId, typeId)
                        .and(keyword != null && !keyword.isBlank(),
                                w -> w.like(DevMetric::getCode, keyword).or().like(DevMetric::getName, keyword))
                        .orderByAsc(DevMetric::getId));
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "新增指标")
    @PostMapping("/admin/device/metrics")
    @PreAuthorize("hasAuthority('device:metric:write')")
    public Result<DevMetric> createMetric(@RequestBody DevMetric metric) {
        devMetricMapper.insert(metric);
        return Result.ok(metric);
    }

    @Operation(summary = "修改指标")
    @PutMapping("/admin/device/metrics/{id}")
    @PreAuthorize("hasAuthority('device:metric:write')")
    public Result<Void> updateMetric(@PathVariable Long id, @RequestBody DevMetric metric) {
        metric.setId(id);
        devMetricMapper.updateById(metric);
        return Result.ok();
    }

    @Operation(summary = "删除指标")
    @DeleteMapping("/admin/device/metrics/{id}")
    @PreAuthorize("hasAuthority('device:metric:write')")
    public Result<Void> deleteMetric(@PathVariable Long id) {
        devMetricMapper.deleteById(id);
        return Result.ok();
    }

    @Operation(summary = "指标阈值详情")
    @GetMapping({"/admin/device/metrics/{metricId}/threshold", "/user/device/metrics/{metricId}/threshold"})
    public Result<DevMetricThreshold> getThreshold(@PathVariable Long metricId) {
        return Result.ok(thresholdService.getOne(
                new LambdaQueryWrapper<DevMetricThreshold>()
                        .eq(DevMetricThreshold::getMetricId, metricId)));
    }

    @Operation(summary = "保存指标阈值")
    @PostMapping("/admin/device/metrics/{metricId}/threshold")
    @PreAuthorize("hasAuthority('device:metric:write')")
    public Result<DevMetricThreshold> saveThreshold(@PathVariable Long metricId,
                                                    @RequestBody DevMetricThreshold threshold) {
        thresholdService.validateRange(threshold);
        DevMetricThreshold existing = thresholdService.getOne(
                new LambdaQueryWrapper<DevMetricThreshold>()
                        .eq(DevMetricThreshold::getMetricId, metricId));
        threshold.setMetricId(metricId);
        if (existing == null) {
            thresholdService.save(threshold);
        } else {
            threshold.setId(existing.getId());
            threshold.setVersion(existing.getVersion());
            thresholdService.updateById(threshold);
        }
        return Result.ok(threshold);
    }

    @Operation(summary = "告警规则列表（按指标）")
    @GetMapping({"/admin/device/metrics/{metricId}/alarm-rules", "/user/device/metrics/{metricId}/alarm-rules"})
    public Result<List<DevAlarmRule>> listAlarmRules(@PathVariable Long metricId) {
        return Result.ok(devAlarmRuleMapper.selectList(
                new LambdaQueryWrapper<DevAlarmRule>()
                        .eq(DevAlarmRule::getMetricId, metricId)
                        .orderByAsc(DevAlarmRule::getId)));
    }

    @Operation(summary = "新增告警规则")
    @PostMapping("/admin/device/alarm-rules")
    @PreAuthorize("hasAuthority('device:alarm-rule:write')")
    public Result<DevAlarmRule> createAlarmRule(@RequestBody DevAlarmRule rule) {
        devAlarmRuleMapper.insert(rule);
        return Result.ok(rule);
    }

    @Operation(summary = "修改告警规则")
    @PutMapping("/admin/device/alarm-rules/{id}")
    @PreAuthorize("hasAuthority('device:alarm-rule:write')")
    public Result<Void> updateAlarmRule(@PathVariable Long id, @RequestBody DevAlarmRule rule) {
        rule.setId(id);
        devAlarmRuleMapper.updateById(rule);
        return Result.ok();
    }

    @Operation(summary = "删除告警规则")
    @DeleteMapping("/admin/device/alarm-rules/{id}")
    @PreAuthorize("hasAuthority('device:alarm-rule:write')")
    public Result<Void> deleteAlarmRule(@PathVariable Long id) {
        devAlarmRuleMapper.deleteById(id);
        return Result.ok();
    }
}