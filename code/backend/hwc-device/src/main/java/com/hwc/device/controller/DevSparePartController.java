package com.hwc.device.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.device.mapper.DevSparePartMapper;
import com.hwc.device.mapper.DevSparePartTypeMapper;
import com.hwc.domain.device.DevSparePart;
import com.hwc.domain.device.DevSparePartType;
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

@Tag(name = "备件")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DevSparePartController {

    private final DevSparePartMapper sparePartMapper;
    private final DevSparePartTypeMapper sparePartTypeMapper;

    @Operation(summary = "备件分页")
    @GetMapping({"/admin/device/spare-parts", "/user/device/spare-parts"})
    public Result<PageResult<DevSparePart>> page(@RequestParam(defaultValue = "1") long current,
                                                 @RequestParam(defaultValue = "10") long size,
                                                 @RequestParam(required = false) String keyword,
                                                 @RequestParam(required = false) Long devTypeId) {
        LambdaQueryWrapper<DevSparePart> wrapper = new LambdaQueryWrapper<DevSparePart>()
                .and(keyword != null && !keyword.isBlank(),
                        w -> w.like(DevSparePart::getCode, keyword).or().like(DevSparePart::getName, keyword))
                .orderByAsc(DevSparePart::getId);
        Page<DevSparePart> page = sparePartMapper.selectPage(new Page<>(current, size), wrapper);
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "新增备件")
    @PostMapping("/admin/device/spare-parts")
    @PreAuthorize("hasAuthority('device:spare-part:write')")
    public Result<DevSparePart> create(@RequestBody DevSparePart part) {
        sparePartMapper.insert(part);
        return Result.ok(part);
    }

    @Operation(summary = "修改备件")
    @PutMapping("/admin/device/spare-parts/{id}")
    @PreAuthorize("hasAuthority('device:spare-part:write')")
    public Result<Void> update(@PathVariable Long id, @RequestBody DevSparePart part) {
        part.setId(id);
        sparePartMapper.updateById(part);
        return Result.ok();
    }

    @Operation(summary = "删除备件")
    @DeleteMapping("/admin/device/spare-parts/{id}")
    @PreAuthorize("hasAuthority('device:spare-part:write')")
    public Result<Void> delete(@PathVariable Long id) {
        sparePartMapper.deleteById(id);
        return Result.ok();
    }

    @Operation(summary = "备件适用设备类型")
    @GetMapping("/admin/device/spare-parts/{id}/types")
    public Result<List<DevSparePartType>> listTypes(@PathVariable Long id) {
        return Result.ok(sparePartTypeMapper.selectList(
                new LambdaQueryWrapper<DevSparePartType>()
                        .eq(DevSparePartType::getSparePartId, id)));
    }

    @Operation(summary = "绑定备件适用设备类型")
    @PostMapping("/admin/device/spare-parts/{id}/types")
    @PreAuthorize("hasAuthority('device:spare-part:write')")
    public Result<Void> bindTypes(@PathVariable Long id, @RequestBody List<Long> devTypeIds) {
        sparePartTypeMapper.delete(new LambdaQueryWrapper<DevSparePartType>()
                .eq(DevSparePartType::getSparePartId, id));
        for (Long devTypeId : devTypeIds) {
            DevSparePartType relation = new DevSparePartType();
            relation.setSparePartId(id);
            relation.setDevTypeId(devTypeId);
            sparePartTypeMapper.insert(relation);
        }
        return Result.ok();
    }
}