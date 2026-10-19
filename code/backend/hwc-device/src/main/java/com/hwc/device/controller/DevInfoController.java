package com.hwc.device.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.device.service.DevInfoService;
import com.hwc.domain.device.DevInfo;
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

@Tag(name = "设备台账")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DevInfoController {

    private final DevInfoService devInfoService;

    @Operation(summary = "设备分页")
    @GetMapping({"/admin/device/infos", "/user/device/infos"})
    public Result<PageResult<DevInfo>> page(@RequestParam(defaultValue = "1") long current,
                                             @RequestParam(defaultValue = "10") long size,
                                             @RequestParam(required = false) String keyword,
                                             @RequestParam(required = false) Long typeId,
                                             @RequestParam(required = false) String status) {
        Page<DevInfo> page = devInfoService.page(new Page<>(current, size),
                new LambdaQueryWrapper<DevInfo>()
                        .and(keyword != null && !keyword.isBlank(),
                                w -> w.like(DevInfo::getCode, keyword).or().like(DevInfo::getName, keyword))
                        .eq(typeId != null, DevInfo::getTypeId, typeId)
                        .eq(status != null && !status.isBlank(), DevInfo::getStatus, status)
                        .orderByAsc(DevInfo::getId));
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "设备详情")
    @GetMapping({"/admin/device/infos/{id}", "/user/device/infos/{id}"})
    public Result<DevInfo> get(@PathVariable Long id) {
        DevInfo info = devInfoService.getById(id);
        if (info == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "设备不存在");
        }
        return Result.ok(info);
    }

    @Operation(summary = "新增设备")
    @PostMapping("/admin/device/infos")
    @PreAuthorize("hasAuthority('device:info:write')")
    public Result<DevInfo> create(@RequestBody DevInfo info) {
        if (devInfoService.existsByCode(info.getCode(), null)) {
            throw new BizException(CommonErrorCode.CONFLICT, "设备编号已存在");
        }
        info.setTypeId(devInfoService.resolveTypeIdByModel(info.getModelId()));
        devInfoService.save(info);
        return Result.ok(info);
    }

    @Operation(summary = "修改设备")
    @PutMapping("/admin/device/infos/{id}")
    @PreAuthorize("hasAuthority('device:info:write')")
    public Result<Void> update(@PathVariable Long id, @RequestBody DevInfo info) {
        info.setId(id);
        if (devInfoService.existsByCode(info.getCode(), id)) {
            throw new BizException(CommonErrorCode.CONFLICT, "设备编号已存在");
        }
        info.setTypeId(devInfoService.resolveTypeIdByModel(info.getModelId()));
        devInfoService.updateById(info);
        return Result.ok();
    }

    @Operation(summary = "删除设备")
    @DeleteMapping("/admin/device/infos/{id}")
    @PreAuthorize("hasAuthority('device:info:write')")
    public Result<Void> delete(@PathVariable Long id) {
        devInfoService.removeById(id);
        return Result.ok();
    }
}