package com.hwc.agent.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.agent.mapper.AgentRunMapper;
import com.hwc.agent.mapper.AgentStepMapper;
import com.hwc.domain.agent.AgentRun;
import com.hwc.domain.agent.AgentStep;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Agent 运行记录")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AgentRunController {

    private final AgentRunMapper runMapper;
    private final AgentStepMapper stepMapper;

    @Operation(summary = "运行记录分页（管理端）")
    @GetMapping("/admin/agent/runs")
    @PreAuthorize("hasAuthority('agent:definition:read')")
    public Result<PageResult<AgentRun>> page(@RequestParam(defaultValue = "1") long current,
                                             @RequestParam(defaultValue = "10") long size,
                                             @RequestParam(required = false) Long deviceId,
                                             @RequestParam(required = false) String status) {
        LambdaQueryWrapper<AgentRun> wrapper = new LambdaQueryWrapper<AgentRun>()
                .eq(deviceId != null, AgentRun::getDeviceId, deviceId)
                .eq(status != null && !status.isBlank(), AgentRun::getStatus, status)
                .orderByDesc(AgentRun::getId);
        Page<AgentRun> page = runMapper.selectPage(new Page<>(current, size), wrapper);
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "运行步骤列表")
    @GetMapping({"/admin/agent/runs/{id}/steps", "/user/diagnosis/runs/{id}/steps"})
    public Result<List<AgentStep>> steps(@PathVariable Long id) {
        return Result.ok(stepMapper.selectList(new LambdaQueryWrapper<AgentStep>()
                .eq(AgentStep::getRunId, id)
                .orderByAsc(AgentStep::getStepOrder)));
    }
}