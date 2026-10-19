package com.hwc.device.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.device.service.DevTypeService;
import com.hwc.domain.device.DevModel;
import com.hwc.domain.device.DevType;
import com.hwc.device.mapper.DevModelMapper;
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

@Tag(name = "设备类型与型号")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DevTypeController {

    private final DevTypeService devTypeService;
    private final DevModelMapper devModelMapper;

    @Operation(summary = "设备类型分页")
    @GetMapping({"/admin/device/types", "/user/device/types"})
    public Result<PageResult<DevType>> pageTypes(@RequestParam(defaultValue = "1") long current,
                                                 @RequestParam(defaultValue = "10") long size,
                                                 @RequestParam(required = false) String keyword) {
        Page<DevType> page = devTypeService.page(new Page<>(current, size),
                new LambdaQueryWrapper<DevType>()
                        .and(keyword != null && !keyword.isBlank(),
                                w -> w.like(DevType::getCode, keyword).or().like(DevType::getName, keyword))
                        .orderByAsc(DevType::getId));
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "设备类型详情")
    @GetMapping({"/admin/device/types/{id}", "/user/device/types/{id}"})
    public Result<DevType> getType(@PathVariable Long id) {
        DevType type = devTypeService.getById(id);
        if (type == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "设备类型不存在");
        }
        return Result.ok(type);
    }

    @Operation(summary = "新增设备类型")
    @PostMapping("/admin/device/types")
    @PreAuthorize("hasAuthority('device:type:write')")
    public Result<DevType> createType(@RequestBody DevType type) {
        if (devTypeService.existsByCode(type.getCode(), null)) {
            throw new BizException(CommonErrorCode.CONFLICT, "类型编码已存在");
        }
        devTypeService.save(type);
        return Result.ok(type);
    }

    @Operation(summary = "修改设备类型")
    @PutMapping("/admin/device/types/{id}")
    @PreAuthorize("hasAuthority('device:type:write')")
    public Result<Void> updateType(@PathVariable Long id, @RequestBody DevType type) {
        type.setId(id);
        if (devTypeService.existsByCode(type.getCode(), id)) {
            throw new BizException(CommonErrorCode.CONFLICT, "类型编码已存在");
        }
        devTypeService.updateById(type);
        return Result.ok();
    }

    @Operation(summary = "删除设备类型")
    @DeleteMapping("/admin/device/types/{id}")
    @PreAuthorize("hasAuthority('device:type:write')")
    public Result<Void> deleteType(@PathVariable Long id) {
        Long modelCount = devModelMapper.selectCount(
                new LambdaQueryWrapper<DevModel>().eq(DevModel::getTypeId, id));
        if (modelCount > 0) {
            throw new BizException(CommonErrorCode.CONFLICT, "该类型下存在型号，无法删除");
        }
        devTypeService.removeById(id);
        return Result.ok();
    }

    @Operation(summary = "型号列表（按类型）")
    @GetMapping({"/admin/device/types/{typeId}/models", "/user/device/types/{typeId}/models"})
    public Result<List<DevModel>> listModels(@PathVariable Long typeId) {
        return Result.ok(devModelMapper.selectList(
                new LambdaQueryWrapper<DevModel>()
                        .eq(DevModel::getTypeId, typeId)
                        .orderByAsc(DevModel::getId)));
    }

    @Operation(summary = "新增型号")
    @PostMapping("/admin/device/models")
    @PreAuthorize("hasAuthority('device:type:write')")
    public Result<DevModel> createModel(@RequestBody DevModel model) {
        devModelMapper.insert(model);
        return Result.ok(model);
    }

    @Operation(summary = "修改型号")
    @PutMapping("/admin/device/models/{id}")
    @PreAuthorize("hasAuthority('device:type:write')")
    public Result<Void> updateModel(@PathVariable Long id, @RequestBody DevModel model) {
        model.setId(id);
        devModelMapper.updateById(model);
        return Result.ok();
    }

    @Operation(summary = "删除型号")
    @DeleteMapping("/admin/device/models/{id}")
    @PreAuthorize("hasAuthority('device:type:write')")
    public Result<Void> deleteModel(@PathVariable Long id) {
        devModelMapper.deleteById(id);
        return Result.ok();
    }
}