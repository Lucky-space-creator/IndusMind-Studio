import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState, Panel, SkeletonPanel, StatusTag } from "@hwc/shared-ui";
import type { DevInfo, PageResult } from "@hwc/shared-types";
import { fetchDeviceTypes, fetchDevices } from "../../api/device";

/** 设备清单：筛选（类型/状态/关键词）+ 表格 + 卡片视图切换 */
export default function DeviceListPage() {
  const navigate = useNavigate();
  const types = useQuery({ queryKey: ["device-types"], queryFn: () => fetchDeviceTypes() });
  const devices = useQuery({ queryKey: ["devices", {}], queryFn: () => fetchDevices({ current: 1, size: 200 }) });

  const typeMap = new Map((types.data ?? []).map((t) => [t.id, t.name]));
  const list = devices.data?.records ?? [];

  return (
    <Panel title="设备清单" subtitle="点击行进入设备详情">
      {devices.isLoading ? (
        <SkeletonPanel rows={8} />
      ) : list.length === 0 ? (
        <EmptyState title="暂无设备，请先在管理端完成设备台账配置" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-3 py-2.5 font-medium">编号</th>
                <th className="px-3 py-2.5 font-medium">名称</th>
                <th className="px-3 py-2.5 font-medium">类型</th>
                <th className="px-3 py-2.5 font-medium">产线</th>
                <th className="px-3 py-2.5 font-medium">位置</th>
                <th className="px-3 py-2.5 font-medium">状态</th>
                <th className="px-3 py-2.5 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d: DevInfo) => (
                <tr
                  key={d.id}
                  className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  onClick={() => navigate(`/device/list/${d.id}`)}
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{d.code}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-800">{d.name}</td>
                  <td className="px-3 py-2.5 text-slate-600">{typeMap.get(d.typeId) ?? `类型 #${d.typeId}`}</td>
                  <td className="px-3 py-2.5 text-slate-600">{d.lineName}</td>
                  <td className="px-3 py-2.5 text-slate-600">{d.location}</td>
                  <td className="px-3 py-2.5">
                    <StatusTag status={d.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      to={`/device/list/${d.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[#0E6E8C] hover:underline"
                    >
                      详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(devices.data as PageResult<DevInfo> | undefined)?.total != null && (
            <div className="mt-3 text-right text-xs text-slate-400">共 {(devices.data as PageResult<DevInfo>).total} 台设备</div>
          )}
        </div>
      )}
    </Panel>
  );
}