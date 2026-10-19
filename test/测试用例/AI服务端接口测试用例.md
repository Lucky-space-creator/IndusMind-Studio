# AI 服务端接口测试用例

- **被测服务**：ai-service（FastAPI，测试端口 http://127.0.0.1:8101）
- **用例文件**：`test/scripts/testcases/30_ai_service_cases.json`
- **用例总数**：47 条（常规 15 / 边界 22 / 异常 6 / 性能 4）

## 分类覆盖说明

| 分类 | 说明 | 覆盖策略 |
|---|---|---|
| 常规（NORMAL） | 正常业务路径 | 使用合法参数与有效认证账号，验证核心功能的正确性与响应结构 |
| 边界（BOUNDARY） | 边界条件 | 空列表/空表初始态、删除后状态、非法枚举、缺失可选字段、超长/特殊输入等 |
| 异常（EXCEPTION） | 异常与否定场景 | 未认证/伪造 Token、越权访问（角色权限矩阵）、资源不存在、参数冲突、重复创建、服务依赖不可用等 |
| 性能（PERF） | 性能采样 | 多次请求 + 并发采样，统计平均/P95/最大时延并断言阈值 |

> 用例名称中标注"缺陷"的条目，其期望值按**当前实际行为**（缺陷表现）设定，缺陷清单详见《接口测试报告》附录 B；标注"环境依赖"的条目为沙箱环境（MinIO 不可用、AI 桩服务）下的实际行为。

## 健康检查（A-HEALTH）

| 用例 ID | 类别 | 用例名称（含期望说明） | 方法 | 路径 | 期望结果 |
|---|---|---|---|---|---|
| A-HEALTH-01 | 常规 | 常规-健康检查返回服务信息 | GET | `/health` | HTTP 200 / code=0 |
| A-HEALTH-02 | 边界 | 边界-X-Trace-Id 请求头透传并回写 | GET | `/health` | HTTP 200 / code=0 |
| A-HEALTH-03 | 异常 | 异常-未知路由返回 HTTP 404 原生结构 | GET | `/not-exist` | HTTP 404 |
| A-HEALTH-04 | 异常 | 异常-方法不匹配返回 HTTP 405 | GET | `/chat` | HTTP 405 |

## RAG 检索（A-RAG）

| 用例 ID | 类别 | 用例名称（含期望说明） | 方法 | 路径 | 期望结果 |
|---|---|---|---|---|---|
| A-RAG-INDEX-01 | 常规 | 常规-索引空片段列表直接成功（不触发外部依赖） | POST | `/rag/index` | HTTP 200 / code=0 |
| A-RAG-INDEX-02 | 常规 | 常规-带片段索引成功写入内存向量库 | POST | `/rag/index` | HTTP 200 / code=0 |
| A-RAG-INDEX-03 | 边界 | 边界-缺必填 kbId 返回 40001 | POST | `/rag/index` | HTTP 200 / code=40001 |
| A-RAG-INDEX-04 | 边界 | 边界-多余字段被拒绝（extra=forbid）返回 40001 | POST | `/rag/index` | HTTP 200 / code=40001 |
| A-RAG-INDEX-05 | 边界 | 边界-snake_case 键名同样可接受（populate_by_name） | POST | `/rag/index` | HTTP 200 / code=0 |
| A-RAG-INDEX-06 | 异常 | 异常-非法 JSON 报文返回 40001 | POST | `/rag/index` | HTTP 200 / code=40001 |
| A-RAG-REINDEX-01 | 常规 | 常规-reindex 带片段重建索引成功 | POST | `/rag/reindex` | HTTP 200 / code=0 |
| A-RAG-REINDEX-02 | 常规 | 常规-reindex 空片段成功 | POST | `/rag/reindex` | HTTP 200 / code=0 |
| A-RAG-SEARCH-01 | 常规 | 常规-语义检索返回结果列表 | POST | `/rag/search` | HTTP 200 / code=0 |
| A-RAG-SEARCH-02 | 边界 | 边界-空 query 关键词检索不报参数错 | POST | `/rag/search` | HTTP 200 |
| A-RAG-SEARCH-03 | 边界 | 边界-topK 为 0 与负数不触发校验错（后端容错） | POST | `/rag/search` | HTTP 200 |
| A-RAG-SEARCH-04 | 边界 | 边界-strictness 任意值容错（映射默认阈值） | POST | `/rag/search` | HTTP 200 |
| A-RAG-SEARCH-05 | 异常 | 异常-缺 query 返回 40001 | POST | `/rag/search` | HTTP 200 / code=40001 |
| A-RAG-STATUS-01 | 常规 | 常规-空 docIds 短路成功 affected=0 | POST | `/rag/document-status` | HTTP 200 / code=0 |
| A-RAG-STATUS-02 | 边界 | 边界-targetStatus 大小写归一（ENABLED 合法） | POST | `/rag/document-status` | HTTP 200 / code=0 |
| A-RAG-STATUS-03 | 边界 | 边界-targetStatus 非法枚举返回 40001 | POST | `/rag/document-status` | HTTP 200 / code=40001 |
| A-RAG-STATUS-04 | 异常 | 异常-缺 targetStatus 返回 40001 | POST | `/rag/document-status` | HTTP 200 / code=40001 |
| A-RAG-STATUS-05 | 常规 | 常规-非空 docIds 更新状态（未索引文档 affected=0） | POST | `/rag/document-status` | HTTP 200 / code=0 |
| A-RAG-DEL-01 | 边界 | 边界-空请求体返回 40001（模型校验） | POST | `/rag/delete` | HTTP 200 / code=40001 |
| A-RAG-DEL-02 | 常规 | 常规-按 docId 删除索引成功 | POST | `/rag/delete` | HTTP 200 / code=0 |

