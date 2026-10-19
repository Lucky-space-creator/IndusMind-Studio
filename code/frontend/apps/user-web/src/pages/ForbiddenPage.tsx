import { Link } from "react-router-dom";

/** 403 无权限页 */
export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center">
      <div className="text-5xl font-bold text-slate-300">403</div>
      <div className="text-lg font-medium text-slate-700">没有访问权限</div>
      <p className="max-w-sm text-sm text-slate-500">当前账号未获得该功能的访问权限，请联系管理员分配相应角色。</p>
      <Link to="/" className="rounded-md bg-[#0E6E8C] px-4 py-2 text-sm text-white hover:bg-[#0B5871]">
        返回工作台
      </Link>
    </div>
  );
}