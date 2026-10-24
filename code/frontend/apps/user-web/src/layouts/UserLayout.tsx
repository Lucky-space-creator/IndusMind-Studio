import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuthStore, usePermission } from "@hwc/shared-auth";
import { USER_AUX_NAV, USER_NAV, type NavItem } from "./menus";

/** 顶部一级导航高度（对齐 Ant Design 展示范式） */
const HEADER_H = 64;
const SUB_H = 48;

function filterNav(items: NavItem[], hasAny: (codes: string[]) => boolean): NavItem[] {
  return items
    .filter((item) => !item.permissions || item.permissions.length === 0 || hasAny(item.permissions))
    .map((item) => (item.children ? { ...item, children: filterNav(item.children, hasAny) } : item));
}

/** 用户端整体框架：顶部一级导航(64px) + 二级导航(48px) + 主内容区 */
export default function UserLayout() {
  const { hasAny, permissions, dataScopeText } = usePermission();
  const location = useLocation();
  const realName = useAuthStore((s) => s.realName);
  const username = useAuthStore((s) => s.username);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [menuOpen, setMenuOpen] = useState(false);

  // permissions 参与依赖：权限刷新后 hasAny 的引用不变，只有权限集合变化才会重算菜单
  const nav = useMemo(() => filterNav(USER_NAV, hasAny), [hasAny, permissions]);
  const auxNav = useMemo(() => filterNav(USER_AUX_NAV, hasAny), [hasAny, permissions]);

  /** 当前一级项 + 其二级（含设备详情等隐式子页也归入设备监控） */
  const current = useMemo(() => {
    const active =
      nav.find((n) => n.path && n.path !== "/" && location.pathname.startsWith(n.path)) ??
      (location.pathname === "/" ? nav.find((n) => n.key === "dashboard") : undefined);
    return active;
  }, [location.pathname, nav]);

  const subNav = current?.children ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* 一级导航 */}
      <header
        className="fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-[#0F2437] px-4 text-white lg:px-6"
        style={{ height: HEADER_H }}
      >
        <div className="flex min-w-0 items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label="回到工作台">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0E6E8C] text-sm font-bold">HW</span>
            <span className="hidden text-[15px] font-semibold sm:inline">设备运维助手</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="一级导航">
            {nav.map((item) => (
              <NavLink
                key={item.key}
                to={item.path ?? "/"}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `rounded-md px-3.5 py-2 text-sm transition-colors ${
                    isActive ? "bg-white/15 font-medium text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                {item.title}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1.5">
          {auxNav.map((item) => (
            <Link
              key={item.key}
              to={item.path ?? "/"}
              className="hidden rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              {item.title}
            </Link>
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              className="flex min-h-[44px] items-center gap-2 rounded-md px-2.5 text-sm text-slate-200 hover:bg-white/10"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0E6E8C] text-xs font-semibold">
                {(realName || username || "?").slice(0, 1)}
              </span>
              <span className="hidden max-w-[8rem] truncate sm:inline">{realName || username}</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-slate-700 shadow-xl">
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2.5 text-sm hover:bg-slate-50"
                >
                  个人中心
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    clearAuth();
                    window.location.hash = "#/login";
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50"
                >
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 二级导航（无二级时隐藏，内容区上移） */}
      {subNav.length > 0 && (
        <div
          className="fixed inset-x-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"
          style={{ top: HEADER_H, height: SUB_H }}
        >
          <div className="mx-auto flex h-full max-w-[1440px] items-center gap-1 overflow-x-auto px-4 lg:px-6">
            {subNav.map((item) => (
              <NavLink
                key={item.key}
                to={item.path ?? "#"}
                end
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
                    isActive ? "bg-[#0E6E8C]/10 font-medium text-[#0E6E8C]" : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                {item.title}
              </NavLink>
            ))}
            {dataScopeText !== "全部数据" && (
              <span className="ml-auto whitespace-nowrap text-xs text-slate-400">数据范围：{dataScopeText}</span>
            )}
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <main
        className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-10 lg:px-6"
        style={{ paddingTop: HEADER_H + (subNav.length > 0 ? SUB_H : 0) + 20 }}
      >
        <Outlet />
      </main>
    </div>
  );
}