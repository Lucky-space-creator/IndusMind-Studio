import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@hwc/shared-auth";

/** 403 无权限页 */
export default function ForbiddenPage() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center">
      <div className="text-5xl font-bold text-slate-300">403</div>
      <div className="text-lg font-medium text-slate-700">没有访问权限</div>
      <p className="max-w-sm text-sm text-slate-500">
        当前账号未获得该功能的访问权限。若管理员刚刚调整了权限，切换窗口或返回工作台即可自动生效；也可以联系管理员分配相应角色。
      </p>
      <div className="flex items-center gap-3">
        <Link to="/" className="rounded-md bg-[#0E6E8C] px-4 py-2 text-sm text-white hover:bg-[#0B5871]">
          返回工作台
        </Link>
        {/* 权限被全部收回时会停留本页，提供退出入口避免卡死 */}
        <button
          type="button"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          onClick={() => {
            clearAuth();
            navigate("/login", { replace: true });
          }}
        >
          退出并重新登录
        </button>
      </div>
    </div>
  );
}