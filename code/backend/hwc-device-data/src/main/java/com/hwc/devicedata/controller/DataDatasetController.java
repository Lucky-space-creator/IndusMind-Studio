package com.hwc.devicedata.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.devicedata.model.SimulateRequest;
import com.hwc.devicedata.service.DataDatasetService;
import com.hwc.domain.devicedata.DataDataset;
import com.hwc.domain.devicedata.DataRecord;
import com.hwc.devicedata.mapper.DataRecordMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;

@Tag(name = "设备数据集")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DataDatasetController {

    private final DataDatasetService datasetService;
    private final DataRecordMapper recordMapper;

    @Operation(summary = "数据集分页")
    @GetMapping("/admin/data/datasets")
    @PreAuthorize("hasAuthority('data:dataset:read')")
    public Result<PageResult<DataDataset>> page(@RequestParam(defaultValue = "1") long current,
                                                @RequestParam(defaultValue = "10") long size,
                                                @RequestParam(required = false) Long deviceId,
                                                @RequestParam(required = false) String sourceType,
                                                @RequestParam(required = false) String status,
                                                @RequestParam(required = false) String keyword) {
        LambdaQueryWrapper<DataDataset> wrapper = new LambdaQueryWrapper<DataDataset>()
                .eq(deviceId != null, DataDataset::getDeviceId, deviceId)
                .eq(sourceType != null && !sourceType.isBlank(), DataDataset::getSourceType, sourceType)
                .eq(status != null && !status.isBlank(), DataDataset::getStatus, status)
                .like(keyword != null && !keyword.isBlank(), DataDataset::getName, keyword)
                .orderByDesc(DataDataset::getId);
        Page<DataDataset> page = datasetService.page(new Page<>(current, size), wrapper);
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "数据集详情")
    @GetMapping("/admin/data/datasets/{id}")
    @PreAuthorize("hasAuthority('data:dataset:read')")
    public Result<DataDataset> detail(@PathVariable Long id) {
        DataDataset dataset = datasetService.getById(id);
        if (dataset == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "数据集不存在");
        }
        return Result.ok(dataset);
    }

    @Operation(summary = "CSV 导入数据集")
    @PostMapping("/admin/data/datasets/import")
    @PreAuthorize("hasAuthority('data:dataset:write')")
    public Result<DataDataset> importCsv(@RequestParam Long deviceId,
                                         @RequestParam(required = false) String name,
                                         @RequestPart MultipartFile file) {
        return Result.ok(datasetService.importCsv(deviceId, name, file));
    }

    @Operation(summary = "模拟生成数据集（自动清洗与异常提取）")
    @PostMapping("/admin/data/datasets/simulate")
    @PreAuthorize("hasAuthority('data:dataset:write')")
    public Result<DataDataset> simulate(@RequestBody SimulateRequest request) {
        return Result.ok(datasetService.simulate(request));
    }

    @Operation(summary = "删除数据集")
    @DeleteMapping("/admin/data/datasets/{id}")
    @PreAuthorize("hasAuthority('data:dataset:delete')")
    public Result<Void> delete(@PathVariable Long id) {
        datasetService.deleteDataset(id);
        return Result.ok();
    }

    @Operation(summary = "原始记录分页预览")
    @GetMapping("/admin/data/datasets/{id}/records")
    @PreAuthorize("hasAuthority('data:dataset:read')")
    public Result<PageResult<DataRecord>> records(@PathVariable Long id,
                                                  @RequestParam(defaultValue = "1") long current,
                                                  @RequestParam(defaultValue = "20") long size,
                                                  @RequestParam(required = false) Long metricId,
                                                  @RequestParam(required = false)
                                                  @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime from,
                                                  @RequestParam(required = false)
                                                  @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime to) {
        LambdaQueryWrapper<DataRecord> wrapper = new LambdaQueryWrapper<DataRecord>()
                .eq(DataRecord::getDatasetId, id)
                .eq(metricId != null, DataRecord::getMetricId, metricId)
                .ge(from != null, DataRecord::getCollectTime, from)
                .le(to != null, DataRecord::getCollectTime, to)
                .orderByAsc(DataRecord::getCollectTime);
        Page<DataRecord> page = recordMapper.selectPage(new Page<>(current, size), wrapper);
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }
}