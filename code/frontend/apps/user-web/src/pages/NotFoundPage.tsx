import { Link, useLocation } from "react-router-dom";

/** 用户端 404：路由未命中时兜底，避免出现整页空白 */
export default function NotFoundPage() {
  const location = useLocation();
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center">
        <div className="text-3xl font-bold text-slate-300">404</div>
        <h1 className="mt-2 text-base font-semibold text-slate-800">页面不存在</h1>
        <p className="mt-2 break-all text-sm text-slate-500">
          未找到路径 <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{location.pathname}</code>
          ，可能已调整或当前账号无对应入口。
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link to="/" className="rounded-md bg-[#0E6E8C] px-4 py-2 text-sm text-white hover:bg-[#0B5871]">
            回到工作台
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            返回上一页
          </button>
        </div>
      </div>
    </div>
  );
}
