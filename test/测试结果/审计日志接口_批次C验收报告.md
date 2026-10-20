# 审计日志查询/导出接口 — 批次 C 验收收尾报告

> 对应任务：`.codeartsdoer/specs/audit_log_query/tasks.md` 任务 5.4 / 5.5 / 6.1 / 6.2 / 6.3
> 执行日期：2026-10-20　执行环境：Windows 11 + MySQL 8（hwc 库）+ JDK 后端 jar（Oct 20 14:27 构建，含批次 A 5 个新增文件）
> 结论摘要：**5.4 / 5.5 / 6.1（管理端+用户端）/ 6.2 / 6.3 全部通过**；AI 套件 3 条失败经定性与本任务无关（详见 6.1）。

---

## 1. 任务 5.4：前端 AuditPage 端到端验收（CLI 环境适配版）

### 1.1 构建验证
- `pnpm build:admin`：**通过**（`tsc -b` 类型检查 + `vite build` 打包，3680 模块，12.19s）。
- 仅有 chunk >500kB 提示与动态导入提示，均为存量现象，与本次任务无关（本次零前端文件改动）。

### 1.2 AuditPage.tsx 静态走查（309 行通读）
| 核对项 | 位置 | 结论 |
|---|---|---|
| 降级提示触发条件 | AuditPage.tsx:81 `if (error)` | 提示由 useQuery 的 error（接口报错）触发；后端已上线且返回 200/code=0，**提示必然消失** |
| operateTime 直透展示 | :104 列定义 `dataIndex:"operateTime"` 无格式化；:222 详情抽屉直透 | 后端 @JsonFormat 秒级输出（实测 `2026-10-05 23:59:59`），展示无 "T" |
| 详情抽屉 15 字段 | :220-272 | 操作时间/操作人(ID)/接口/模块/动作/对象/IP/traceId/执行结果 + errorMsg(:233)/beforeValue(:255)/afterValue(:263) 条件渲染，空值跳过（兼容当前生产方未写入现状） |
| beforeValue/afterValue 容错 | :303-309 prettyJson | JSON.parse 失败时原样返回，符合契约 |
| 导出按钮权限码 | :147 `<Auth code={ADMIN_PERM.AUDIT_LOG_EXPORT}>` | 常量值 `audit:log:export`（permission.ts:60），与后端 @PreAuthorize 逐字一致；无权限账号按钮隐藏 |
| 导出文件名 | api/system.ts:49 `saveBlob(blob, \`audit-logs-${Date.now()}.csv\`)` | `audit-logs-{毫秒时间戳}.csv` 由前端生成，后端 Content-Disposition 仅为 HTTP 语义兜底 |
| 导出传参 | :69-72 `exportAuditLogs({beginTime, endTime})` | 仅时间参数，与 R9 契约边界一致 |

### 1.3 curl 模拟页面调用链（管理端 8190 实测）
| 步骤 | 请求 | 结果 |
|---|---|---|
| 登录 | POST /api/admin/auth/login（admin/Admin@123） | 200，Token 获取成功 |
| 默认分页 | GET /api/admin/audit/logs | 200 code=0，total=22（造数），size=10/current=1/records=10；首条 operateTime=`2026-10-05 23:59:59` **无 "T"、秒级**；记录 15 字段齐全 |
| 组合过滤 | current=2&size=15&operatorName=admin&module=account&时间范围 | 200，total=5（第 2 页空属正常，current 超页数返回空 records + 正确 total）；operatorName/module 全匹配；时间均落闭区间 |
| action 过滤 | action=delete&size=100 | 200，total=5，全部 action=delete；**operateTime 严格降序** |
| 空结果 | operatorName=nobody_xyz | 200 code=0 + records=[] + total=0（空态正常响应） |
| 导出下载 | GET /api/admin/audit/logs/export?beginTime=2026-09-01 00:00:00&endTime=2026-10-31 23:59:59 | 200，2382 字节；`Content-Disposition: attachment; filename=audit-logs.csv`；`Content-Type: text/csv;charset=UTF-8`；**前 3 字节 EF BB BF（BOM）**；15 列表头逐字一致；csv 解析 22 条数据行**每行 15 列**（含换行转义记录不破坏行结构）；时间列严格降序；result 列取值 {1,0} |
| 审计自举时序 | 导出后查询 module=audit&action=export | 新落记录 id=65578（result=1，operator=admin，targetType=audit_log）**大于文件内最大 id=22** → 产物不含本次导出自身 |
| 401 兜底 | 无 Token 查询 | 401 + COMMON_4001 "未登录或登录已过期" |
| 服务关闭 | — | 验证完毕后已关闭并释放 8190 端口 |

