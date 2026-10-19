# Python 服务详细设计（AI 服务）

> 出品：项目架构智能体 / Python 开发智能体
> 版本：V1.0
> 关联：总纲 `docs/设计文档/系统总体架构设计.md`
> 定位：**独立 AI 服务**的详细设计——RAG、GraphRAG（LangGraph）、单 Agent、多 Agent 协同；与 Java 的接口契约与数据归属。

---

## 1. 概述与边界

- 技术栈：Python 3.10+、FastAPI、Uvicorn、LangChain、**LangGraph**、pgvector、Neo4j。
- 职责：全部 AI 能力——片段检索、文档关联、单 Agent 问答、多 Agent 协同诊断。
- 边界：**无业务状态**；不直接读写 Java 业务库；业务元数据以 Java 为准；持有向量索引与关系图，可据 Java 元数据重建。
- 唯一调用方：Java 的 `hwc-ai-client`（HTTP）。

---

## 2. 工程结构

```
ai-service/
├── app/
│   ├── main.py                # FastAPI 入口、路由注册、中间件(traceId)
│   ├── api/                   # 路由层
│   │   ├── rag.py             # /rag/index /rag/reindex /rag/search
│   │   ├── graph.py           # /graph/extract /graph/query
│   │   ├── chat.py            # /chat
│   │   └── diagnosis.py       # /diagnosis/run
│   ├── rag/                   # 分段、embedding、索引、检索、重排
│   ├── graphrag/              # 关系抽取、关联图管理、关联检索
│   ├── agents/
│   │   ├── single/            # 单 Agent 问答
│   │   └── multi/
│   │       ├── nodes/         # 监测/根因诊断/备件成本/安全规范/工单
│   │       └── graph.py       # LangGraph 编排
│   ├── core/                  # LLM/Embedding/Reranker 接入、配置、schema、日志
│   └── models/                # Pydantic 请求/响应模型
├── config/                    # 配置（.env / settings）
├── tests/
└── pyproject.toml
```

- 分层：`api`（路由）→ `rag/graphrag/agents`（能力）→ `core`（基础设施）；
- 统一 Pydantic schema 校验；`traceId` 透传贯穿全程。

---

## 3. 接口契约

统一约定：`Content-Type: application/json`；响应含 `code/message/data/traceId`。

| 接口 | 请求要点 | 响应要点 |
|------|----------|----------|
| `POST /rag/index` | kb_id、文档与片段文本（**Java 已分段**）、分段参数 | task_id、状态 |
| `POST /rag/reindex` | kb_id/doc_id、索引版本 | task_id、状态 |
| `POST /rag/search` | query、kb_id、top_k、严格度 | 片段列表(内容/来源/得分) |
| `POST /rag/document-status` | doc_id 数组、目标状态 | 更新数量（文档启停同步，停用片段不参与检索） |
| `POST /rag/delete` | kb_id / doc_id | 删除数量（文档/知识库删除时清理向量） |
| `POST /graph/extract` | kb_id、片段集合 | 候选边列表(源/目标/关系/来源=auto) |
| `POST /graph/query` | node_ref、关系类型、深度 | 关联节点列表 |
| `POST /graph/sync` | kb_id、节点与边全集 | 重建结果（人工增删改边后全量重建图） |
| `POST /chat` | session_id、问题 | 回答、引用列表、是否命中 |
| `POST /diagnosis/run` | 设备/数据、异常清单或现象描述、flow_id | 各阶段步骤、结论、引用、风险等级 |

> 同步类接口（document-status/delete/graph sync）为**需求分析报告 A2** 补全项：文档生命周期变更（启停/删除）须同步向量库与图，否则检索结果与元数据漂移。

---

## 4. RAG 流水线设计

```
[Java 侧] 文档解析(Tika) → 分段(长度/重叠/按章节) → 落 kb_segment → 携片段文本调 /rag/index
[Python 侧] 片段文本 → Embedding → 写入 pgvector
检索：query → Embedding → 向量检索 + 关键词召回 → Reranker 重排 → Top-K 片段(含来源)
```

- **分段归 Java**（需求分析报告 A3 裁定）：片段是 MySQL 权威数据（kb_segment），片段校对（REQ-M03-06）在 Java 管理端——若 Python 分段会导致校对内容与索引内容漂移。Python 只做 Embedding/索引/检索。
- 检索：混合检索（向量 + 关键词）→ 重排；返回片段、来源章节页码、得分；强制过滤 `doc_status='enabled'`。
- 职责边界：RAG **只回答「哪些片段相关」**，不做文档间关系推理。

---

## 5. GraphRAG 设计（LangGraph，只做文档间关联）

### 5.1 图模型
- 节点：`doc` / `section` / `segment`（`ref_id` 回溯 Java `kb_segment`）。
- 边：`引用 / 替代 / 补充 / 前置 / 同设备 / 同故障`；`source = auto | manual`。
- 存储：Neo4j；Java 侧仅存业务元数据（`kb_graph_node` / `kb_graph_edge`），可对账重建。

### 5.2 抽取流程（LangGraph）
```
载入片段 → 候选关系识别(LLM) → 归一化关系类型 → 生成候选边(source=auto) → 返回给 Java
```
- Java 侧 `hwc-docgraph` 决定候选边是否生效（默认生效）与人工增删改。

### 5.3 关联检索
- 输入节点 → 按关系类型/深度图遍历 → 返回关联节点（如替代条款、同故障案例）。

