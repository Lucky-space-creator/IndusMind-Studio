import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Auth } from "@hwc/shared-auth";
import { EmptyState, Panel, SkeletonPanel, StatusTag, tokens } from "@hwc/shared-ui";
import { USER_PERM } from "@hwc/shared-types";
import { fetchDashboard } from "../../api/dashboard";
import { fetchDiagnosisRecords } from "../../api/diagnosis";

type LevelFilter = "all" | "fault" | "warning";

/**
 * 告警中心：数据源为看板快照（设备状态/异常数/风险提示）+ 高风险诊断记录。
 * 说明：异常明细提取在管理端数据管理完成，用户端聚焦呈现与处置入口。
 */
export default function AlarmCenterPage() {
  const navigate = useNavigate();
  const [level, setLevel] = useState<LevelFilter>("all");
  const board = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard(), refetchInterval: 60_000 });
  const diagnosis = useQuery({
    queryKey: ["diagnosis-high-risk"],
    queryFn: () => fetchDiagnosisRecords({ current: 1, size: 20, riskLevel: "high" }),
  });

  const alarms = useMemo(() => {
    const list = (board.data ?? []).filter((m) => m.status !== "normal" || m.anomalyCount > 0);
    if (level === "all") return list;
    return list.filter((m) => m.status === level);
  }, [board.data, level]);

  const unhandled = (board.data ?? []).filter((m) => m.status !== "normal").length;
  const highRiskCount = diagnosis.data?.total ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3.5">
          <div className="text-xs text-slate-500">待处理（预警+故障）</div>
          <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: unhandled ? tokens.warning : tokens.success }}>
            {unhandled}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3.5">
          <div className="text-xs text-slate-500">高风险诊断</div>
          <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: highRiskCount ? tokens.danger : tokens.success }}>
            {highRiskCount}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3.5">
          <div className="text-xs text-slate-500">监控设备数</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-800">{board.data?.length ?? 0}</div>
        </div>
      </div>

      <Panel
        title="设备告警列表"
        subtitle="来自最新监控快照，每分钟自动刷新"
        extra={
          <div className="flex gap-1" role="group" aria-label="等级筛选">
            {(
              [
                { key: "all", label: "全部" },
                { key: "fault", label: "故障" },
                { key: "warning", label: "预警" },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={level === f.key}
                onClick={() => setLevel(f.key)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  level === f.key ? "bg-[#0E6E8C] text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        {board.isLoading ? (
          <SkeletonPanel rows={6} />
        ) : alarms.length === 0 ? (
          <EmptyState title="当前无告警设备" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="px-3 py-2.5 font-medium">设备</th>
                  <th className="px-3 py-2.5 font-medium">等级</th>
                  <th className="px-3 py-2.5 font-medium">异常数</th>
                  <th className="px-3 py-2.5 font-medium">风险提示</th>
                  <th className="px-3 py-2.5 font-medium">快照时间</th>
                  <th className="px-3 py-2.5 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {alarms.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <Link to={`/device/list/${m.deviceId}`} className="font-medium text-slate-800 hover:text-[#0E6E8C]">
                        设备 #{m.deviceId}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusTag status={m.status === "fault" ? "fault" : "warning"} />
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-600">{m.anomalyCount}</td>
                    <td className="max-w-[220px] truncate px-3 py-2.5 text-slate-600">{m.riskHint || "-"}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{m.snapshotTime}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-3">
                        <Link to={`/device/list/${m.deviceId}`} className="text-[#0E6E8C] hover:underline">
                          查看详情
                        </Link>
                        <Auth code={[USER_PERM.DIAGNOSIS_WRITE]}>
                          <button
                            type="button"
                            onClick={() => navigate(`/diagnosis/run?deviceId=${m.deviceId}`)}
                            className="text-[#0E6E8C] hover:underline"
                          >
                            发起诊断
                          </button>
                        </Auth>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="高风险诊断结论" subtitle="需优先处置">
        {diagnosis.isLoading ? (
          <SkeletonPanel rows={3} />
        ) : (diagnosis.data?.records ?? []).length === 0 ? (
          <EmptyState title="暂无高风险诊断" />
        ) : (
          <div className="flex flex-col gap-2">
            {(diagnosis.data?.records ?? []).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
                <div className="min-w-0">
                  <div className="truncate text-sm text-slate-700">{r.rootCause || r.faultSummary || `诊断记录 #${r.id}`}</div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    设备 #{r.deviceId} · {r.conclusionTime ?? "-"}
                  </div>
                </div>
                <StatusTag tone="fault" label="高风险" />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}