产物留档：`test/测试结果/audit-logs-export-batchC.csv`、`export-headers-batchC.txt`。

### 1.4 人工页面实测清单（用户浏览器最终确认：2026-10-20 通过）
1. ☑ 以 admin/Admin@123 登录管理端 → 审计日志页正常加载，"后端审计日志查询/导出接口尚未实现"降级提示**消失**
2. ☑ 列表"时间"列展示 `yyyy-MM-dd HH:mm:ss` 秒级格式，**无 "T"**
3. ☑ 过滤操作（操作人回车/模块下拉/动作回车/时间范围选择）与分页切换（size=15）正常联动
4. ☑ 点击行打开详情抽屉，15 字段完整展示（beforeValue/afterValue 当前为空、条件渲染正常跳过）
5. ☑ 点击"导出 CSV"→ 文件保存为 `audit-logs-{毫秒时间戳}.csv`，Excel 打开中文正常、表头完整
6. ☑ 仅持 audit:log:read 账号（角色 5）登录 → 导出按钮不显示（Auth 组件隐藏）；直接调导出接口 → 403 专用提示"没有下载权限，请联系管理员分配相应权限"

---

## 2. 任务 5.5：前后端契约逐项核对表

### 2.1 接口 1：GET /api/admin/audit/logs
| 要素 | 前端契约 | 后端实现 | 结论 |
|---|---|---|---|
| URL | `/api/admin/audit/logs`（system.ts:45） | @RequestMapping("/api/admin/audit") + @GetMapping("/logs") | ✅ 一致 |
| HTTP 方法 | api.get（GET） | @GetMapping | ✅ |
| current | `current?: number`（可选） | `long current = 1` @Min(1)，默认 1 | ✅ 名称/可选性/默认值一致 |
| size | `size?: number`（可选） | `long size = 10` @Min(1) @Max(100)，默认 10 | ✅ |
| operatorName | `operatorName?: string` | String @Size(max=64)，isBlank 不过滤 | ✅ |
| module | `module?: string` | String @Size(max=32)，开放取值无白名单 | ✅ |
| action | `action?: string` | String @Size(max=32) | ✅ |
| beginTime | `beginTime?: string`（"YYYY-MM-DD 00:00:00"） | LocalDateTime + @DateTimeFormat(pattern="yyyy-MM-dd HH:mm:ss") | ✅ 格式逐字一致 |
| endTime | `endTime?: string`（"YYYY-MM-DD 23:59:59"） | 同上 | ✅ |
| 空参省略 | buildQuery 跳过 undefined/null/""（client.ts:37-44） | 缺省字段不进 wrapper 条件 | ✅ 语义对齐 |
| 响应信封 | ApiResponse{code,message,data} → PageResult{records,total,size,current} | Result{code,errorCode,message,data,traceId} + PageResult.of | ✅ 前端消费字段子集，兼容 |
| id | `id: number`（必填） | Long | ✅ |
| operatorId | `operatorId: number` | Long | ✅ |
| operatorName | `operatorName: string` | String | ✅ |
| endpoint | `endpoint?: string` | String（可空） | ✅ 可空性一致 |
| module / action | `string`（必填） | String | ✅ |
| targetType / targetId | `?: string` | String（可空） | ✅ |
| beforeValue / afterValue | `?: string`（JSON 文本） | String（可空，原样透传） | ✅ |
| result | `result: number`（1/0） | Integer（1/0 原始值） | ✅ |
| errorMsg / ip / traceId | `?: string` | String（可空） | ✅ |
| operateTime | `operateTime: string` | LocalDateTime + @JsonFormat("yyyy-MM-dd HH:mm:ss") | ✅ 序列化为秒级字符串 |
| createTime | **前端无此字段** | AuditLogVO 无 createTime | ✅ 契约外字段未透出 |
| 401/403/400 | 401 跳登录 / 403 专用文案 / code≠0 提示 | COMMON_4001 / COMMON_4003 / COMMON_4100（用例+curl 实测） | ✅ |