> **强边界**：GraphRAG 绝不处理设备数据、备件、工单等非文档实体。

---

## 6. 单 Agent 设计（/chat）

```
问题 → (必要时改写/澄清) → RAG 检索 → 按需 GraphRAG 关系扩展 → 组装证据 → LLM 生成 → 带引用回答
```
- 双知识源：RAG（直接召回）+ GraphRAG（关系导航）。
- 引用：标注文档名/章节/片段，供 Java 前端点击查看原文。
- 兜底：证据不足时明确「现有知识库未覆盖该问题」，**不编造**。
- 边界：不做设备定量诊断；涉及具体故障引导进入多 Agent 协同。

---

## 7. 多 Agent 协同设计（/diagnosis/run）

### 7.1 领域 Agent 与边界
| Agent | 输入 | 输出 | 可用知识/工具 | 禁止 |
|-------|------|------|----------------|------|
| 监测 | 异常清单、阈值 | 异常确认、严重度 | 设备配置(只读)、告警规则 | 不推断根因、不推荐备件 |
| 根因诊断 | 确认异常+证据 | 候选根因(排序)+引用 | RAG、GraphRAG | 不推荐备件、不给安全操作 |
| 备件成本 | 根因结论 | 备件、库存、停机损失 | 备件/停机损失数据 | 不判根因、不给安全要求 |
| 安全规范 | 维修方案/根因 | 安全要求、合规结论 | 安全规程、GraphRAG | 不判根因、不推荐备件 |
| 工单 | 各上游结论 | 结构化工单 | 设备配置、诊断结果 | 不新增未经确认的结论 |

### 7.2 编排（LangGraph）
```
START → 监测 →(正常) END
              └(异常)→ 根因诊断 → 并行[备件成本, 安全规范] → 仲裁/安全否决 → 工单 → END
```
- 状态：贯穿各节点共享上下文（输入、证据、各 Agent 输出、引用）。
- **触发条件 DSL**（需求分析报告 C 定义，由 Python 编排器解释）：
  ```
  expr := term (('&&' | '||') term)*
  term := <agent_code>.<field> <op> <value>      op := == | != | > | < | >= | <=
  ```
  `<field>` 为该 Agent `output_format` 顶层字段（如 `monitor.deviceStatus`、`safety.checkResult`）；未定义字段/解析失败 → 节点跳过并记录 step(status=skipped)，不中断流程。
- **边界规则**：输入/输出**契约化**（Pydantic schema，越界字段拒绝）；领域**隔离**（各 Agent 仅访问授权知识/工具）；**安全否决权**（未通过安全核查的步骤不得进工单）；结论冲突以**可核对引用**为准。
- 输出：分步结果（状态/摘要/工具结果/引用/耗时）+ 最终结论 + 风险等级。

---

## 8. 模型接入（core/）

- LLM / Embedding / Reranker 以可配置 provider 接入（**dashscope / ollama / openai 兼容**，需求分析报告 B4）；密钥经环境变量。
- 演示离线方案：ollama 本地承载 LLM（qwen2.5）与 Embedding（bge-m3）；嵌入维度随模型调整（pgvector DDL 已注明）。
- Prompt 与 Agent 指令集中管理，便于调优。
- 统一超时、重试、异常包装。

---

## 9. 数据模型与存储

- **向量库（PostgreSQL + pgvector，本服务专用）**：`kb_segment_vector(id, segment_id, kb_id, doc_id, doc_status, content, chapter, page_no, keywords, keywords_tsv, embedding vector(1024), embed_model, index_version, ...)`；`segment_id` 回溯 MySQL `kb_segment.id`；DDL 见 `code/ai-service/sql/postgresql/V1__init_schema.sql`；混合检索 = 向量（HNSW 余弦）+ 关键词（GIN tsvector）。
- **图（Neo4j）**：`(:Doc)-[:REF/REPLACE/SUPPLEMENT/PRECEDE/SAME_DEVICE/SAME_FAULT]->(:Doc/Section/Segment)`。
- 重建：Java 侧元数据（片段文本、边定义）为准，触发重嵌入/重建图。
- 边界：Java 不直连 PostgreSQL，Python 不直连 MySQL（数据经 `/rag/index` 等接口同步）。

---

## 10. 错误处理与降级

- 统一异常处理，返回 `code/message`；不泄露内部堆栈给调用方。
- 模型/向量库/图库不可用时返回明确错误码，Java 侧熔断降级。
- 幂等：索引任务以 task_id 跟踪。

---

## 11. 性能与缓存

- 检索结果与 embedding 可缓存（Redis 或进程内 LRU）。
- 批量嵌入、异步索引任务；多 Agent 并行节点减少总耗时（目标单次诊断 ≤60s）。

---

## 12. 部署

- Uvicorn（生产 Gunicorn+UvicornWorker）多进程；仅内网可达。
- 依赖：pgvector（PostgreSQL 扩展）、Neo4j；配置经环境变量注入。

---

## 13. 自检清单

- [ ] 接口与 Java `hwc-ai-client` 契约一致
- [ ] RAG 只做片段检索；GraphRAG 只做文档关联
- [ ] 多 Agent 边界契约化、领域隔离、安全否决生效
- [ ] 知识不足不编造；引用可溯源
- [ ] 无业务库直连；向量/图可由 Java 元数据重建