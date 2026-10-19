package com.hwc.workorder.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hwc.agent.api.DiagnosisQueryFacade;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.device.api.DeviceQueryFacade;
import com.hwc.domain.agent.AgentStep;
import com.hwc.domain.agent.DiagnosisRecord;
import com.hwc.domain.device.DevInfo;
import com.hwc.domain.workorder.WoWorkOrder;
import com.hwc.domain.workorder.WoWorkOrderPart;
import com.hwc.infra.minio.MinioService;
import com.hwc.security.core.SecurityUtils;
import com.hwc.workorder.mapper.WoWorkOrderMapper;
import com.hwc.workorder.mapper.WoWorkOrderPartMapper;
import com.hwc.workorder.pdf.WorkOrderPdfRenderer;
import com.hwc.workorder.service.WorkOrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 工单生成：汇总协同诊断结论与备件快照，支持 HTML→PDF 导出并归档 MinIO。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkOrderServiceImpl implements WorkOrderService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final String MINIO_BUCKET = "hwc-workorder";

    private final WoWorkOrderMapper orderMapper;
    private final WoWorkOrderPartMapper partMapper;
    private final DiagnosisQueryFacade diagnosisQueryFacade;
    private final DeviceQueryFacade deviceQueryFacade;
    private final WorkOrderPdfRenderer pdfRenderer;
    private final MinioService minioService;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public WoWorkOrder generate(Long diagnosisId) {
        DiagnosisRecord diagnosis = diagnosisQueryFacade.getDiagnosis(diagnosisId);
        if (diagnosis == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "诊断记录不存在");
        }
        Long existing = orderMapper.selectCount(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<WoWorkOrder>()
                .eq(WoWorkOrder::getDiagnosisId, diagnosisId));
        if (existing != null && existing > 0) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "该诊断已生成工单");
        }
        List<AgentStep> steps = diagnosisQueryFacade.listStepsByRun(diagnosis.getRunId());
        JsonNode workOrderOutput = findOutput(steps, "work_order");
        JsonNode spareOutput = findOutput(steps, "spare_cost");

        WoWorkOrder order = new WoWorkOrder();
        order.setDiagnosisId(diagnosisId);
        order.setDeviceId(diagnosis.getDeviceId());
        order.setFaultSummary(diagnosis.getFaultSummary());
        order.setRootCause(diagnosis.getRootCause());
        order.setRiskLevel(diagnosis.getRiskLevel());
        order.setSafetyRequirements(diagnosis.getSafetyConclusion());
        order.setRepairSteps(extractStepsText(workOrderOutput));
        order.setEstDowntimeHours(decimalOf(workOrderOutput, "estDowntimeHours", spareOutput));
        order.setDowntimeCost(decimalOf(workOrderOutput, "downtimeCost", spareOutput));
        order.setPartsCost(decimalOf(workOrderOutput, "partsCost", spareOutput));
        order.setTotalCost(decimalOf(workOrderOutput, "totalCost", spareOutput));
        order.setStatus("generated");
        order.setGeneratedBy(SecurityUtils.getUsername());
        order.setGeneratedTime(LocalDateTime.now());
        order.setOrderNo("TMP-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24));
        orderMapper.insert(order);

        order.setOrderNo("WO-" + DATE_FORMATTER.format(LocalDateTime.now())
                + "-" + String.format("%06d", order.getId()));
        orderMapper.updateById(order);

        for (JsonNode part : partsOf(spareOutput)) {
            WoWorkOrderPart item = new WoWorkOrderPart();
            item.setOrderId(order.getId());
            item.setSparePartId(longOf(part, "sparePartId"));
            item.setPartName(textOf(part, "name"));
            item.setPartModel(textOf(part, "model"));
            item.setQuantity(intOf(part, "quantity", 1));
            item.setUnitPrice(decimalOf(part, "unitPrice"));
            item.setStockSnapshot(intOf(part, "stock", null));
            item.setRemark(textOf(part, "remark"));
            partMapper.insert(item);
        }
        return order;
    }

    @Override
    public ByteArrayOutputStream renderPdf(Long orderId) {
        WoWorkOrder order = requireOrder(orderId);
        List<WoWorkOrderPart> parts = partMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<WoWorkOrderPart>()
                        .eq(WoWorkOrderPart::getOrderId, orderId));
        DevInfo device = order.getDeviceId() != null ? deviceQueryFacade.getDevice(order.getDeviceId()) : null;
        return pdfRenderer.render(order, parts, device);
    }

    @Override
    public String archivePdf(Long orderId) {
        ByteArrayOutputStream buffer = renderPdf(orderId);
        String fileUrl = minioService.uploadBytes(MINIO_BUCKET, "orders",
                "work-order-" + orderId + ".pdf", buffer.toByteArray());
        WoWorkOrder patch = new WoWorkOrder();
        patch.setId(orderId);
        patch.setFileUrl(fileUrl);
        orderMapper.updateById(patch);
        return fileUrl;
    }

    private WoWorkOrder requireOrder(Long orderId) {
        WoWorkOrder order = orderMapper.selectById(orderId);
        if (order == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "工单不存在");
        }
        return order;
    }

    private JsonNode findOutput(List<AgentStep> steps, String agentCode) {
        for (AgentStep step : steps) {
            if (agentCode.equals(step.getPhase()) && step.getDetail() != null && !step.getDetail().isBlank()) {
                try {
                    return objectMapper.readTree(step.getDetail());
                } catch (Exception e) {
                    log.warn("步骤输出不是合法 JSON: phase={}, {}", agentCode, e.getMessage());
                    return null;
                }
            }
        }
        return null;
    }

    private String extractStepsText(JsonNode workOrderOutput) {
        if (workOrderOutput == null || !workOrderOutput.has("repairSteps")) {
            return null;
        }
        StringBuilder text = new StringBuilder();
        for (JsonNode step : workOrderOutput.get("repairSteps")) {
            if (text.length() > 0) {
                text.append('\n');
            }
            text.append(textOf(step, "step")).append(". ").append(textOf(step, "action"));
        }
        return text.length() == 0 ? null : text.toString();
    }

    private List<JsonNode> partsOf(JsonNode spareOutput) {
        List<JsonNode> parts = new ArrayList<>();
        if (spareOutput != null && spareOutput.has("parts") && spareOutput.get("parts").isArray()) {
            spareOutput.get("parts").forEach(parts::add);
        }
        return parts;
    }

    private String textOf(JsonNode node, String field) {
        return node != null && node.has(field) && !node.get(field).isNull() ? node.get(field).asText() : null;
    }

    private Long longOf(JsonNode node, String field) {
        return node != null && node.has(field) && node.get(field).isNumber() ? node.get(field).asLong() : null;
    }

    private Integer intOf(JsonNode node, String field, Integer defaultValue) {
        return node != null && node.has(field) && node.get(field).isNumber() ? node.get(field).asInt() : defaultValue;
    }

    private BigDecimal decimalOf(JsonNode node, String field) {
        return node != null && node.has(field) && node.get(field).isNumber()
                ? BigDecimal.valueOf(node.get(field).asDouble()) : null;
    }

    private BigDecimal decimalOf(JsonNode node, String field, JsonNode fallback) {
        BigDecimal value = decimalOf(node, field);
        return value != null ? value : decimalOf(fallback, field);
    }
}