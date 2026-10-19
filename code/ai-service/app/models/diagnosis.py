from __future__ import annotations

from pydantic import Field

from app.models.common import CamelModel, Citation


class AnomalyItem(CamelModel):
    metric_id: int | None = Field(default=None, alias="metricId")
    metric_name: str | None = Field(default=None, alias="metricName")
    anomaly_type: str | None = Field(default=None, alias="anomalyType")
    severity: str | None = None
    start_time: str | None = Field(default=None, alias="startTime")
    end_time: str | None = Field(default=None, alias="endTime")
    peak_value: float | None = Field(default=None, alias="peakValue")
    avg_value: float | None = Field(default=None, alias="avgValue")
    summary: str | None = None


class AgentConfig(CamelModel):
    agent_code: str = Field(alias="agentCode")
    instruction: str | None = None
    boundary: str | None = None
    output_format: str | None = Field(default=None, alias="outputFormat")
    kb_ids: list[int] | None = Field(default=None, alias="kbIds")
    match_strictness: str | None = Field(default=None, alias="matchStrictness")
    tools: list[str] | None = None
    trigger_condition: str | None = Field(default=None, alias="triggerCondition")
    timeout_seconds: int | None = Field(default=None, alias="timeoutSeconds")


class DiagnosisRunRequest(CamelModel):
    device_id: int | None = Field(default=None, alias="deviceId")
    device_name: str | None = Field(default=None, alias="deviceName")
    dataset_id: int | None = Field(default=None, alias="datasetId")
    flow_id: int | None = Field(default=None, alias="flowId")
    anomalies: list[AnomalyItem] = Field(default_factory=list)
    phenomenon: str | None = None
    agents: list[AgentConfig] = Field(default_factory=list)


class StepResult(CamelModel):
    step_order: int = Field(alias="stepOrder")
    agent_code: str = Field(alias="agentCode")
    agent_name: str | None = Field(default=None, alias="agentName")
    status: str
    summary: str | None = None
    output: str | None = None
    citations: list[Citation] = Field(default_factory=list)
    duration_ms: int = Field(default=0, alias="durationMs")


class DiagnosisRunResponse(CamelModel):
    run_id: str = Field(alias="runId")
    steps: list[StepResult] = Field(default_factory=list)
    conclusion: str | None = None
    risk_level: str | None = Field(default=None, alias="riskLevel")
    citations: list[Citation] = Field(default_factory=list)
    trace_id: str | None = Field(default=None, alias="traceId")