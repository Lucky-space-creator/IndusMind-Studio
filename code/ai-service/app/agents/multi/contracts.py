from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.models.common import CamelModel


class ConfirmedAnomaly(CamelModel):
    metric_id: int | None = Field(default=None, alias="metricId")
    metric_name: str | None = Field(default=None, alias="metricName")
    anomaly_type: str | None = Field(default=None, alias="anomalyType")
    severity: str | None = None
    summary: str | None = None


class MonitorOutput(CamelModel):
    device_status: Literal["normal", "abnormal"] = Field(alias="deviceStatus")
    severity: Literal["low", "medium", "high"] = "low"
    confirmed_anomalies: list[ConfirmedAnomaly] = Field(default_factory=list, alias="confirmedAnomalies")
    summary: str | None = None


class RootCauseItem(CamelModel):
    cause: str
    confidence: float | None = None
    evidence: str | None = None


class RootCauseOutput(CamelModel):
    root_causes: list[RootCauseItem] = Field(default_factory=list, alias="rootCauses")
    top_cause: str | None = Field(default=None, alias="topCause")
    confidence: float | None = None
    summary: str | None = None


class SparePartItem(CamelModel):
    part_name: str | None = Field(default=None, alias="partName")
    part_model: str | None = Field(default=None, alias="partModel")
    quantity: int | None = None
    unit_price: float | None = Field(default=None, alias="unitPrice")
    stock: int | None = None


class SpareCostOutput(CamelModel):
    spare_parts: list[SparePartItem] = Field(default_factory=list, alias="spareParts")
    downtime_loss: float | None = Field(default=None, alias="downtimeLoss")
    cost_level: Literal["low", "medium", "high"] = Field(default="low", alias="costLevel")
    summary: str | None = None


class SafetyOutput(CamelModel):
    check_result: Literal["pass", "fail"] = Field(alias="checkResult")
    safety_requirements: list[str] = Field(default_factory=list, alias="safetyRequirements")
    risk_level: Literal["low", "medium", "high"] = Field(default="low", alias="riskLevel")
    reason: str | None = None


class WorkOrderOutput(CamelModel):
    order_title: str | None = Field(default=None, alias="orderTitle")
    priority: Literal["low", "medium", "high"] = "medium"
    steps: list[str] = Field(default_factory=list)
    spare_parts: list[str] = Field(default_factory=list, alias="spareParts")
    safety_notes: list[str] = Field(default_factory=list, alias="safetyNotes")