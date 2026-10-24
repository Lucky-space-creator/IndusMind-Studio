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
import com.hwc.domain.device.DevSparePart;
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
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 工单生成：汇总协同诊断结论与备件快照，支持 HTML→PDF 导出并归档 MinIO。
 *
 * <p>字段口径与 Python 输出契约（app/agents/multi/contracts.py）严格对齐：
 * <ul>
 *   <li>work_order 节点：{@code orderTitle / priority / steps[] / spareParts[] / safetyNotes[]}</li>
 *   <li>spare_cost 节点：{@code spareParts[{partName,partModel,quantity,unitPrice,stock}] / downtimeLoss}</li>
 *   <li>单价与库存以设备主数据（dev_spare_part）为准，LLM 仅给候选备件</li>
 * </ul>
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

        // 安全否决（或工单节点未执行）时禁止生成工单：避免产出「有单无内容」的空壳工单
        if (workOrderOutput == null) {
            String safetyHint = diagnosis.getSafetyConclusion();
            String detail = safetyHint == null || safetyHint.isBlank()
                    ? "工单节点未执行"
                    : "安全核查结论：" + safetyHint;
            throw new BizException(CommonErrorCode.PARAM_INVALID,
                    "工单未生成：" + detail + "（安全核查未通过或工单节点被跳过）");
        }

        WoWorkOrder order = new WoWorkOrder();
        order.setDiagnosisId(diagnosisId);
        order.setDeviceId(diagnosis.getDeviceId());
        order.setFaultSummary(diagnosis.getFaultSummary());
        order.setRootCause(diagnosis.getRootCause());
        order.setRiskLevel(diagnosis.getRiskLevel());
        order.setSafetyRequirements(diagnosis.getSafetyConclusion());

        List<PartLine> partLines = resolveParts(spareOutput, workOrderOutput);
        BigDecimal partsCost = sumPartsCost(partLines);
        BigDecimal downtimeCost = firstNonNull(
                decimalOf(spareOutput, "downtimeLoss"),
                decimalOf(workOrderOutput, "downtimeCost"));
        BigDecimal totalCost = sumCost(downtimeCost, partsCost);

        order.setRepairSteps(buildStepsJson(workOrderOutput));
        order.setEstDowntimeHours(estimateDowntimeHours(downtimeCost, order.getDeviceId(), decimalOf(workOrderOutput, "estDowntimeHours")));
        order.setDowntimeCost(downtimeCost);
        order.setPartsCost(partsCost);
        order.setTotalCost(totalCost);
        order.setStatus("generated");
        order.setGeneratedBy(SecurityUtils.getUsername());
        order.setGeneratedTime(LocalDateTime.now());
        order.setOrderNo("TMP-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24));
        orderMapper.insert(order);

        order.setOrderNo("WO-" + DATE_FORMATTER.format(LocalDateTime.now())
                + "-" + String.format("%06d", order.getId()));
        orderMapper.updateById(order);

        for (PartLine line : partLines) {
            WoWorkOrderPart item = new WoWorkOrderPart();
            item.setOrderId(order.getId());
            item.setSparePartId(line.sparePartId());
            item.setPartName(line.partName());
            item.setPartModel(line.partModel());
            item.setQuantity(line.quantity());
            item.setUnitPrice(line.unitPrice());
            item.setStockSnapshot(line.stock());
            item.setRemark(line.remark());
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
        if (steps == null) {
            return null;
        }
        for (AgentStep step : steps) {
            if (agentCode.equals(step.getPhase()) && step.getDetail() != null && !step.getDetail().isBlank()) {
                try {
                    JsonNode node = objectMapper.readTree(step.getDetail());
                    return node != null && node.isObject() ? node : null;
                } catch (Exception e) {
                    log.warn("步骤输出不是合法 JSON: phase={}, {}", agentCode, e.getMessage());
                    return null;
                }
            }
        }
        return null;
    }

    /**
     * 维修步骤统一落库为 JSON：[{"step":1,"action":"..."}]（与 DDL 注释一致）。
     * 兼容旧契约的 repairSteps[{step,action}] 形态。
     */
    private String buildStepsJson(JsonNode workOrderOutput) {
        List<Map<String, Object>> rows = new ArrayList<>();
        JsonNode legacy = workOrderOutput.get("repairSteps");
        if (legacy != null && legacy.isArray()) {
            for (JsonNode node : legacy) {
                String action = textOf(node, "action");
                if (action == null) {
                    action = textOf(node, "step");
                }
                if (action == null || action.isBlank()) {
                    continue;
                }
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("step", rows.size() + 1);
                row.put("action", action);
                putIfPresent(row, "tools", textOf(node, "tools"));
                putIfPresent(row, "duration", textOf(node, "duration"));
                rows.add(row);
            }
        } else {
            JsonNode steps = workOrderOutput.get("steps");
            if (steps != null && steps.isArray()) {
                for (JsonNode node : steps) {
                    String action = node.isTextual() ? node.asText() : textOf(node, "action");
                    if (action == null || action.isBlank()) {
                        continue;
                    }
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("step", rows.size() + 1);
                    row.put("action", action);
                    rows.add(row);
                }
            }
        }
        if (rows.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(rows);
        } catch (Exception e) {
            log.warn("维修步骤序列化失败: {}", e.getMessage());
            return null;
        }
    }

    private void putIfPresent(Map<String, Object> row, String key, String value) {
        if (value != null && !value.isBlank()) {
            row.put(key, value);
        }
    }

    /** 备件明细：契约 spareParts 为主，兼容旧 parts；单价/库存以主数据为准 */
    private List<PartLine> resolveParts(JsonNode spareOutput, JsonNode workOrderOutput) {
        List<JsonNode> raw = new ArrayList<>();
        JsonNode contractParts = spareOutput != null ? spareOutput.get("spareParts") : null;
        if (contractParts != null && contractParts.isArray()) {
            contractParts.forEach(raw::add);
        } else {
            JsonNode legacyParts = spareOutput != null ? spareOutput.get("parts") : null;
            if (legacyParts != null && legacyParts.isArray()) {
                legacyParts.forEach(raw::add);
            }
        }
        if (raw.isEmpty()) {
            // 备件节点缺失时，退化为工单节点的备件名称清单（无数量/价格）
            JsonNode names = workOrderOutput.get("spareParts");
            if (names != null && names.isArray()) {
                names.forEach(node -> {
                    if (node.isTextual() && !node.asText().isBlank()) {
                        Map<String, Object> wrapper = new LinkedHashMap<>();
                        wrapper.put("partName", node.asText());
                        raw.add(objectMapper.valueToTree(wrapper));
                    }
                });
            }
        }
        if (raw.isEmpty()) {
            return List.of();
        }

        List<String> names = raw.stream()
                .map(node -> firstNonNull(textOf(node, "partName"), textOf(node, "name")))
                .filter(name -> name != null && !name.isBlank())
                .distinct()
                .toList();
        Map<String, DevSparePart> master = new HashMap<>();
        for (DevSparePart part : deviceQueryFacade.listSparePartsByNames(names)) {
            master.putIfAbsent(normalizeName(part.getName()), part);
        }

        List<PartLine> lines = new ArrayList<>();
        for (JsonNode node : raw) {
            String partName = firstNonNull(textOf(node, "partName"), textOf(node, "name"));
            if (partName == null || partName.isBlank()) {
                continue;
            }
            String partModel = firstNonNull(textOf(node, "partModel"), textOf(node, "model"));
            Integer quantity = firstNonNullInt(intOf(node, "quantity"), 1);
            BigDecimal unitPrice = decimalOf(node, "unitPrice");
            Integer stock = intOf(node, "stock");
            Long sparePartId = longOf(node, "sparePartId");
            DevSparePart masterPart = master.get(normalizeName(partName));
            if (masterPart != null) {
                if (sparePartId == null) {
                    sparePartId = masterPart.getId();
                }
                if (partModel == null) {
                    partModel = masterPart.getModel();
                }
                if (unitPrice == null) {
                    unitPrice = masterPart.getUnitPrice();
                }
                if (stock == null) {
                    stock = masterPart.getStock();
                }
            }
            lines.add(new PartLine(sparePartId, partName, partModel, quantity, unitPrice, stock,
                    textOf(node, "remark")));
        }
        return lines;
    }

    private BigDecimal sumPartsCost(List<PartLine> lines) {
        BigDecimal total = null;
        for (PartLine line : lines) {
            if (line.unitPrice() == null || line.quantity() == null) {
                continue;
            }
            BigDecimal subtotal = line.unitPrice().multiply(BigDecimal.valueOf(line.quantity()));
            total = total == null ? subtotal : total.add(subtotal);
        }
        return total;
    }

    private BigDecimal sumCost(BigDecimal left, BigDecimal right) {
        if (left == null) {
            return right;
        }
        if (right == null) {
            return left;
        }
        return left.add(right);
    }

    /** 预计停机时长：有停机损失与主数据小时成本时反算，否则沿用上游给定时长 */
    private BigDecimal estimateDowntimeHours(BigDecimal downtimeCost, Long deviceId, BigDecimal declaredHours) {
        if (declaredHours != null) {
            return declaredHours;
        }
        if (downtimeCost == null || downtimeCost.compareTo(BigDecimal.ZERO) <= 0 || deviceId == null) {
            return null;
        }
        DevInfo device = deviceQueryFacade.getDevice(deviceId);
        BigDecimal costPerHour = deviceQueryFacade.getDowntimeCostPerHour(deviceId,
                device != null ? device.getLineName() : null);
        if (costPerHour == null || costPerHour.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        return downtimeCost.divide(costPerHour, 2, RoundingMode.HALF_UP);
    }

    private String normalizeName(String name) {
        return name == null ? "" : name.trim().toLowerCase();
    }

    private String textOf(JsonNode node, String field) {
        return node != null && node.hasNonNull(field) ? node.get(field).asText() : null;
    }

    private Long longOf(JsonNode node, String field) {
        return node != null && node.hasNonNull(field) && node.get(field).isNumber() ? node.get(field).asLong() : null;
    }

    private Integer intOf(JsonNode node, String field) {
        return node != null && node.hasNonNull(field) && node.get(field).isNumber() ? node.get(field).asInt() : null;
    }

    private BigDecimal decimalOf(JsonNode node, String field) {
        return node != null && node.hasNonNull(field) && node.get(field).isNumber()
                ? BigDecimal.valueOf(node.get(field).asDouble()) : null;
    }

    private BigDecimal firstNonNull(BigDecimal first, BigDecimal second) {
        return first != null ? first : second;
    }

    private String firstNonNull(String first, String second) {
        return first != null && !first.isBlank() ? first : second;
    }

    private Integer firstNonNullInt(Integer first, Integer second) {
        return first != null ? first : second;
    }

    /** 备件明细行（内部结构） */
    private record PartLine(Long sparePartId, String partName, String partModel, Integer quantity,
                            BigDecimal unitPrice, Integer stock, String remark) {
    }
}
