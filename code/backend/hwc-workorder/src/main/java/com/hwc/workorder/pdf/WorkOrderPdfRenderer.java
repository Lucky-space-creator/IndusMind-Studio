package com.hwc.workorder.pdf;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hwc.domain.device.DevInfo;
import com.hwc.domain.workorder.WoWorkOrder;
import com.hwc.domain.workorder.WoWorkOrderPart;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;

/**
 * 工单 PDF 渲染器（openhtmltopdf，HTML→PDF）。
 */
@Component
public class WorkOrderPdfRenderer {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public ByteArrayOutputStream render(WoWorkOrder order, java.util.List<WoWorkOrderPart> parts, DevInfo device) {
        String html = buildHtml(order, parts, device);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(out);
            builder.run();
        } catch (Exception e) {
            throw new IllegalStateException("工单 PDF 渲染失败: " + e.getMessage(), e);
        }
        return out;
    }

    private String buildHtml(WoWorkOrder order, java.util.List<WoWorkOrderPart> parts, DevInfo device) {
        StringBuilder rows = new StringBuilder();
        for (WoWorkOrderPart part : parts) {
            rows.append("<tr><td>").append(escape(part.getPartName()))
                    .append("</td><td>").append(escape(part.getPartModel()))
                    .append("</td><td>").append(part.getQuantity())
                    .append("</td><td>").append(part.getUnitPrice())
                    .append("</td></tr>");
        }
        if (parts.isEmpty()) {
            rows.append("<tr><td colspan='4'>无备件需求</td></tr>");
        }
        return """
                <!DOCTYPE html>
                <html><head><meta charset="utf-8"/>
                <style>
                  body { font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif; font-size: 12px; }
                  h1 { font-size: 18px; text-align: center; }
                  .meta { color: #555; }
                  table { width: 100%%; border-collapse: collapse; margin-top: 8px; }
                  th, td { border: 1px solid #999; padding: 4px 8px; text-align: left; }
                  th { background: #f0f0f0; }
                  .section { margin-top: 14px; font-weight: bold; }
                </style></head><body>
                <h1>设备维修工单</h1>
                <p class="meta">工单编号：%s　|　设备：%s　|　风险等级:%s　|　生成时间：%s</p>
                <div class="section">故障摘要</div>
                <p>%s</p>
                <div class="section">根因结论</div>
                <p>%s</p>
                <div class="section">安全要求</div>
                <p>%s</p>
                <div class="section">维修步骤</div>
                <p>%s</p>
                <div class="section">备件清单</div>
                <table><tr><th>备件</th><th>型号</th><th>数量</th><th>单价</th></tr>%s</table>
                <div class="section">费用与停机预估</div>
                <p>预计停机时长：%s 小时；停机损失：%s；备件成本：%s；总成本:%s</p>
                </body></html>
                """.formatted(
                escape(order.getOrderNo()),
                escape(device != null ? device.getName() : String.valueOf(order.getDeviceId())),
                escape(order.getRiskLevel()),
                order.getGeneratedTime() != null ? DATE_FORMATTER.format(order.getGeneratedTime()) : "-",
                escape(order.getFaultSummary()),
                escape(order.getRootCause()),
                escape(order.getSafetyRequirements()),
                formatSteps(order.getRepairSteps()),
                rows,
                order.getEstDowntimeHours() != null ? order.getEstDowntimeHours().toPlainString() : "-",
                money(order.getDowntimeCost()),
                money(order.getPartsCost()),
                money(order.getTotalCost()));
    }

    /** 维修步骤：JSON 数组 → 编号段落；非 JSON 时按换行输出 */
    private String formatSteps(String raw) {
        if (!StringUtils.hasText(raw)) {
            return "-";
        }
        try {
            JsonNode node = MAPPER.readTree(raw);
            if (node != null && node.isArray()) {
                StringBuilder sb = new StringBuilder();
                int index = 1;
                for (JsonNode item : node) {
                    String action = item.isTextual() ? item.asText() : item.path("action").asText("");
                    if (!StringUtils.hasText(action)) {
                        continue;
                    }
                    sb.append(index++).append(". ").append(escape(action)).append("<br/>");
                }
                return sb.length() == 0 ? "-" : sb.toString();
            }
        } catch (Exception ignored) {
            // 非 JSON，按纯文本处理
        }
        return escape(raw).replace("\n", "<br/>");
    }

    private String money(BigDecimal value) {
        return value == null ? "-" : "¥ " + value.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }

    private String escape(String value) {
        if (!StringUtils.hasText(value)) {
            return "-";
        }
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}