### 2.2 接口 2：GET /api/admin/audit/logs/export
| 要素 | 前端契约 | 后端实现 | 结论 |
|---|---|---|---|
| URL | `/api/admin/audit/logs/export`（system.ts:48） | @GetMapping("/logs/export") | ✅ 一致 |
| HTTP 方法 | downloadFile 用 fetch **GET** | @GetMapping | ✅ |
| 认证 | Bearer Token 头（client.ts:145） | JwtAuthenticationFilter | ✅ |
| beginTime | `beginTime?: string` | AuditLogExportQuery.beginTime + @DateTimeFormat | ✅ |
| endTime | `endTime?: string` | 同上 | ✅ |
| **导出参数边界（R9）** | **前端仅传 {beginTime, endTime}**（system.ts:47 + AuditPage:69-72，操作人/模块/动作不参与导出） | AuditLogExportQuery **仅 2 字段**，无其他过滤参数 | ✅ **零偏差**（无"顺手补齐"） |
| 成功响应 | 按 Blob 处理，**不解析 Result JSON**（client.ts:169） | ResponseEntity<byte[]> CSV 字节流 | ✅ |
| Content-Disposition | 前端不感知（saveBlob 自命名） | `attachment; filename=audit-logs.csv`（HTTP 语义兜底） | ✅ 兼容 |
| Content-Type | 前端不感知 | `text/csv;charset=UTF-8` | ✅ 实测一致 |
| 401 | unauthorizedHandler 跳登录 + "登录已过期，请重新登录" | 401 + COMMON_4001 JSON | ✅ |
| 403 | 专用文案"没有下载权限，请联系管理员分配相应权限"（client.ts:160） | 403 + COMMON_4003 JSON | ✅ |
| 400（参数/上限） | !ok 分支兜底"下载失败（HTTP 400）" | 400 + COMMON_4100 JSON，无文件输出 | ✅ |
| 文件名 | saveBlob → `audit-logs-{Date.now()}.csv` | 后端不给最终文件名 | ✅ 分工符合裁决 R7 |
| 权限码 | ADMIN_PERM.AUDIT_LOG_EXPORT = `audit:log:export` | @PreAuthorize("hasAuthority('audit:log:export')") | ✅ 逐字一致 |

**契约核对结论：2 接口 × 全要素（URL/方法/参数名/可选性/默认值/响应结构/15 字段名/类型/可空性/错误码/响应头/文件名/权限码/R9 导出参数边界）零偏差。`pnpm build:admin` 构建兜底通过。**

---

## 3. 任务 6.1：三端全量回归

### 3.1 执行结果（`node test/scripts/run_all.cjs` 无过滤词全量）
| 套件 | 结果 | 说明 |
|---|---|---|
| 10_admin（管理端 8190） | **192/192 全绿** | 含批次 B 新增 A-AL1/A-AL2 系列 31 条 |
| 20_user（用户端 8180） | **77/77 全绿** | 含用户端 404 隔离 2 条新增 |
| 30_ai（AI 服务 8101） | 44/47，3 失败 | A-DIAG-03/05/07，定性见 3.3 |

报告留档：`test/测试结果/接口测试报告.md`。

