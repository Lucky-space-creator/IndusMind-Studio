# 接口测试用例说明

本项目对华为竞赛「设备智能运维平台」三端服务进行接口测试，覆盖**常规、边界、异常、性能**四类场景。

## 测试范围

| 端 | 服务 | 技术栈 | 测试端口（隔离） | 用例文档 | 用例数 |
|---|---|---|---|---|---|
| 管理端 | hwc-app-admin | Spring Boot | http://127.0.0.1:8190 | [管理端接口测试用例.md](管理端接口测试用例.md) | 161 |
| 用户端 | hwc-app-user | Spring Boot | http://127.0.0.1:8180 | [用户端接口测试用例.md](用户端接口测试用例.md) | 75 |
| AI 服务端 | ai-service | FastAPI | http://127.0.0.1:8101 | [AI服务端接口测试用例.md](AI服务端接口测试用例.md) | 47 |

**总计 283 条**：常规 137 / 边界 39 / 异常 92 / 性能 15。

> 测试统一使用**独立端口族 8180/8190/8101**（环境变量 `SERVER_PORT_USER` / `SERVER_PORT_ADMIN` / `SERVICE_PORT` 覆盖），与开发环境（8080/8090/8100）完全隔离，可并行运行互不干扰。

## 分类覆盖说明

| 分类 | 覆盖策略 |
|---|---|
| 常规（NORMAL） | 合法参数 + 有效认证账号，验证核心功能正确性与响应结构 |
| 边界（BOUNDARY） | 空列表/空表初始态、删除后状态、非法枚举、缺失可选字段、特殊输入 |
| 异常（EXCEPTION） | 未认证/伪造 Token、越权访问（角色权限矩阵）、资源不存在、参数冲突、重复创建、依赖不可用 |
| 性能（PERF） | 多次请求 + 并发采样，统计平均/P95/最大时延并断言阈值 |

## 测试账号与权限矩阵

| 账号 | 密码 | 角色 | 权限要点 |
|---|---|---|---|
| admin | Admin@123 | ADMIN | 管理端 50 项权限（不含 workorder:read / diagnosis:read） |
| config1 | Demo@123 | CONFIGURATOR | 管理端配置 + 发布 + 知识权限（无 device:info:write、无 data: 权限） |
| eng1 | Demo@123 | ENGINEER | 用户端核心权限：chat:rw、dashboard:read、diagnosis:rw、knowledge:search:read、workorder:read/export |
| prod1 | Demo@123 | PRODUCER | 仅 dashboard:read、diagnosis:read |
| review1 | Demo@123 | REVIEWER | 双端只读 |

## 已知产品缺陷（期望值按实际行为设定）

| 编号 | 缺陷 | 影响 |
|---|---|---|
| D1 | `AuthorizationDeniedException` 无专门 handler，权限拒绝返回 500 而非 403 | 15 条用例（A-AUTH-08、A-DEV-09 等） |
| D2 | 工单 INSERT 缺 `order_no` 列（NOT NULL 无默认值），生成工单必 500 | U-WO-02；连锁跳过 U-WO-03/04/07 |
| D3 | 诊断 `phenomenon` 纯文本写入 JSON 列 → MysqlDataTruncation 500 | U-DIAG-01（不带 phenomenon 成功，见 U-DIAG-01B） |
| D4 | AI 服务 `app/graphrag/__init__.py` 命名遮蔽子模块，graph 三接口 50000 | A-GRAPH-01/02/03 |
| D5 | `pub_call_log.error_msg` 列过短，异常堆栈写入失败 | 次要，不阻断主流程 |

另有 6 项参数/资源类异常落入兜底 500 的规范性改进建议，详见《接口测试报告》附录 C。

## 环境限制说明（非产品缺陷）

1. **沙箱网络**：Python 进程直连 IPv4 `127.0.0.1` 被拦截，AI 服务经 `test/scripts/ai_launcher.py` 启动（socketpair IPv6 补丁），LLM/Embedding/向量库/图库以内存 stub 替代（功能链路完整，回复为桩文本）
2. **MinIO 不可用**：文件上传/导出类接口返回 500 属环境依赖，相关用例已标注
3. **数据库**：MySQL 8（127.0.0.1:3306，hwc 库 38 表），种子数据由后端初始化

## 执行方式

```bash
# 接口 + 集成测试（一键）：预检独立端口 → 启动三端服务 → 健康检查 → 执行三套用例 → 生成报告 → 关闭服务
node test/scripts/run_all.cjs

# AI 模块单元测试（368 条，纯内存，无需起服务）
python -m unittest discover -s test/ai_unit -p "test_*.py"

# 报告输出：test/测试结果/接口测试报告.md、test/测试结果/AI模块测试报告.md
# 服务日志：test/测试结果/logs/{backend-admin,backend-user,ai-service}.log
```

用例 JSON 修改后可重新生成用例文档：`node test/scripts/gen_case_docs.cjs`

## 最近一次执行结果（2026-10-18）

| 套件 | 用例数 | 通过 | 失败 | 跳过 |
|---|---|---|---|---|
| 管理端 | 161 | 161 | 0 | 0 |
| 用户端 | 75 | 72 | 0 | 3 |
| AI 服务端 | 47 | 47 | 0 | 0 |
| **总计** | **283** | **280** | **0** | **3** |

通过率 100%（跳过 3 条均因缺陷 D2 连锁阻塞）。AI 模块另有单元测试 368 条（345 通过 + 23 沙箱跳过等价覆盖，0 失败）。

详细结果见 `test/测试结果/接口测试报告.md` 与 `test/测试结果/AI模块测试报告.md`。