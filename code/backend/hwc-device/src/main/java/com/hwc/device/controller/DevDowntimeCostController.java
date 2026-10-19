package com.hwc.device.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.common.result.Result;
import com.hwc.device.service.DevDowntimeCostService;
import com.hwc.domain.device.DevDowntimeCost;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "停机损失标准")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DevDowntimeCostController {

    private final DevDowntimeCostService downtimeCostService;

    @Operation(summary = "停机损失标准列表")
    @GetMapping({"/admin/device/downtime-costs", "/user/device/downtime-costs"})
    public Result<List<DevDowntimeCost>> list() {
        return Result.ok(downtimeCostService.list(
                new LambdaQueryWrapper<DevDowntimeCost>().orderByAsc(DevDowntimeCost::getId)));
    }

    @Operation(summary = "新增停机损失标准")
    @PostMapping("/admin/device/downtime-costs")
    @PreAuthorize("hasAuthority('device:downtime-cost:write')")
    public Result<DevDowntimeCost> create(@RequestBody DevDowntimeCost cost) {
        downtimeCostService.save(cost);
        return Result.ok(cost);
    }

    @Operation(summary = "修改停机损失标准")
    @PutMapping("/admin/device/downtime-costs/{id}")
    @PreAuthorize("hasAuthority('device:downtime-cost:write')")
    public Result<Void> update(@PathVariable Long id, @RequestBody DevDowntimeCost cost) {
        cost.setId(id);
        downtimeCostService.updateById(cost);
        return Result.ok();
    }

    @Operation(summary = "删除停机损失标准")
    @DeleteMapping("/admin/device/downtime-costs/{id}")
    @PreAuthorize("hasAuthority('device:downtime-cost:write')")
    public Result<Void> delete(@PathVariable Long id) {
        downtimeCostService.removeById(id);
        return Result.ok();
    }
}