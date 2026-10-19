package com.hwc.agent.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.aiclient.model.DiagnosisRunResponse;
import com.hwc.agent.mapper.AgentStepMapper;
import com.hwc.agent.mapper.DiagnosisRecordMapper;
import com.hwc.agent.service.DiagnosisService;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.domain.agent.AgentStep;
import com.hwc.domain.agent.DiagnosisRecord;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@Tag(name = "协同诊断")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DiagnosisController {

    private final DiagnosisService diagnosisService;
    private final DiagnosisRecordMapper diagnosisMapper;
    private final AgentStepMapper stepMapper;

    @Operation(summary = "发起协同诊断")
    @PostMapping("/user/diagnosis/run")
    @PreAuthorize("hasAuthority('diagnosis:write')")
    public Result<DiagnosisRunResponse> run(@RequestBody Map<String, Object> body) {
        Long deviceId = requireLong(body, "deviceId");
        Long datasetId = requireLong(body, "datasetId");
        Long flowId = parseOptionalLong(body, "flowId");
        String phenomenon = body.get("phenomenon") == null ? null : String.valueOf(body.get("phenomenon"));
        return Result.ok(diagnosisService.run(deviceId, datasetId, flowId, phenomenon));
    }

    private static Long requireLong(Map<String, Object> body, String field) {
        Object value = body.get(field);
        if (value == null) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, field + " 不能为空");
        }
        return parseLongValue(value, field);
    }

    private static Long parseOptionalLong(Map<String, Object> body, String field) {
        Object value = body.get(field);
        if (value == null) {
            return null;
        }
        return parseLongValue(value, field);
    }

    private static Long parseLongValue(Object value, String field) {
        try {
            return Long.valueOf(String.valueOf(value));
        } catch (NumberFormatException e) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, field + " 必须为数字");
        }
    }

    @Operation(summary = "诊断记录分页")
    @GetMapping({"/user/diagnosis/records", "/admin/agent/diagnosis/records"})
    @PreAuthorize("hasAuthority('diagnosis:read')")
    public Result<PageResult<DiagnosisRecord>> records(@RequestParam(defaultValue = "1") long current,
                                                       @RequestParam(defaultValue = "10") long size,
                                                       @RequestParam(required = false) Long deviceId,
                                                       @RequestParam(required = false) String riskLevel) {
        LambdaQueryWrapper<DiagnosisRecord> wrapper = new LambdaQueryWrapper<DiagnosisRecord>()
                .eq(deviceId != null, DiagnosisRecord::getDeviceId, deviceId)
                .eq(riskLevel != null && !riskLevel.isBlank(), DiagnosisRecord::getRiskLevel, riskLevel)
                .orderByDesc(DiagnosisRecord::getId);
        Page<DiagnosisRecord> page = diagnosisMapper.selectPage(new Page<>(current, size), wrapper);
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "诊断详情（含步骤）")
    @GetMapping({"/user/diagnosis/records/{id}", "/admin/agent/diagnosis/records/{id}"})
    @PreAuthorize("hasAuthority('diagnosis:read')")
    public Result<Map<String, Object>> detail(@PathVariable Long id) {
        DiagnosisRecord record = diagnosisMapper.selectById(id);
        if (record == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "诊断记录不存在");
        }
        List<AgentStep> steps = stepMapper.selectList(new LambdaQueryWrapper<AgentStep>()
                .eq(AgentStep::getRunId, record.getRunId())
                .orderByAsc(AgentStep::getStepOrder));
        return Result.ok(Map.of("record", record, "steps", steps));
    }
}