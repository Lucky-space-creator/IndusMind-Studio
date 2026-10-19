import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Auth, usePermission } from "@hwc/shared-auth";
import { DonutChart, EmptyState, HealthScore, Panel, RiskTag, SkeletonPanel, StatusTag, tokens } from "@hwc/shared-ui";
import { USER_PERM } from "@hwc/shared-types";
import { fetchDashboard } from "../../api/dashboard";
import { fetchDiagnosisRecords } from "../../api/diagnosis";

function StatCard({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3.5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: tone ?? tokens.text }}>
        {value}
      </div>
    </div>
  );
}

/** 工作台：概览卡 + 待办 + 最新风险 + 快捷入口 */
export default function DashboardPage() {
  const { has } = usePermission();
  const board = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard() });
  const diagnosis = useQuery({
    queryKey: ["diagnosis-records-top"],
    queryFn: () => fetchDiagnosisRecords({ current: 1, size: 5 }),
    enabled: has(USER_PERM.DIAGNOSIS_READ),
  });

  const metrics = board.data ?? [];
  const normal = metrics.filter((m) => m.status === "normal").length;
  const warning = metrics.filter((m) => m.status === "warning").length;
  const fault = metrics.filter((m) => m.status === "fault").length;
  const pendingRisk = metrics.filter((m) => m.anomalyCount > 0);
  const topRisk = [...metrics].sort((a, b) => a.healthScore - b.healthScore).slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      {/* 概览卡 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="设备总数" value={metrics.length} />
        <StatCard label="正常" value={normal} tone={tokens.success} />
        <StatCard label="预警" value={warning} tone={tokens.warning} />
        <StatCard label="故障" value={fault} tone={tokens.danger} />
        <StatCard label="待关注异常" value={pendingRisk.length} tone={pendingRisk.length ? tokens.danger : tokens.success} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* 健康度分布 */}
        <Panel title="健康度分布" subtitle="各设备最新快照">
          {board.isLoading ? (
            <SkeletonPanel rows={4} />
          ) : metrics.length === 0 ? (
            <EmptyState title="暂无看板数据，等待数据接入与快照生成" />
          ) : (
            <DonutChart
              centerLabel="设备"
              data={[
                { name: "正常", value: normal, color: tokens.success },
                { name: "预警", value: warning, color: tokens.warning },
                { name: "故障", value: fault, color: tokens.danger },
                { name: "离线/其他", value: Math.max(0, metrics.length - normal - warning - fault), color: "#94A3B8" },
              ]}
            />
          )}
        </Panel>

        {/* 停机风险榜 */}
        <Panel title="停机风险榜" subtitle="健康分最低 Top5" extra={<Link to="/device" className="text-sm text-[#0E6E8C] hover:underline">设备总览</Link>}>
          {board.isLoading ? (
            <SkeletonPanel rows={5} />
          ) : topRisk.length === 0 ? (
            <EmptyState title="暂无数据" />
          ) : (
            <div className="flex flex-col gap-2.5">
              {topRisk.map((m) => (
                <Link
                  key={m.id}
                  to={`/device/list/${m.deviceId}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 hover:border-[#0E6E8C]/50 hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">设备 #{m.deviceId}</span>
                  <StatusTag status={m.status} />
                  <HealthScore score={m.healthScore} />
                </Link>
              ))}
            </div>
          )}
        </Panel>

        {/* 待办/最新风险 */}
        <Panel title="最新风险提示" subtitle="异常设备">
          {board.isLoading ? (
            <SkeletonPanel rows={5} />
          ) : pendingRisk.length === 0 ? (
            <EmptyState title="当前无待处理异常" />
          ) : (
            <div className="flex flex-col gap-2">
              {pendingRisk.slice(0, 5).map((m) => (
                <Link
                  key={m.id}
                  to={`/device/list/${m.deviceId}`}
                  className="flex items-start justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 hover:border-[#0E6E8C]/50 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-slate-700">设备 #{m.deviceId} · {m.anomalyCount} 项异常</div>
                    {m.riskHint && <div className="mt-0.5 truncate text-xs text-slate-500">{m.riskHint}</div>}
                  </div>
                  <StatusTag status={m.status} />
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* 快捷入口 + 我的诊断 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="快捷入口">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Auth code={[USER_PERM.DIAGNOSIS_WRITE]}>
              <Link
                to="/diagnosis/run"
                className="flex min-h-[72px] flex-col justify-center rounded-lg bg-[#0E6E8C]/8 px-4 py-3 text-sm font-medium text-[#0E6E8C] hover:bg-[#0E6E8C]/15"
              >
                发起协同诊断
                <span className="mt-1 text-xs font-normal text-slate-500">五 Agent 协同定位根因</span>
              </Link>
            </Auth>
            <Auth code={[USER_PERM.CHAT_WRITE]}>
              <Link
                to="/diagnosis/chat"
                className="flex min-h-[72px] flex-col justify-center rounded-lg bg-[#0E6E8C]/8 px-4 py-3 text-sm font-medium text-[#0E6E8C] hover:bg-[#0E6E8C]/15"
              >
                智能问答
                <span className="mt-1 text-xs font-normal text-slate-500">知识库检索与引用溯源</span>
              </Link>
            </Auth>
            <Auth code={[USER_PERM.WORKORDER_READ]}>
              <Link
                to="/workorder"
                className="flex min-h-[72px] flex-col justify-center rounded-lg bg-[#0E6E8C]/8 px-4 py-3 text-sm font-medium text-[#0E6E8C] hover:bg-[#0E6E8C]/15"
              >
                维修工单
                <span className="mt-1 text-xs font-normal text-slate-500">查看与下载 PDF</span>
              </Link>
            </Auth>
            <Auth code={[USER_PERM.KNOWLEDGE_SEARCH_READ]}>
              <Link
                to="/knowledge"
                className="flex min-h-[72px] flex-col justify-center rounded-lg bg-[#0E6E8C]/8 px-4 py-3 text-sm font-medium text-[#0E6E8C] hover:bg-[#0E6E8C]/15"
              >
                知识检索
                <span className="mt-1 text-xs font-normal text-slate-500">手册语义/关键词检索</span>
              </Link>
            </Auth>
          </div>
        </Panel>

        <Panel title="最近诊断记录" extra={<Link to="/diagnosis/run" className="text-sm text-[#0E6E8C] hover:underline">全部记录</Link>}>
          {diagnosis.isLoading ? (
            <SkeletonPanel rows={4} />
          ) : (diagnosis.data?.records ?? []).length === 0 ? (
            <EmptyState title="暂无诊断记录" />
          ) : (
            <div className="flex flex-col gap-2">
              {(diagnosis.data?.records ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-slate-700">{r.rootCause || r.faultSummary || `诊断记录 #${r.id}`}</div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      设备 #{r.deviceId} · {r.conclusionTime ?? "-"}
                    </div>
                  </div>
                  <RiskTag level={r.riskLevel} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}