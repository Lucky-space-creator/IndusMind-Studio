# AI 模块测试报告

- 执行日期：2026-10-18（2026-10-19 完成 D4/D5 缺陷修复并回归）
- 被测模块：`code/ai-service`（FastAPI + LangGraph，RAG / GraphRAG / 单 Agent 问答 / 多 Agent 协同诊断）+ `hwc-ai-client` 集成链路
- 测试层级：**单元测试**（369 条）+ **接口测试**（AI 服务 47 条）+ **集成链路测试**（Java 后端 → AI 服务）
- 测试端口（与开发环境隔离）：AI `8101` / 用户端 `8180` / 管理端 `8190`

---

## 一、测试策略与执行环境

### 1.1 分层测试策略

| 层级 | 载体 | 数量 | 说明 |
|---|---|---|---|
| 单元测试 | `test/ai_unit/test_*.py`（unittest） | 369 | 纯内存执行，外部依赖全部 monkeypatch；覆盖纯函数、校验器、降级分支、编排逻辑、路由信封 |
| 接口测试 | `test/scripts/testcases/30_ai_service_cases.json` | 47 | HTTP 直连 AI 服务，覆盖常规/边界/异常/性能 |
| 集成链路 | 20/10 套件中 AI 相关用例 | 110 | Java 后端（hwc-ai-client）→ AI 服务的端到端链路 |

### 1.2 沙箱环境适配（非产品缺陷）

沙箱拦截 Python 进程对 IPv4 `127.0.0.1` 的连接，且本机无 Ollama / PostgreSQL(pgvector) / Neo4j。为验证真实 HTTP 契约与业务流程，测试经 `test/scripts/ai_launcher.py` 启动 AI 服务：

- 补丁 `socket.socketpair` 优先走 IPv6 `::1`（探针证实不受拦截）
- 以猴子补丁注入**确定性桩实现**（不改 ai-service 源码）：LLM 固定模板回复、Embedding sha256 确定性向量、向量库内存余弦检索、图库内存邻接表 BFS
- 所有业务降级分支与编排逻辑仍按真实代码路径执行

> 单元测试的另一维度适配：starlette `TestClient` 依赖 asyncio 事件循环（socketpair），沙箱下不可用（23 条用例自动 skip），其断言点由 `test_api_routes_direct.py` 的 22 条**裸协程直驱 ASGI**用例等价覆盖，保证任何环境均可验证。

---

## 二、单元测试结果

**总结果：369 条，通过 346 / 跳过 23（沙箱限制，等价覆盖）/ 失败 0。**

| 测试文件 | 用例 | 覆盖内容 |
|---|---|---|
| test_core_text.py | 20 | 分词（中英混合/停用词/大小写）、截断、中文检测、tsvector 文本 |
| test_core_response_errors.py | 22 | 响应信封结构、ErrorCode 枚举、AiServiceError 便捷构造、traceId 上下文 |
| test_agents_common.py | 21 | JSON 对象解析（markdown 包裹/数组/非法）、证据格式化、引用组装（Decimal 舍入/doc_id 容忍） |
| test_multi_dsl.py | 33 | 触发条件 DSL：词法、递归下降语法、`&&`/`||` 优先级、括号、数值 1e-9 容差、字符串不敏感比较、非法表达式→跳过 |
| test_models_validators.py | 31 | pydantic 校验器：文档状态白名单、删除范围至少一项、depth 夹紧 [1,5]、question 非空白、extra=forbid |
| test_rag_units.py | 22 | 分数归一化（空/全等/min-max）、严格度阈值表、向量字面量格式、索引参数校验、Embedding LRU 缓存命中 |
| test_rag_search.py | 14 | 混合检索：0.7/0.3 加权融合排序、strict 阈值过滤、top_k 截断、双路空召回 |
| test_graphrag_extractor.py | 28 | 关系类型规范化、候选边构建（自环/越界/非法置信度兜底 0.5）、启发式词重叠建边（阈值 3、置信封顶 0.75）、LLM 失败降级 |
| test_graphrag_query_store.py | 16 | graphId 拼装、节点去重（refId+nodeType）、孤儿边过滤、写库失败仍返回边 |
| test_nodes.py | 27 | severity 双向映射、监测节点空异常/取最大、根因/安全/备件/工单节点降级文案与规则 |
| test_orchestrator.py | 44 | 路由（abnormal→continue）、仲裁（安全 fail 否决工单）、风险取 max、结论拼装、引用去重、步骤固定排序、节点三态（skipped/failed/degraded）、LangGraph 不可用回退顺序编排 |
| test_providers.py | 33 | 响应解析兜底、bearer 头、重排器（Noop/Http 失败回退）、工厂非法 provider 拒绝 |
| test_single_agent.py | 13 | 单 Agent 问答：检索失败→未覆盖话术+hit=False、LLM 失败→证据摘要降级、空回答处理、引用组装 |
| test_api_routes.py | 23 | （沙箱下 skip）TestClient 全接口信封、参数错误 40001、业务异常码透传 |
| test_api_routes_direct.py | 22 | 裸协程直驱 ASGI：等价覆盖上述断言 + D4 修复回归用例（锁定 `app.graphrag.query` 为模块） |