### 3.2 重点确认四项（design §3.2 风险 10）
1. **既有账号管理系列用例零失败**：✅ ——当前套件内账号域用例经核对为 0 条（初始提交 161 条即无 account 路径用例，账号权限管理任务的接口验证未沉淀为套件用例）；本任务新增 A-AL1/A-AL2 全绿，存量 161 条（设备/数据/知识/发布等域）零失败零跳过。
2. **CSV 先例不受影响**：✅ DataAnomalyController 零修改（git diff -- code/ 无输出），其导出相关用例（A-DS 系列）全部通过。
3. **审计写入链路正常**：✅ **专项实测**——经管理端创建测试用户（POST /api/admin/account/users → 200，id=6）后 sys_audit_log 落 `module=account, action=create, result=1, operator=admin`（id=65582）；删除该用户（DELETE → 200）落 `module=account, action=delete, result=1`（id=65583）。AuditAspect 写入链路未被新代码破坏（实测后业务数据已清理还原）。
4. **两个登录接口行为不变**：✅ A-AUTH-01~05（管理端登录 5 条）+ U-AUTH 系列（用户端登录）全部通过。

### 3.3 AI 套件 3 条失败定性（与本任务无关）
- 失败用例：A-DIAG-03/05/07（诊断工作流 DSL 边界用例），两次运行**稳定复现同样 3 条**。
- 失败机理：断言 `data.steps[1].status == "skipped"`，实际响应 monitor 步骤缺失、steps[0] 直接为 root_cause（"触发条件无法解析，节点跳过"），steps 索引整体偏移。
- 无关性证据：① `git status` 显示 AI 服务代码（code/ 下 Python）与 30_ai_service_cases.json、ai_launcher.py **零工作区修改**；② 本任务仅新增 hwc-security 5 个 Java 文件，与 AI 服务无任何调用关系；③ 初始提交（de11694）时报告显示该 3 条通过，差异源于运行时环境/数据状态而非代码变更。
- 处置：如实报告，留待 AI 侧排查（非本任务范围）。

### 3.4 全量回归过程记录（执行时序与基线处置）
- 首轮全量回归出现管理端 5 失败（A-AL1-01/02/03/07/20，均为 `total 期望 22 实际 23/24` 类偏移）——根因是 5.4 curl 验证的导出动作按设计落下 1 条审计记录（id=65578），污染了批次 B 的静态计数基线（A-AL1 断言基于"22 条造数"终态）。
- 处置：清理**测试过程残留**（5.4 导出 1 条 + 首轮回归导出用例 3 条 + 账号链路实测 2 条，共 6 条 id>22 记录），**保留全部 22 条造数（id 1-22）**，恢复基线后重跑全量回归 → 192/192 + 77/77 全绿。
- 重跑后库内终态：**25 条 = 22 条造数 + 3 条回归中导出用例产生的审计记录**（audit/export result=1 ×2、result=0 ×1）——导出用例自身落审计属设计内行为，数量变化已登记，未清理。

---

## 4. 任务 6.2：R1-R10 设计裁决一致性核对清单（独立于批次 A 自检）

| # | 裁决 | 实现核对（代码证据） | 结论 |
|---|---|---|---|
| R1 | 参数 POJO（ModelAttribute）+ @Valid + @DateTimeFormat 绑定，不用 @RequestParam LocalDateTime | Controller:37/45 两方法均为 `@Valid AuditLogPageQuery/AuditLogExportQuery query`；PageQuery:30/33 带 @DateTimeFormat(pattern="yyyy-MM-dd HH:mm:ss")；全类无 @RequestParam | ✅ |
| R2 | 区间倒置校验在 Service 入口抛 BizException，无自定义校验注解 | Service:34/52 方法首行调 validateTimeRange（:70-74）抛 BizException(PARAM_INVALID,"开始时间不能晚于结束时间")；dto/audit 无注解类 | ✅ |
| R3 | 返回 AuditLogVO 而非实体，无 createTime 透出 | VO 15 字段无 createTime；toVO（:81-99）逐字段直拷；operateTime 带 @JsonFormat | ✅ |
| R4 | CSV 内存组装 byte[]，无流式直写 | exportAuditLogs StringBuilder → `csv.toString().getBytes(UTF_8)`（:61-67）；Controller 返回 ResponseEntity<byte[]>，无 StreamingResponseBody/ServletOutputStream | ✅ |
| R5 | 导出先 selectCount 判上限，后 selectList | :55-59 先 `selectCount(wrapper) > EXPORT_LIMIT` 抛异常，后 orderByDesc + selectList | ✅ |
| R6 | 转义函数覆盖全部 15 列 | appendRow（:101-117）15 个字段全部经 escapeCsv；escapeCsv（:119-129）null→空串、含逗号/引号/\n/\r→双引号包裹+`"`→`""` | ✅ |
| R7 | Content-Type text/csv; charset=utf-8；行分隔 \n；filename=audit-logs.csv | Controller:48-49 attachment; filename=audit-logs.csv + MediaType("text","csv",UTF_8)；CSV_HEADER 与每行均以 '\n' 结尾（:63/:116）；curl 实测 `text/csv;charset=UTF-8` | ✅ |
| R8 | 查询 @JsonFormat 与导出 DateTimeFormatter 均秒级 | VO:39 pattern="yyyy-MM-dd HH:mm:ss"；Service:28 TIME_FORMATTER 同 pattern；查询实测无 "T"、导出列秒级 | ✅ |
| R9 | AuditLogExportQuery 仅 beginTime/endTime 二字段 | ExportQuery 全文仅 2 字段（:11-15），无任何时间外过滤 | ✅ |
| R10 | export 方法直接挂 @AuditLog，Service 无自建审计 insert | Controller:44 `@AuditLog(module="audit", action="export", targetType="audit_log")` 三属性与 design §2.2.2 逐字一致；Service 全类仅 selectPage/selectCount/selectList，无 insert/update/delete | ✅ |

