package com.hwc.security.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.common.result.PageResult;
import com.hwc.domain.system.SysAuditLog;
import com.hwc.security.dto.audit.AuditLogExportQuery;
import com.hwc.security.dto.audit.AuditLogPageQuery;
import com.hwc.security.dto.audit.AuditLogVO;
import com.hwc.security.mapper.SysAuditLogMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private static final long EXPORT_LIMIT = 50_000;
    private static final String EXPORT_LIMIT_MESSAGE = "导出数据量超过上限(" + EXPORT_LIMIT + ")，请缩小时间范围";
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final String CSV_HEADER = "id,operateTime,operatorId,operatorName,endpoint,module,action,targetType,targetId,result,errorMsg,ip,traceId,beforeValue,afterValue";

    private final SysAuditLogMapper sysAuditLogMapper;

    public PageResult<AuditLogVO> pageAuditLogs(AuditLogPageQuery query) {
        validateTimeRange(query.getBeginTime(), query.getEndTime());
        LambdaQueryWrapper<SysAuditLog> wrapper = new LambdaQueryWrapper<SysAuditLog>()
                .eq(query.getOperatorName() != null && !query.getOperatorName().isBlank(),
                        SysAuditLog::getOperatorName, query.getOperatorName())
                .eq(query.getModule() != null && !query.getModule().isBlank(),
                        SysAuditLog::getModule, query.getModule())
                .eq(query.getAction() != null && !query.getAction().isBlank(),
                        SysAuditLog::getAction, query.getAction());
        applyTimeRange(wrapper, query.getBeginTime(), query.getEndTime());
        wrapper.orderByDesc(SysAuditLog::getOperateTime);
        Page<SysAuditLog> page = sysAuditLogMapper.selectPage(new Page<>(query.getCurrent(), query.getSize()), wrapper);
        List<AuditLogVO> records = page.getRecords().stream()
                .map(this::toVO)
                .collect(Collectors.toList());
        return PageResult.of(records, page.getTotal(), page.getCurrent(), page.getSize());
    }

    public byte[] exportAuditLogs(AuditLogExportQuery query) {
        validateTimeRange(query.getBeginTime(), query.getEndTime());
        LambdaQueryWrapper<SysAuditLog> wrapper = new LambdaQueryWrapper<>();
        applyTimeRange(wrapper, query.getBeginTime(), query.getEndTime());
        if (sysAuditLogMapper.selectCount(wrapper) > EXPORT_LIMIT) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, EXPORT_LIMIT_MESSAGE);
        }
        wrapper.orderByDesc(SysAuditLog::getOperateTime);
        List<SysAuditLog> logs = sysAuditLogMapper.selectList(wrapper);

        StringBuilder csv = new StringBuilder();
        csv.append('\ufeff');
        csv.append(CSV_HEADER).append('\n');
        for (SysAuditLog log : logs) {
            appendRow(csv, log);
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private void validateTimeRange(LocalDateTime beginTime, LocalDateTime endTime) {
        if (beginTime != null && endTime != null && beginTime.isAfter(endTime)) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "开始时间不能晚于结束时间");
        }
    }

    private void applyTimeRange(LambdaQueryWrapper<SysAuditLog> wrapper, LocalDateTime beginTime, LocalDateTime endTime) {
        wrapper.ge(beginTime != null, SysAuditLog::getOperateTime, beginTime)
                .le(endTime != null, SysAuditLog::getOperateTime, endTime);
    }

    private AuditLogVO toVO(SysAuditLog log) {
        AuditLogVO vo = new AuditLogVO();
        vo.setId(log.getId());
        vo.setOperatorId(log.getOperatorId());
        vo.setOperatorName(log.getOperatorName());
        vo.setEndpoint(log.getEndpoint());
        vo.setModule(log.getModule());
        vo.setAction(log.getAction());
        vo.setTargetType(log.getTargetType());
        vo.setTargetId(log.getTargetId());
        vo.setBeforeValue(log.getBeforeValue());
        vo.setAfterValue(log.getAfterValue());
        vo.setResult(log.getResult());
        vo.setErrorMsg(log.getErrorMsg());
        vo.setIp(log.getIp());
        vo.setTraceId(log.getTraceId());
        vo.setOperateTime(log.getOperateTime());
        return vo;
    }

    private void appendRow(StringBuilder csv, SysAuditLog log) {
        csv.append(escapeCsv(str(log.getId()))).append(',')
                .append(escapeCsv(formatTime(log.getOperateTime()))).append(',')
                .append(escapeCsv(str(log.getOperatorId()))).append(',')
                .append(escapeCsv(log.getOperatorName())).append(',')
                .append(escapeCsv(log.getEndpoint())).append(',')
                .append(escapeCsv(log.getModule())).append(',')
                .append(escapeCsv(log.getAction())).append(',')
                .append(escapeCsv(log.getTargetType())).append(',')
                .append(escapeCsv(log.getTargetId())).append(',')
                .append(escapeCsv(str(log.getResult()))).append(',')
                .append(escapeCsv(log.getErrorMsg())).append(',')
                .append(escapeCsv(log.getIp())).append(',')
                .append(escapeCsv(log.getTraceId())).append(',')
                .append(escapeCsv(log.getBeforeValue())).append(',')
                .append(escapeCsv(log.getAfterValue())).append('\n');
    }

    private String escapeCsv(String value) {
        if (value == null) {
            return "";
        }
        boolean needQuote = value.contains(",") || value.contains("\"")
                || value.contains("\n") || value.contains("\r");
        if (needQuote) {
            return '"' + value.replace("\"", "\"\"") + '"';
        }
        return value;
    }

    private String str(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String formatTime(LocalDateTime time) {
        return time == null ? null : TIME_FORMATTER.format(time);
    }
}