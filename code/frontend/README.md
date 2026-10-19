# HWC Frontend

工业设备巡检与运维智能系统 —— 前端双端（pnpm 单仓多包）。

## 结构

```
apps/
├── user-web/      # 用户端：React 18 + shadcn/ui + Tailwind（dev 5173 → 代理 Java :8080）
└── admin-web/     # 管理端：React 18 + Ant Design 5 + ECharts（dev 5174 → 代理 Java :8090）
packages/
├── shared-types/  # 通用 TS 类型（ApiResponse / 分页 / 登录态）
├── shared-api/    # fetch 封装：token 注入、统一响应解包、401 处理
├── shared-auth/   # zustand 登录态 + 权限判断（localStorage 持久化）
└── shared-ui/     # shadcn/ui 组件（cn 工具等，管理端不依赖）
```

## 常用命令

```bash
pnpm install
pnpm dev:user     # 用户端  http://localhost:5173
pnpm dev:admin    # 管理端  http://localhost:5174
pnpm typecheck
pnpm build:user && pnpm build:admin
```

## 约定

- API 请求统一走 `@hwc/shared-api` 的 `api.get/post/put/delete`，响应按 `{code, message, data, traceId}` 解包，`code !== 0` 抛 `ApiError`
- 权限码格式 `<模块>:<资源>:<动作>`，经 `useAuthStore().hasPermission(code)` 控制按钮/路由
- 用户端界面规范见 `docs/设计文档/前端界面布局设计.md`（一级导航 64px、shadcn + 反 AI 味）；管理端对齐 Ant Design Layout 规范（侧边 200px）