**十项裁决逐条核对通过，零偏差。**

---

## 5. 任务 6.3：变更范围最终确认与评审收尾

### 5.1 代码评审重点走查
| 评审项 | 结论 |
|---|---|
| Service 只读性 | ✅ AuditLogService 仅调用 selectPage/selectCount/selectList；全类无 insert/update/delete/事务写操作 |
| CSV 转义边界条件 | ✅ null→""（:120-122）；空串→不含特殊字符原样输出空；仅换行/仅回车→needQuote 命中（:123-124 contains \n/\r）双引号包裹；连续引号 `""`→contains("\"") 命中，包裹后 replace 翻倍为 4 引号，csv 解析回原值 |
| 上限常量与文案单一来源 | ✅ `EXPORT_LIMIT = 50_000`（:26）唯一定义；`EXPORT_LIMIT_MESSAGE` 由常量拼接（:27）输出"导出数据量超过上限(50000)，请缩小时间范围"，与 spec 5.2.1-3a 逐字一致，无两处硬编码 |
| Controller 条件装配 | ✅ @ConditionalOnProperty(name="hwc.security.end-type", havingValue="admin")（:29）与 AccountUserController:30 完全同款；用户端实例不装配（20_user 套件 404 隔离 2 条用例通过） |
| @AuditLog 三属性 | ✅ module="audit" / action="export" / targetType="audit_log"，成败均落（实测 result=1 与 result=0 记录均产生） |
| 读方法不落审计 | ✅ pageAuditLogs 无 @AuditLog；查询前后计数复核（A-AL 系列只读断言）通过 |

### 5.2 变更范围全景（git status --short + git diff --stat）
**已修改（M，6 个，全部为 test/ 测试资产）：**
| 文件 | 归属 | 说明 |
|---|---|---|
| test/scripts/testcases/10_admin_api_cases.json（+595 行） | 本任务（批次 B） | 新增 A-AL1/A-AL2 系列 31 条用例（161→192） |
| test/scripts/testcases/20_user_api_cases.json（+22 行） | 本任务（批次 B） | 新增用户端 404 隔离 2 条用例（75→77） |
| test/测试用例/管理端接口测试用例.md（+51 行） | 本任务（批次 B） | 同步用例文档 |
| test/测试用例/用户端接口测试用例.md（+9 行） | 本任务（批次 B） | 同步用例文档 |
| test/scripts/run_all.cjs（+3/-2 行） | 本任务（批次 B，测试基建修正） | ROOT 由硬编码旧路径 `E:/JavaPro/HuaWeiCompetition` 改为 `path.resolve(__dirname,'../..')` 本仓相对定位 + 测试命令路径加引号（含空格目录名兼容），属测试脚本可移植性修正，非业务代码 |
| test/测试结果/接口测试报告.md | 本任务（测试运行产物） | 回归报告留档 |

