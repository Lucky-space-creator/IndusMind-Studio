package com.hwc.workorder.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.domain.workorder.WoWorkOrder;
import com.hwc.domain.workorder.WoWorkOrderPart;
import com.hwc.workorder.mapper.WoWorkOrderMapper;
import com.hwc.workorder.mapper.WoWorkOrderPartMapper;
import com.hwc.workorder.service.WorkOrderService;
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

import java.util.List;
import java.util.Map;

@Tag(name = "维修工单")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class WorkOrderController {

    private final WoWorkOrderMapper orderMapper;
    private final WoWorkOrderPartMapper partMapper;
    private final WorkOrderService workOrderService;

    @Operation(summary = "工单分页")
    @GetMapping({"/user/workorders", "/admin/workorder/orders"})
    @PreAuthorize("hasAuthority('workorder:read')")
    public Result<PageResult<WoWorkOrder>> page(@RequestParam(defaultValue = "1") long current,
                                                @RequestParam(defaultValue = "10") long size,
                                                @RequestParam(required = false) Long deviceId,
                                                @RequestParam(required = false) String status,
                                                @RequestParam(required = false) String keyword) {
        LambdaQueryWrapper<WoWorkOrder> wrapper = new LambdaQueryWrapper<WoWorkOrder>()
                .eq(deviceId != null, WoWorkOrder::getDeviceId, deviceId)
                .eq(status != null && !status.isBlank(), WoWorkOrder::getStatus, status)
                .like(keyword != null && !keyword.isBlank(), WoWorkOrder::getOrderNo, keyword)
                .orderByDesc(WoWorkOrder::getId);
        Page<WoWorkOrder> page = orderMapper.selectPage(new Page<>(current, size), wrapper);
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "工单详情（含备件）")
    @GetMapping({"/user/workorders/{id}", "/admin/workorder/orders/{id}"})
    @PreAuthorize("hasAuthority('workorder:read')")
    public Result<Map<String, Object>> detail(@PathVariable Long id) {
        WoWorkOrder order = orderMapper.selectById(id);
        if (order == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "工单不存在");
        }
        List<WoWorkOrderPart> parts = partMapper.selectList(new LambdaQueryWrapper<WoWorkOrderPart>()
                .eq(WoWorkOrderPart::getOrderId, id));
        return Result.ok(Map.of("order", order, "parts", parts));
    }

    @Operation(summary = "生成工单（汇总诊断结论）")
    @PostMapping("/user/workorders/generate")
    @PreAuthorize("hasAuthority('diagnosis:write')")
    public Result<WoWorkOrder> generate(@RequestParam Long diagnosisId) {
        return Result.ok(workOrderService.generate(diagnosisId));
    }

    @Operation(summary = "工单导出 PDF（下载）")
    @GetMapping("/user/workorders/{id}/export")
    @PreAuthorize("hasAuthority('workorder:export')")
    public ResponseEntity<byte[]> export(@PathVariable Long id) {
        byte[] pdf = workOrderService.renderPdf(id).toByteArray();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=work-order-" + id + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @Operation(summary = "工单归档（PDF 存 MinIO）")
    @PostMapping("/user/workorders/{id}/archive")
    @PreAuthorize("hasAuthority('workorder:export')")
    public Result<String> archive(@PathVariable Long id) {
        return Result.ok(workOrderService.archivePdf(id));
    }
}