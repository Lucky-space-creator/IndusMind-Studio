import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@hwc/shared-auth";
import { userLogin } from "../api/auth";

/** 用户端登录页（无 AntD 依赖，Tailwind 手写） */
export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("请输入账号和密码");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await userLogin({ username: username.trim(), password });
      setAuth(result);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F2437] p-4">
      <div className="w-full max-w-[380px] rounded-lg bg-white p-9 shadow-2xl">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0E6E8C] text-sm font-bold text-white">
            HW
          </span>
          <div>
            <div className="text-[17px] font-semibold text-slate-800">设备运维助手</div>
            <div className="text-xs text-slate-400">用户端 · 监控 · 问答 · 诊断 · 工单</div>
          </div>
        </div>
        {error && (
          <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}
        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">账号</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入账号"
              autoComplete="username"
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E6E8C] focus:ring-2 focus:ring-[#0E6E8C]/20"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E6E8C] focus:ring-2 focus:ring-[#0E6E8C]/20"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-1 h-11 rounded-md bg-[#0E6E8C] text-sm font-medium text-white transition-colors hover:bg-[#0B5871] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "登录中…" : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}