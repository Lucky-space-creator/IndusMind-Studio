import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DonutChart, EmptyState, HealthScore, Panel, SimpleBarChart, SkeletonPanel, StatusTag, tokens } from "@hwc/shared-ui";
import { fetchDashboard } from "../../api/dashboard";
import { parseMetricSnapshot } from "../dashboard/shared";

/** 设备总览看板：健康度分布 + 风险榜 + 指标网格 + 异常设备卡片墙 */
export default function DeviceOverviewPage() {
  const board = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard() });

  const metrics = board.data ?? [];
  const normal = metrics.filter((m) => m.status === "normal");
  const warning = metrics.filter((m) => m.status === "warning");
  const fault = metrics.filter((m) => m.status === "fault");
  const abnormal = metrics.filter((m) => m.status !== "normal");

  /** 指标名 → 平均值（最新快照聚合，展示全网关键指标） */
  const metricAvg = new Map<string, { sum: number; n: number }>();
  for (const m of metrics) {
    const snap = parseMetricSnapshot(m.metricSnapshot);
    for (const [k, v] of Object.entries(snap)) {
      const cur = metricAvg.get(k) ?? { sum: 0, n: 0 };
      cur.sum += v;
      cur.n += 1;
      metricAvg.set(k, cur);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="全网设备健康总览" subtitle="各设备最新快照聚合">
        {board.isLoading ? (
          <SkeletonPanel rows={6} />
        ) : metrics.length === 0 ? (
          <EmptyState title="暂无看板数据" />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DonutChart
              centerLabel="设备"
              data={[
                { name: "正常", value: normal.length, color: tokens.success },
                { name: "预警", value: warning.length, color: tokens.warning },
                { name: "故障", value: fault.length, color: tokens.danger },
                { name: "其他", value: Math.max(0, metrics.length - normal.length - warning.length - fault.length), color: "#94A3B8" },
              ]}
            />
            <div>
              <div className="mb-2 text-sm font-medium text-slate-600">停机风险榜（健康分最低）</div>
              <SimpleBarChart
                max={100}
                data={[...metrics]
                  .sort((a, b) => a.healthScore - b.healthScore)
                  .slice(0, 6)
                  .map((m) => ({
                    name: `设备 #${m.deviceId}`,
                    value: Math.round(m.healthScore),
                    unit: " 分",
                    color: m.healthScore < 60 ? tokens.danger : m.healthScore < 80 ? tokens.warning : tokens.success,
                  }))}
              />
            </div>
          </div>
        )}
      </Panel>

      <Panel title="关键指标均值" subtitle="最新快照聚合">
        {metricAvg.size === 0 ? (
          <EmptyState title="暂无指标数据" />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[...metricAvg.entries()].slice(0, 8).map(([name, { sum, n }]) => (
              <div key={name} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <div className="truncate text-xs text-slate-500">{name}</div>
                <div className="mt-1 text-xl font-bold tabular-nums text-slate-800">{(sum / (n || 1)).toFixed(1)}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="异常设备" subtitle="点击进入设备详情">
        {abnormal.length === 0 ? (
          <EmptyState title="全部设备运行正常" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {abnormal.map((m) => (
              <Link
                key={m.id}
                to={`/device/list/${m.deviceId}`}
                className={`rounded-lg border bg-white px-4 py-3.5 transition-colors hover:bg-slate-50 ${
                  m.status === "fault" ? "border-red-200" : "border-amber-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">设备 #{m.deviceId}</span>
                  <StatusTag status={m.status} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <HealthScore score={m.healthScore} />
                  <span className="text-xs text-slate-400">{m.anomalyCount} 项异常</span>
                </div>
                {m.riskHint && <div className="mt-1.5 truncate text-xs text-slate-500">{m.riskHint}</div>}
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}