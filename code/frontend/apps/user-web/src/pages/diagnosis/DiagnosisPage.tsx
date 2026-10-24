import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Auth, usePermission } from "@hwc/shared-auth";
import { CitationList, EmptyState, JsonTextView, RiskTag, SkeletonPanel, tokens } from "@hwc/shared-ui";
import {
  USER_PERM,
  type DiagnosisRecord,
  type DiagnosisRunResponse,
  type DiagnosisStepResult,
} from "@hwc/shared-types";
import { fetchDashboard, fetchDashboardHistory } from "../../api/dashboard";
import { fetchDevices } from "../../api/device";
import { fetchDiagnosisDetail, fetchDiagnosisRecords, runDiagnosis } from "../../api/diagnosis";
import { generateWorkOrder } from "../../api/workorder";
import { showToast } from "../../components/Toast";

const STEP_ICON: Record<string, string> = {
  success: "✓",
  failed: "✕",
  skipped: "－",
  running: "…",
};

const STEP_COLOR: Record<string, string> = {
  success: tokens.success,
  failed: tokens.danger,
  skipped: "#94A3B8",
  running: tokens.warning,
};

/** 协同诊断：输入区 → 多 Agent 步骤卡片 → 结论区 → 生成工单 */
export default function DiagnosisPage() {
  const { has } = usePermission();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const initialDeviceId = params.get("deviceId") ? Number(params.get("deviceId")) : null;

  const [deviceId, setDeviceId] = useState<number | null>(initialDeviceId);
  const [datasetId, setDatasetId] = useState<number | null>(null);
  const [phenomenon, setPhenomenon] = useState("");
  const [result, setResult] = useState<DiagnosisRunResponse | null>(null);
  const canWrite = has(USER_PERM.DIAGNOSIS_WRITE);

  const devices = useQuery({ queryKey: ["devices", {}], queryFn: () => fetchDevices({ current: 1, size: 200 }) });
  const board = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard() });
  const history = useQuery({
    queryKey: ["dashboard-history", deviceId],
    queryFn: () => fetchDashboardHistory(deviceId!, 1, 1),
    enabled: deviceId != null,
  });
  const records = useQuery({ queryKey: ["diagnosis-records", 1], queryFn: () => fetchDiagnosisRecords({ current: 1, size: 8 }) });

  /** 选择设备后自动带出其最新快照的数据集（异常提取的数据源） */
  useEffect(() => {
    if (deviceId != null) {
      const snap = (board.data ?? []).find((m) => m.deviceId === deviceId);
      const fromHistory = history.data?.records?.[0];
      const ds = snap?.datasetId ?? fromHistory?.datasetId ?? null;
      setDatasetId((prev) => (prev == null ? ds : prev));
    }
  }, [deviceId, board.data, history.data]);

  const deviceOptions = useMemo(
    () => (devices.data?.records ?? []).map((d) => ({ id: d.id, code: d.code, name: d.name, lineName: d.lineName })),
    [devices.data],
  );

  const run = useMutation({
    mutationFn: () =>
      runDiagnosis({
        deviceId: deviceId!,
        datasetId: datasetId!,
        phenomenon: phenomenon.trim() || undefined,
      }),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["diagnosis-records"] });
      showToast("诊断完成", "success");
    },
    onError: (e: Error) => {
      showToast(e.message || "诊断执行失败，请稍后重试", "error");
    },
  });

  const genOrder = useMutation({
    mutationFn: (diagnosisId: number) => generateWorkOrder(diagnosisId),
    onSuccess: (order) => {
      showToast(`工单 ${order.orderNo} 已生成，可前往维修工单下载`, "success");
      queryClient.invalidateQueries({ queryKey: ["workorders"] });
    },
    onError: (e: Error) => showToast(e.message || "工单生成失败", "error"),
  });

  /** 从诊断记录恢复（查看历史结论） */
  const restore = async (record: DiagnosisRecord) => {
    setResult(null);
    const detail = await fetchDiagnosisDetail(record.id);
    setDeviceId(record.deviceId);
    setDatasetId(record.datasetId);
    setResult({
      runId: String(record.runId),
      steps: (detail.steps ?? []).map((s, i) => ({
        stepOrder: s.stepOrder ?? i + 1,
        agentCode: s.phase ?? String(s.agentId),
        agentName: s.phase ?? `Agent #${s.agentId}`,
        status: s.status,
        summary: s.summary ?? undefined,
        output: s.detail ?? undefined,
        durationMs: s.durationMs ?? undefined,
      })),
      conclusion: record.rootCause || record.faultSummary || "见分步结果",
      riskLevel: record.riskLevel,
      citations: [],
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (deviceId == null || datasetId == null) {
      showToast("请先选择设备（将自动带出最新数据集）", "warning");
      return;
    }
    setResult(null);
    run.mutate();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 输入区 */}
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[220px_180px_1fr_auto] md:items-end">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">选择设备</span>
          <select
            value={deviceId ?? ""}
            onChange={(e) => {
              setDeviceId(e.target.value ? Number(e.target.value) : null);
              setDatasetId(null);
            }}
            disabled={!canWrite}
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-50"
          >
            <option value="">请选择设备</option>
            {deviceOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} · {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">数据集</span>
          <input
            type="number"
            name="datasetId"
            min={1}
            value={datasetId ?? ""}
            disabled
            readOnly
            placeholder="自动带出"
            className="h-11 cursor-not-allowed rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-500"
          />
          <span className="text-xs text-slate-400">由所选设备最新数据自动带出</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">现象描述（可选）</span>
          <input
            value={phenomenon}
            onChange={(e) => setPhenomenon(e.target.value)}
            disabled={!canWrite}
            placeholder="如：主轴温度持续偏高，伴随异响"
            className="h-11 rounded-md border border-slate-300 px-3 text-sm disabled:bg-slate-50"
          />
        </label>
        {canWrite ? (
          <button
            type="submit"
            disabled={run.isPending || deviceId == null}
            className="h-11 rounded-md bg-[#0E6E8C] px-6 text-sm font-medium text-white hover:bg-[#0B5871] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {run.isPending ? "诊断执行中…" : "开始诊断"}
          </button>
        ) : (
          <button
            type="button"
            disabled
            title="当前角色无「发起协同诊断」权限，无法执行诊断；如需使用请联系管理员分配 diagnosis:write 权限"
            className="h-11 cursor-not-allowed rounded-md bg-slate-300 px-6 text-sm font-medium text-white"
          >
            开始诊断
          </button>
        )}
      </form>

      {/* 执行视图：多 Agent 步骤卡片 */}
      {run.isPending && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#0E6E8C]" />
            五 Agent 协同诊断执行中（监测 → 根因 → 备件/安全并行 → 仲裁 → 工单汇总）…
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {["监测", "根因诊断", "备件成本", "安全规范", "工单"].map((name) => (
              <div key={name} className="animate-pulse rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                {name} 等待中…
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-slate-800">诊断执行过程</h3>
            <span className="text-xs text-slate-400">Run #{result.runId}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(result.steps ?? []).map((s: DiagnosisStepResult) => (
              <StepCard key={`${s.stepOrder}-${s.agentCode}`} step={s} />
            ))}
          </div>
        </div>
      )}

      {/* 结论区 */}
      {result && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-slate-800">诊断结论</h3>
            <div className="flex items-center gap-3">
              <RiskTag level={result.riskLevel} />
              <Auth code={[USER_PERM.DIAGNOSIS_WRITE]}>
                <button
                  type="button"
                  onClick={() => {
                    const diagnosisId = Number(result.runId);
                    if (Number.isFinite(diagnosisId) && diagnosisId > 0) genOrder.mutate(diagnosisId);
                    else showToast("未关联诊断记录，无法生成工单", "warning");
                  }}
                  disabled={genOrder.isPending}
                  className="rounded-md bg-[#0E6E8C] px-4 py-2 text-sm text-white hover:bg-[#0B5871] disabled:opacity-50"
                >
                  {genOrder.isPending ? "生成中…" : "生成维修工单"}
                </button>
              </Auth>
            </div>
          </div>
          <p className="whitespace-pre-wrap rounded-md bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
            {result.conclusion}
          </p>
          {(result.citations ?? []).length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-xs text-slate-500">引用溯源：</div>
              <CitationList citations={result.citations ?? []} columns={2} />
            </div>
          )}
        </div>
      )}

      {!result && !run.isPending && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6">
          <EmptyState title="选择设备后发起协同诊断：五 Agent 分工定位根因、评估备件成本与安全要求，最终汇总为可执行维修建议" />
        </div>
      )}

      {/* 历史诊断记录 */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-[15px] font-semibold text-slate-800">历史诊断记录</h3>
        {records.isLoading ? (
          <SkeletonPanel rows={4} />
        ) : (records.data?.records ?? []).length === 0 ? (
          <EmptyState title="暂无诊断记录" />
        ) : (
          <div className="flex flex-col gap-1">
            {(records.data?.records ?? []).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => restore(r)}
                className="flex items-center justify-between gap-3 rounded-md border-b border-slate-100 px-2 py-2.5 text-left last:border-0 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-slate-700">{r.rootCause || r.faultSummary || `诊断记录 #${r.id}`}</div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    设备 #{r.deviceId} · {r.conclusionTime ?? "-"}
                  </div>
                </div>
                <RiskTag level={r.riskLevel} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** 单个 Agent 步骤卡片：状态 | 名称 | 摘要 | 输出 | 耗时 */
function StepCard({ step }: { step: DiagnosisStepResult }) {
  const [expanded, setExpanded] = useState(false);
  const color = STEP_COLOR[step.status] ?? "#94A3B8";
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-3.5 py-2.5">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{ background: `${color}18`, color }}
        >
          {STEP_ICON[step.status] ?? "…"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{step.agentName}</span>
        {step.durationMs != null && <span className="text-xs tabular-nums text-slate-400">{(step.durationMs / 1000).toFixed(1)}s</span>}
      </div>
      <div className="px-3.5 py-2.5">
        {step.summary ? (
          <p className="text-sm leading-relaxed text-slate-600">{step.summary}</p>
        ) : (
          <p className="text-sm text-slate-400">{step.status === "skipped" ? "触发条件未满足，本步骤已跳过" : "-"}</p>
        )}
        {step.output && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs text-[#0E6E8C] hover:underline"
            >
              {expanded ? "收起详情" : "展开详情"}
            </button>
            {expanded && (
              <div className="mt-2 rounded-md bg-slate-50 px-3 py-2.5">
                <JsonTextView raw={step.output} maxHeight={288} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