## 图谱接口（A-GRAPH）

| 用例 ID | 类别 | 用例名称（含期望说明） | 方法 | 路径 | 期望结果 |
|---|---|---|---|---|---|
| A-GRAPH-EXT-01 | 常规 | 常规-候选边抽取 | POST | `/graph/extract` | HTTP 200 / code=0 |
| A-GRAPH-EXT-02 | 边界 | 边界-无重叠词片段返回空边 | POST | `/graph/extract` | HTTP 200 / code=0 |
| A-GRAPH-EXT-03 | 边界 | 边界-空片段列表返回空边 | POST | `/graph/extract` | HTTP 200 / code=0 |
| A-GRAPH-QRY-01 | 常规 | 常规-关联查询 | POST | `/graph/query` | HTTP 200 / code=0 |
| A-GRAPH-QRY-02 | 边界 | 边界-depth 越界钳制 | POST | `/graph/query` | HTTP 200 / code=0 |
| A-GRAPH-QRY-03 | 边界 | 边界-缺 nodeRefId 返回 40001 | POST | `/graph/query` | HTTP 200 / code=40001 |
| A-GRAPH-SYNC-01 | 常规 | 常规-图同步 | POST | `/graph/sync` | HTTP 200 / code=0 |
| A-GRAPH-SYNC-02 | 边界 | 边界-缺 kbId 返回 40001 | POST | `/graph/sync` | HTTP 200 / code=40001 |

## 问答接口（A-CHAT）

| 用例 ID | 类别 | 用例名称（含期望说明） | 方法 | 路径 | 期望结果 |
|---|---|---|---|---|---|
| A-CHAT-01 | 常规 | 常规-问答返回答案（stub LLM+检索可用） | POST | `/chat` | HTTP 200 / code=0 |
| A-CHAT-02 | 边界 | 边界-空白问题（纯空格）返回 40001 | POST | `/chat` | HTTP 200 / code=40001 |
| A-CHAT-03 | 边界 | 边界-缺 question 返回 40001 | POST | `/chat` | HTTP 200 / code=40001 |
| A-CHAT-04 | 边界 | 边界-超长问题（2000 字符）不崩溃 | POST | `/chat` | HTTP 200 |

## 诊断接口（A-DIAG）

| 用例 ID | 类别 | 用例名称（含期望说明） | 方法 | 路径 | 期望结果 |
|---|---|---|---|---|---|
| A-DIAG-01 | 常规 | 常规-空异常列表：单步监测返回正常结论 | POST | `/diagnosis/run` | HTTP 200 / code=0 |
| A-DIAG-02 | 常规 | 常规-高危异常触发五步全流程（降级模式） | POST | `/diagnosis/run` | HTTP 200 / code=0 |
| A-DIAG-03 | 边界 | 边界-DSL 触发条件不满足时节点跳过 | POST | `/diagnosis/run` | HTTP 200 / code=0 |
| A-DIAG-04 | 边界 | 边界-DSL 触发条件满足时节点正常执行 | POST | `/diagnosis/run` | HTTP 200 / code=0 |
| A-DIAG-05 | 边界 | 边界-DSL 非法表达式解析失败不报错仅跳过 | POST | `/diagnosis/run` | HTTP 200 / code=0 |
| A-DIAG-06 | 边界 | 边界-severity 非标准值按低级处理不崩溃 | POST | `/diagnosis/run` | HTTP 200 / code=0 |
| A-DIAG-07 | 异常 | 异常-引用未定义字段的 DSL 跳过节点 | POST | `/diagnosis/run` | HTTP 200 / code=0 |

## 性能测试（A-PERF）

| 用例 ID | 类别 | 用例名称（含期望说明） | 方法 | 路径 | 期望结果 |
|---|---|---|---|---|---|
| A-PERF-01 | 性能 | 性能-/health 健康检查并发时延 | GET | `/health` | HTTP 200 / code=0 |
| A-PERF-02 | 性能 | 性能-/diagnosis/run 多Agent全流程并发时延 | POST | `/diagnosis/run` | HTTP 200 / code=0 |
| A-PERF-03 | 性能 | 性能-/chat 问答并发时延 | POST | `/chat` | HTTP 200 / code=0 |
| A-PERF-04 | 性能 | 性能-/rag/document-status 空列表短路并发时延 | POST | `/rag/document-status` | HTTP 200 / code=0 |