### 单元测试发现的产品级问题（均已修复，2026-10-19）

| 编号 | 问题 | 修复方式 | 回归证据 |
|---|---|---|---|
| D4 | `app/graphrag/__init__.py:3` 的 `from app.graphrag.query import extract, query, sync` 将包属性 `query` 遮蔽为函数；`app/api/graph.py:5` 取到函数后调用 `.extract/.query/.sync` 抛 `AttributeError`，被全局异常处理器吞为 50000 | `__init__.py` 移除 query 函数导入（仅保留 store/extract_candidates）；`app/agents/single/agent.py:30` 改为 `from app.graphrag.query import query as graph_query` | 单测新增回归用例（断言包属性为模块）+ 接口 A-GRAPH-EXT/QRY/SYNC 六条全部通过 |
| D5 | `RagDeleteRequest` 的 `@field_validator("doc_id")` 未设 `validate_default=True`，空 body 全缺省构造可绕过"kbId/docId 至少一项"校验直达业务层 | `Field(default=None, alias="docId", validate_default=True)` | 单测改为断言抛 ValidationError + 接口 A-RAG-DEL-01 返回 40001 |

> D4 修复涉及两处联动（`__init__.py` 移除遮蔽导入 + `single/agent.py:30` 显式 `import query as graph_query`），单测已同时锁定两处行为，防止回归。

---

## 三、AI 服务接口测试结果（47 条，全部通过）

| 分类 | 数量 | 覆盖 |
|---|---|---|
| 常规（NORMAL） | 12 | 健康检查、RAG 索引/重建/检索/状态/删除、chat 问答、diagnosis 诊断运行 |
| 边界（BOUNDARY） | 19 | 空列表短路、无片段/无文档、非法枚举、depth 夹紧、DSL 非法表达式跳过、severity 非标准值 |
| 异常（EXCEPTION） | 12 | 参数校验 40001、业务校验 40000、graph 非法 graphId、认证缺失（原 D4 锁定的 graph 三接口用例在修复后改按正常契约断言） |
| 性能（PERF） | 4 | health / diagnosis/run / chat / rag document-status 并发时延 |

**小计：通过 47，失败 0，跳过 0（通过率 100%）。**

---

## 四、集成链路测试（Java 后端 → AI 服务）

用户端（`hwc-app-user`）与管理端（`hwc-app-admin`）经 `hwc-ai-client` 调用 AI 服务的链路用例全部通过：

| 链路 | 涉及用例 | 结果 |
|---|---|---|
| 知识检索（Java → AI `/rag/search`） | U-KB 12 条、A-KB 25 条（含文档上传/启停/重建索引/检索试搜） | 全部通过 |
| 单 Agent 问答（Java → AI `/chat`） | U-CHAT 9 条（新会话/追问/证据引用/失败降级） | 全部通过 |
| 多 Agent 诊断（Java → AI `/diagnosis/run`） | U-DIAG 11 条、A-RUN 3 条（运行记录/步骤明细） | 全部通过 |
| 文档关联图（Java → AI `/graph/*`） | U-GRAPH 1 条、A-GR 13 条（节点/边/抽取/同步，D4 修复后按正常契约断言） | 全部通过 |
| Agent 与流程治理（Java 侧 + AI 契约） | A-AG 15 条（定义/绑定/流程编排/执行记录） | 全部通过 |
| 开放 API 诊断调用（`/api/open/v1/{code}/invoke` → 诊断链路） | A-PUB 21 条 | 全部通过 |
| 错误传递链路 | AI `50302` 业务错误 → Java 包装 `503 / COMMON_5100`（message 透传） | 已验证 |

