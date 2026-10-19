import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Auth } from "@hwc/shared-auth";
import {
  EmptyState,
  HealthScore,
  Panel,
  RiskTag,
  SkeletonPanel,
  StatusTag,
  ThresholdLineChart,
  tokens,
  type ChartSeries,
} from "@hwc/shared-ui";
import { USER_PERM } from "@hwc/shared-types";
import { fetchDevice } from "../../api/device";
import { fetchDashboard, fetchDashboardHistory } from "../../api/dashboard";
import { fetchDiagnosisRecords } from "../../api/diagnosis";
import { fetchWorkOrders } from "../../api/workorder";
import { parseMetricSnapshot } from "../dashboard/shared";

type TabKey = "overview" | "trend" | "risk" | "diagnosis" | "orders";

const TABS: { key: TabKey; title: string }[] = [
  { key: "overview", title: "概览" },
  { key: "trend", title: "健康趋势" },
  { key: "risk", title: "风险历史" },
  { key: "diagnosis", title: "历史诊断" },
  { key: "orders", title: "历史工单" },
];

/** 设备详情：头部信息卡 + Tabs（概览/趋势/风险/诊断/工单） */
export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const deviceId = Number(id);
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("overview");

  const device = useQuery({ queryKey: ["device", deviceId], queryFn: () => fetchDevice(deviceId), enabled: !!deviceId });
  const board = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard() });
  const history = useQuery({
    queryKey: ["dashboard-history", deviceId],
    queryFn: () => fetchDashboardHistory(deviceId, 1, 50),
    enabled: !!deviceId,
  });
  const diagnosis = useQuery({
    queryKey: ["diagnosis-by-device", deviceId],
    queryFn: () => fetchDiagnosisRecords({ current: 1, size: 10, deviceId }),
    enabled: !!deviceId,
  });
  const orders = useQuery({
    queryKey: ["orders-by-device", deviceId],
    queryFn: () => fetchWorkOrders({ current: 1, size: 10, deviceId }),
    enabled: !!deviceId,
  });

  const latest = useMemo(
    () => (board.data ?? []).find((m) => m.deviceId === deviceId),
    [board.data, deviceId],
  );
  const snapshots = history.data?.records ?? [];
  const trendSeries: ChartSeries[] = useMemo(
    () => [
      {
        name: "健康分",
        points: [...snapshots]
          .sort((a, b) => new Date(a.snapshotTime).getTime() - new Date(b.snapshotTime).getTime())
          .map((s) => ({ x: new Date(s.snapshotTime).getTime(), y: s.healthScore })),
      },
    ],
    [snapshots],
  );
  const latestMetrics = parseMetricSnapshot(latest?.metricSnapshot);

  if (device.isLoading) {
    return <SkeletonPanel rows={8} />;
  }
  if (!device.data) {
    return <EmptyState title="设备不存在或已被删除" />;
  }
  const info = device.data;

  return (
    <div className="flex flex-col gap-4">
      {/* 头部：设备信息 + 健康分 + 状态 */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold text-slate-800">{info.name}</h2>
              <StatusTag status={latest?.status ?? info.status} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500">
              <span className="font-mono">{info.code}</span>
              <span>产线：{info.lineName}</span>
              <span>位置：{info.location}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <div className="text-xs text-slate-500">健康评分</div>
            <HealthScore score={latest?.healthScore} />
          </div>
          <div className="flex flex-col gap-2">
            <Auth code={[USER_PERM.DIAGNOSIS_WRITE]}>
              <button
                type="button"
                onClick={() => navigate(`/diagnosis/run?deviceId=${deviceId}`)}
                className="rounded-md bg-[#0E6E8C] px-4 py-2 text-sm text-white hover:bg-[#0B5871]"
              >
                发起诊断
              </button>
            </Auth>
            <Auth code={[USER_PERM.DIAGNOSIS_WRITE]}>
              <Link to="/workorder" className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm text-slate-600 hover:bg-slate-50">
                生成工单
              </Link>
            </Auth>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm ${
              tab === t.key
                ? "border-b-2 border-[#0E6E8C] font-medium text-[#0E6E8C]"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.title}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Panel title="关键指标（最新快照）" subtitle={latest ? `快照时间 ${latest.snapshotTime}` : undefined}>
          {Object.keys(latestMetrics).length === 0 ? (
            <EmptyState title="暂无指标快照" />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Object.entries(latestMetrics).map(([name, value]) => (
                <div key={name} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <div className="truncate text-xs text-slate-500">{name}</div>
                  <div className="mt-1 text-xl font-bold tabular-nums text-slate-800">{value}</div>
                </div>
              ))}
            </div>
          )}
          {latest?.riskHint && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
              风险提示：{latest.riskHint}
            </div>
          )}
        </Panel>
      )}

      {tab === "trend" && (
        <Panel title="健康分趋势" subtitle="近 50 次快照">
          {trendSeries[0].points.length === 0 ? (
            <EmptyState title="暂无快照历史" />
          ) : (
            <ThresholdLineChart
              series={trendSeries}
              yDomain={[0, 100]}
              thresholds={{ warnMax: 80, faultMax: 60 }}
              height={260}
              onPointClick={(_, p) => navigate(`/alarm?at=${p.x}`)}
            />
          )}
        </Panel>
      )}

      {tab === "risk" && (
        <Panel title="风险历史" subtitle="非正常状态快照">
          {snapshots.filter((s) => s.status !== "normal").length === 0 ? (
            <EmptyState title="历史快照均正常" />
          ) : (
            <div className="flex flex-col gap-2">
              {snapshots
                .filter((s) => s.status !== "normal")
                .map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-700">{s.riskHint || "检测到异常状态"}</div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {s.snapshotTime} · {s.anomalyCount} 项异常 · 数据集 #{s.datasetId}
                      </div>
                    </div>
                    <StatusTag status={s.status} />
                  </div>
                ))}
            </div>
          )}
        </Panel>
      )}

      {tab === "diagnosis" && (
        <Panel title="历史诊断">
          {(diagnosis.data?.records ?? []).length === 0 ? (
            <EmptyState title="暂无诊断记录" />
          ) : (
            <div className="flex flex-col gap-2">
              {(diagnosis.data?.records ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-slate-700">{r.rootCause || r.faultSummary || `诊断记录 #${r.id}`}</div>
                    <div className="mt-0.5 text-xs text-slate-400">{r.conclusionTime ?? "-"}</div>
                  </div>
                  <RiskTag level={r.riskLevel} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === "orders" && (
        <Panel title="历史工单">
          {(orders.data?.records ?? []).length === 0 ? (
            <EmptyState title="暂无工单" />
          ) : (
            <div className="flex flex-col gap-2">
              {(orders.data?.records ?? []).map((o) => (
                <Link
                  key={o.id}
                  to={`/workorder?focus=${o.id}`}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-slate-500">{o.orderNo}</div>
                    <div className="mt-0.5 truncate text-sm text-slate-700">{o.faultSummary || "-"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <RiskTag level={o.riskLevel} />
                    <StatusTag status={o.status === "exported" ? "exported" : "generated"} label={o.status === "exported" ? "已导出" : "已生成"} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      )}

      <div className="text-xs text-slate-400" style={{ color: tokens.textSecondary }}>
        设备运行信息以管理端台账为准；本页展示监控快照与诊断工单历史。
      </div>
    </div>
  );
}