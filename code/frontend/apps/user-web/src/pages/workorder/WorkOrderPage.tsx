import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Auth } from "@hwc/shared-auth";
import { EmptyState, Panel, RiskTag, SkeletonPanel, StatusTag } from "@hwc/shared-ui";
import { USER_PERM, type WoWorkOrder, type WoWorkOrderPart } from "@hwc/shared-types";
import { archiveWorkOrder, exportWorkOrderPdf, fetchWorkOrderDetail, fetchWorkOrders } from "../../api/workorder";
import { Drawer } from "../../components/Drawer";
import { showToast } from "../../components/Toast";

/** 维修工单：列表 + 详情抽屉 + PDF 下载/归档 */
export default function WorkOrderPage() {

  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);


  const orders = useQuery({
    queryKey: ["workorders", page, status],
    queryFn: () => fetchWorkOrders({ current: page, size: 10, status: status || undefined }),
  });

  const detail = useQuery({
    queryKey: ["workorder-detail", detailId],
    queryFn: () => fetchWorkOrderDetail(detailId!),
    enabled: detailId != null,
  });

  const exportPdf = useMutation({
    mutationFn: (id: number) => exportWorkOrderPdf(id),
    onSuccess: () => showToast("PDF 已开始下载", "success"),
    onError: (e: Error) => showToast(e.message || "导出失败", "error"),
  });

  const archive = useMutation({
    mutationFn: (id: number) => archiveWorkOrder(id),
    onSuccess: () => {
      showToast("已归档至对象存储", "success");
      queryClient.invalidateQueries({ queryKey: ["workorders"] });
    },
    onError: (e: Error) => showToast(e.message || "归档失败", "error"),
  });

  const total = orders.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <>
      <Panel
        title="维修工单"
        subtitle="由协同诊断结论汇总生成"
        extra={
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label="状态筛选"
            className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm"
          >
            <option value="">全部状态</option>
            <option value="generated">已生成</option>
            <option value="exported">已导出</option>
          </select>
        }
      >
        {orders.isLoading ? (
          <SkeletonPanel rows={6} />
        ) : (orders.data?.records ?? []).length === 0 ? (
          <EmptyState title="暂无工单，可在协同诊断完成后生成" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="px-3 py-2.5 font-medium">工单号</th>
                  <th className="px-3 py-2.5 font-medium">设备</th>
                  <th className="px-3 py-2.5 font-medium">故障/根因</th>
                  <th className="px-3 py-2.5 font-medium">风险</th>
                  <th className="px-3 py-2.5 font-medium">状态</th>
                  <th className="px-3 py-2.5 font-medium">生成时间</th>
                  <th className="px-3 py-2.5 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {(orders.data?.records ?? []).map((o: WoWorkOrder) => (
                  <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{o.orderNo}</td>
                    <td className="px-3 py-2.5 text-slate-700">#{o.deviceId}</td>
                    <td className="max-w-[220px] truncate px-3 py-2.5 text-slate-600">{o.rootCause || o.faultSummary || "-"}</td>
                    <td className="px-3 py-2.5">
                      <RiskTag level={o.riskLevel} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusTag label={o.status === "exported" ? "已导出" : "已生成"} tone={o.status === "exported" ? "normal" : "info"} />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{o.generatedTime ?? "-"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={() => setDetailId(o.id)} className="text-[#0E6E8C] hover:underline">
                          详情
                        </button>
                        <Auth code={[USER_PERM.WORKORDER_EXPORT]}>
                          <button
                            type="button"
                            onClick={() => exportPdf.mutate(o.id)}
                            disabled={exportPdf.isPending}
                            className="text-[#0E6E8C] hover:underline disabled:opacity-50"
                          >
                            下载 PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => archive.mutate(o.id)}
                            disabled={archive.isPending}
                            className="text-slate-500 hover:underline disabled:opacity-50"
                          >
                            归档
                          </button>
                        </Auth>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-end gap-3 text-sm">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
                >
                  上一页
                </button>
                <span className="text-xs text-slate-500">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* 工单详情抽屉 */}
      <Drawer open={detailId != null} title={`工单详情`} onClose={() => setDetailId(null)} width={520}>
        {detail.isLoading ? (
          <SkeletonPanel rows={8} />
        ) : detail.data ? (
          <OrderDetailBody order={detail.data.order} parts={detail.data.parts} />
        ) : (
          <EmptyState title="工单不存在" />
        )}
      </Drawer>
    </>
  );
}

function OrderDetailBody({ order, parts }: { order: WoWorkOrder; parts: WoWorkOrderPart[] }) {
  const rows: [string, string | number | undefined][] = [
    ["工单号", order.orderNo],
    ["设备", `#${order.deviceId}`],
    ["故障摘要", order.faultSummary],
    ["根因结论", order.rootCause],
    ["风险等级", order.riskLevel === "high" ? "高风险" : order.riskLevel === "medium" ? "中风险" : "低风险"],
    ["安全要求", order.safetyRequirements],
    ["维修步骤", order.repairSteps],
    ["预计停机", order.estDowntimeHours != null ? `${order.estDowntimeHours} 小时` : undefined],
    ["停机损失", order.downtimeCost != null ? `¥ ${order.downtimeCost}` : undefined],
    ["备件成本", order.partsCost != null ? `¥ ${order.partsCost}` : undefined],
    ["总成本", order.totalCost != null ? `¥ ${order.totalCost}` : undefined],
  ];
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-md border border-slate-200">
        {rows.map(([label, value], i) => (
          <div key={label} className={`grid grid-cols-[96px_1fr] gap-3 px-3.5 py-2.5 text-sm ${i % 2 ? "bg-slate-50/60" : ""}`}>
            <span className="text-slate-500">{label}</span>
            <span className="whitespace-pre-wrap text-slate-800">{value ?? "-"}</span>
          </div>
        ))}
      </div>
      {parts.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-medium text-slate-700">备件清单（含库存快照）</div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">备件</th>
                <th className="py-2 pr-3 font-medium">型号</th>
                <th className="py-2 pr-3 font-medium">数量</th>
                <th className="py-2 font-medium">库存快照</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3 text-slate-700">{p.partName}</td>
                  <td className="py-2 pr-3 text-slate-500">{p.partModel || "-"}</td>
                  <td className="py-2 pr-3 tabular-nums text-slate-700">{p.quantity}</td>
                  <td className="py-2 tabular-nums text-slate-500">{p.stockSnapshot ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}