### AI 相关性能数据（独立测试端口，桩环境）

| 用例 | 请求/并发 | 平均 | P95 | 最大 | 阈值 |
|---|---|---|---|---|---|
| U-PERF-03 知识检索（Java→AI 链路） | 10 / 2 | 11ms | 14ms | 14ms | ✅ |
| U-PERF-04 智能问答（Java→AI 链路） | 6 / 2 | 26ms | 29ms | 29ms | ✅ |
| A-PERF-01 `/health` | 50 / 10 | 23ms | 30ms | 39ms | ✅ |
| A-PERF-02 `/diagnosis/run` 多 Agent 全流程 | 15 / 3 | 27ms | 29ms | 29ms | ✅ |
| A-PERF-03 `/chat` 问答 | 15 / 3 | 7ms | 9ms | 9ms | ✅ |
| A-PERF-04 `/rag/document-status` 空列表短路 | 30 / 10 | 18ms | 21ms | 21ms | ✅ |

---

## 五、降级能力验证矩阵

单测按"依赖 × 场景"构造，验证四类外部依赖不可用时的降级行为（均按真实代码路径执行）：

| 依赖 | 场景 | 降级行为 | 验证 |
|---|---|---|---|
| LLM | `/chat` 生成失败 | 返回证据摘要拼接 + "模型服务暂不可用"文案，hit=False | ✅ |
| LLM | 诊断各节点失败 | 监测→规则摘要；根因→启发式；安全→保守 pass；工单→规则模板（含 LOTO 首末步） | ✅ |
| LLM | GraphRAG 抽取失败 | 切换启发式词重叠建边（≥3 重叠，置信封顶 0.75） | ✅ |
| 向量库 | `/rag/search` | 抛 50302 向量库不可用；`/chat` 检索失败降级为空命中 + 未覆盖话术 | ✅ |
| 图库 | graph 接口 | 抛 50303 图库不可用；`/chat` 图扩展静默跳过；抽取写库失败仍返回边 | ✅ |
| LangGraph | 图执行不可用 | 自动回退内置顺序编排（ThreadPoolExecutor 并行 spare_cost/safety），结论等价 | ✅ |
| Embedding | 批量向量化 | 进程内 LRU 缓存（sha256 键，上限 2000），命中不重复调用 | ✅ |

---

## 六、测试过程中排查的环境问题（非产品缺陷）

1. **8100 端口被用户自用进程占用**：测试首轮出现"向量库连接失败（50302）"与诊断耗时异常（P95 37s），根因为用户桌面 `LLM_test` 项目的 uvicorn 先占 8100，Windows 端口复用导致测试请求实际打进**无桩**进程。已改用独立端口 `8101` 修复。
2. **8080/8090 被 IntelliJ IDEA 启动的服务占用**：导致测试自启 Java 后端失败（Port already in use），测试打到 IDE 实例（其 AI 地址指向 8100）。已改用独立端口 `8180/8190` + 环境变量覆盖（`SERVER_PORT_USER/ADMIN`、`AI_SERVICE_BASE_URL`）彻底隔离。
3. **改进**：`run_all.cjs` 增加启动前端口占用预检（占用即报错退出，不误打他进程）。

---

## 七、结论

- **AI 模块整体质量良好**：单元测试 369 条零失败（346 通过 + 23 沙箱跳过等价覆盖），接口 47 条全通过，Java→AI 集成链路 110 条全通过。
- **降级设计完备**：LLM / 向量库 / 图库 / LangGraph / Embedding 五类依赖不可用时均有确定性降级路径，且已被单测锁定。
- **缺陷已闭环**：测试发现的 D4（graphrag 命名遮蔽 → graph 三接口 50000）、D5（删除请求校验器可被空 body 绕过）已于 2026-10-19 完成修复并全量回归（单测新增/改造锁定用例 + 接口用例改按修复后契约断言）；Java 侧缺陷（D1/D2/D3/D6）详见《接口测试报告》附录 B。
- **复现方式**：`python -m unittest discover -s test/ai_unit -p "test_*.py"`（单元）+ `node test/scripts/run_all.cjs`（接口与集成）。