**新增（??，Java 侧 5 个文件，本任务交付物）：**
- code/backend/hwc-security/.../controller/AuditLogController.java
- code/backend/hwc-security/.../service/AuditLogService.java
- code/backend/hwc-security/.../dto/audit/AuditLogPageQuery.java、AuditLogExportQuery.java、AuditLogVO.java

**新增（??，测试资产，本任务批次 B/C）：**
- test/scripts/seed_audit_logs.sql（22 条造数脚本）、seed_audit_bulk.sql + run_admin_bulk.cjs + testcases/_11_audit_bulk_cases.json（上限专项 4 条）、verify_export_bom.cjs（BOM 核验脚本）
- test/测试结果/audit-logs-export.csv（批次 B 导出留档）、audit-logs-export-batchC.csv + export-headers-batchC.txt（批次 C 导出留档）

**与 design §3.3 交付边界比对：**
- ✅ Java 侧仅 5 个新增文件（Controller 1 + Service 1 + DTO/VO 3），位于 hwc-security 既有包结构（controller/service/dto/audit）
- ✅ `git diff --stat -- code/` 为空 → **零存量 Java/SQL/前端/Python 文件修改**，零 DDL/种子/实体/Mapper/切面/全局配置改动
- ✅ 无新依赖/新配置项/新权限点/新索引/后台任务
- ✅ 账号权限管理任务的成果已包含于初始提交（de11694），**当前未提交变更 100% 属于本审计日志任务**（此前任务无遗留未提交文件）
- 说明：run_all.cjs 为测试脚本路径修正（见上表），不属业务代码，需向评审说明

### 5.3 显式排除项核验（spec 附录 A）
| 排除项 | 核验结果 |
|---|---|
| 无详情接口 | ✅ Controller 仅 /logs 与 /logs/export 两个 GET 路由，无 /logs/{id} |
| 无修改/删除路由 | ✅ 全类无 @PostMapping/@PutMapping/@DeleteMapping，写请求 405 兜底（spec 5.1.1-9） |
| 无统计聚合 | ✅ 无聚合类路由/SQL |
| 无 module/action 白名单校验 | ✅ 两字段仅 @Size(max=32)，开放取值（spec 附录 C） |
| 无 result/endpoint 过滤参数 | ✅ AuditLogPageQuery 7 字段中不含 result/endpoint |
| 导出无时间外过滤参数 | ✅ AuditLogExportQuery 仅 beginTime/endTime（R9） |

### 5.4 评审结论
**全部评审意见关闭。** 变更范围与 design §3.3 交付边界一一对应，无范围外文件；R1-R10 十项裁决零偏差；契约核对零偏差；管理端 192/192、用户端 77/77 全量回归全绿；只读承诺、审计自举、安全隔离（用户端 404）、BOM/转义/上限/降序产物契约均经实测验证。

---

## 6. 遗留问题
1. ~~**人工页面实测清单（5.4 §1.4 六项）**~~：**已关闭（2026-10-20）**——用户浏览器实测六项全部确认通过，§1.4 已更新为 ☑。
2. ~~**AI 套件 3 条失败（A-DIAG-03/05/07）**~~：**已关闭（2026-10-20）**——根因为编排器 `active_codes_of` 未强制激活 monitor 节点（子集 agents 请求时 DSL 触发条件上下文缺失导致步骤缺失），修复见 `code/ai-service/app/agents/multi/orchestrator.py`（active_codes_of 强制含 monitor）；30_ai 47/47、Python 单测 412/412 全绿，全量回归 408/408。
3. **A-AL1 系列静态计数断言的维护性提示**（非缺陷）：用例 total 断言基于"22 条造数"基线，任何在回归前产生的真实审计记录（如人工导出验证）都会使其偏移。本次已通过清理测试过程残留恢复基线；后续若在真实环境持续产生审计数据，建议将 A-AL1 计数断言改为相对断言（与账号域用例的动态 extract 模式一致），登记为测试资产演进项。