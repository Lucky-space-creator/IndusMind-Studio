import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuthStore, usePermission } from "@hwc/shared-auth";
import { EmptyState, Panel, PermissionList, RiskTag, SkeletonPanel } from "@hwc/shared-ui";
import { fetchDiagnosisRecords } from "../../api/diagnosis";
import { fetchWorkOrders } from "../../api/workorder";

/** 个人中心：账号信息 + 我的诊断 + 我的工单 */
export default function ProfilePage() {
  const realName = useAuthStore((s) => s.realName);
  const username = useAuthStore((s) => s.username);
  const roles = useAuthStore((s) => s.roles);
  const permissions = useAuthStore((s) => s.permissions);
  const permissionDetails = useAuthStore((s) => s.permissionDetails);
  const { dataScopeText } = usePermission();
  const diagnosis = useQuery({ queryKey: ["profile-diagnosis"], queryFn: () => fetchDiagnosisRecords({ current: 1, size: 5 }) });
  const orders = useQuery({ queryKey: ["profile-orders"], queryFn: () => fetchWorkOrders({ current: 1, size: 5 }) });

  return (
    <div className="flex flex-col gap-4">
      <Panel title="账号信息">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm md:grid-cols-4">
          <div>
            <div className="text-xs text-slate-500">姓名</div>
            <div className="mt-0.5 text-slate-800">{realName || username || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">账号</div>
            <div className="mt-0.5 font-mono text-slate-800">{username || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">角色</div>
            <div className="mt-0.5 text-slate-800">{roles.length ? roles.join("、") : "-"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">数据范围</div>
            <div className="mt-0.5 text-slate-800">{dataScopeText}</div>
          </div>
        </div>
      </Panel>

      <Panel
        title="我的权限"
        subtitle={`共 ${permissionDetails.length} 项`}
        extra={<span className="text-xs text-slate-400">管理员调整权限后自动同步</span>}
      >
        <PermissionList
          items={permissionDetails}
          emptyHint={
            permissions.length > 0
              ? "已获得权限，明细仍在同步，请稍后刷新"
              : "当前账号暂无已授权的权限点，请联系管理员分配角色"
          }
        />
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="我的诊断记录" extra={<Link to="/diagnosis/run" className="text-sm text-[#0E6E8C] hover:underline">发起诊断</Link>}>
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
                    <div className="mt-0.5 text-xs text-slate-400">{r.conclusionTime ?? "-"}</div>
                  </div>
                  <RiskTag level={r.riskLevel} />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="我的工单" extra={<Link to="/workorder" className="text-sm text-[#0E6E8C] hover:underline">全部工单</Link>}>
          {orders.isLoading ? (
            <SkeletonPanel rows={4} />
          ) : (orders.data?.records ?? []).length === 0 ? (
            <EmptyState title="暂无工单" />
          ) : (
            <div className="flex flex-col gap-2">
              {(orders.data?.records ?? []).map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-slate-500">{o.orderNo}</div>
                    <div className="mt-0.5 truncate text-sm text-slate-700">{o.faultSummary || "-"}</div>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{o.generatedTime ?? "-"}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}