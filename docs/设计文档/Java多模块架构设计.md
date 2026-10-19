# 工业设备巡检与运维智能系统 — Java 多模块架构设计与模块职责

> 版本：V1.0
> 基线需求：`docs/需求文档/需求方案-整改版.md`（V2.0）
> 本文把需求能力域（M01–M11）落地为 **Java 多模块工程**，并明确各模块职责与依赖边界。

---

## 1. 总体架构

### 1.1 技术栈

| 层 | 选型 |
|----|------|
| 语言/运行时 | Java 21（虚拟线程） |
| 框架 | Spring Boot 3.x、Spring Web、Spring Validation、Spring Security |
| 构建 | Maven 多模块（parent + modules） |
| 持久化 | MyBatis-Plus + MySQL 8；Redis（会话/缓存）；对象存储（文档原文） |
| 接口文档 | SpringDoc OpenAPI |
| 工具 | Lombok、Hutool |
| AI 能力 | **独立 Python AI 服务**（FastAPI + LangChain + LangGraph），Java 通过 HTTP 调用 |
| 向量/图存储 | 向量库（pgvector/Milvus/Qdrant）、图库（Neo4j）——由 Python AI 服务持有 |

### 1.2 双端 + 独立 AI 服务

```
                    ┌────────────────────────────┐
   用户端 Web ─────▶│  hwc-app-user  (启动模块)   │
                    └──────────────┬─────────────┘
                                   │ 依赖
   ┌───────────────────────────────┼───────────────────────────────┐
   │                    Java 领域模块层（业务与治理）                 │
   │  device / knowledge / docgraph / device-data / agent /        │
   │  publish / workorder      +  security / audit                 │
   └───────────────┬───────────────────────────────┬──────────────┘
                   │ hwc-ai-client (HTTP)          │ hwc-infra
                   ▼                                ▼
        ┌───────────────────────┐        ┌──────────────────┐
        │  Python AI 服务        │        │ MySQL / Redis /  │
        │  RAG · GraphRAG       │        │ 对象存储          │
        │  LangGraph 多 Agent   │        └──────────────────┘
        └───────┬───────┬───────┘
                ▼       ▼
           向量库      图库(Neo4j)
```

### 1.3 关键边界原则

1. **Java 侧是业务与元数据的权威源**：设备配置、文档元数据、片段文本、诊断记录、工单、权限、审计均以 Java + MySQL 为准。
2. **Python AI 服务是无业务状态的智能计算/检索服务**：持有向量索引与关联图，负责嵌入、检索、图关联、LLM 推理与多 Agent 编排；不直接读写业务库。
3. **仅 hwc-ai-client 可与 AI 服务通信**，其余模块禁止直连 Python 服务。

---

## 2. 模块总览（分层）

| 层 | 模块 | 一句话职责 |
|----|------|-----------|
| 基础层 | `hwc-common` | 无 Web 依赖的通用能力（返回体、异常、工具、常量、枚举基类） |
| 基础层 | `hwc-common-web` | Web 通用能力（全局异常、统一响应、拦截器、参数校验、OpenAPI） |
| 基础层 | `hwc-security` | 认证授权（双端登录、JWT、RBAC、数据范围、审计埋点） |
| 模型层 | `hwc-domain` | 跨模块共享的领域模型（Entity/DTO/VO/领域枚举） |
| 基础层 | `hwc-infra` | 基础设施（MyBatis-Plus、MySQL、Redis、对象存储、ID 生成） |
| 基础层 | `hwc-ai-client` | AI 服务远程调用客户端（RAG/GraphRAG/Agent 契约与降级） |
| 领域层 | `hwc-device` | 设备配置管理（主数据） |
| 领域层 | `hwc-knowledge` | 知识库与 RAG 管理 |
| 领域层 | `hwc-docgraph` | 文档关联与 GraphRAG 管理 |
| 领域层 | `hwc-device-data` | 设备数据管理（导入/模拟/清洗/异常提取） |
| 领域层 | `hwc-agent` | 智能问答（单 Agent）与多 Agent 协同诊断 |
| 领域层 | `hwc-publish` | 服务发布与调用监控 |
| 领域层 | `hwc-workorder` | 结果可视化与工单交付 |
| 应用层 | `hwc-app-user` | 用户端启动模块（装配 + 用户端 API） |
| 应用层 | `hwc-app-admin` | 管理端启动模块（装配 + 管理端 API） |

---

## 3. 模块职责详述

> 每个模块遵循统一约定：**只做本模块职责**，对外仅暴露 `api`（Facade 接口 + DTO）；跨模块不得直接引用他模块 `mapper`、`service.impl`、`entity`。

### 3.1 hwc-common
- **职责**：统一返回体 `Result<T>`、分页 `PageResult`、业务异常体系 `BizException`、错误码、通用工具（时间/字符串/校验）、常量。
- **不包含**：任何 Spring Web 依赖、任何业务领域概念。
- **依赖**：仅 JDK + Hutool/Lombok。

### 3.2 hwc-common-web
- **职责**：`@RestControllerAdvice` 全局异常处理、统一响应包装、请求日志、参数校验适配、OpenAPI 配置、跨域。
- **不包含**：认证授权逻辑（归 security）。
- **依赖**：hwc-common、spring-web。

### 3.3 hwc-security
- **职责**：双端登录、JWT 签发校验、Spring Security 配置、RBAC 鉴权（角色×模块×操作）、数据范围过滤、审计埋点与审计日志写入。
- **不包含**：具体业务的权限内容（具体资源的授权清单由各领域模块声明）。
- **依赖**：hwc-common、hwc-common-web、hwc-domain、hwc-infra。

### 3.4 hwc-domain
- **职责**：跨模块共享的领域模型：设备、指标、文档、片段、关联边、诊断记录、工单等 Entity/DTO/VO 与领域枚举。
- **不包含**：任何持久化实现、任何 Mapper、任何业务逻辑。
- **依赖**：hwc-common。

### 3.5 hwc-infra
- **职责**：MyBatis-Plus 配置与基础 Mapper、MySQL/Redis 连接、缓存封装、对象存储客户端、ID 生成、事务配置。
- **不包含**：具体业务表结构与业务 SQL（由各领域模块的 mapper 定义，infra 只提供能力）。
- **依赖**：hwc-common、hwc-domain。

### 3.6 hwc-ai-client
- **职责**：封装与 Python AI 服务的全部通信：请求/响应 DTO、HTTP 调用与重试、超时、熔断降级、鉴权、幂等。暴露 `RagClient`、`DocGraphClient`、`AgentClient` 三组 Facade。
- **不包含**：任何业务编排、任何业务数据落库。
- **依赖**：hwc-common、hwc-domain。

### 3.7 hwc-device（设备配置 · 主数据）
- **职责**：设备台账、设备类型/型号、监测指标与阈值、告警规则、备件主数据、停机损失标准；配置校验与导入导出。
- **对外权威**：提供 `DeviceFacade`（供 device-data 读阈值、agent 读备件/停机损失、workorder 读台账）。
- **不包含**：设备运行数据（归 device-data）。
- **依赖**：common 系列、domain、infra、security。

### 3.8 hwc-knowledge（知识库与 RAG）
- **职责**：知识库、文档、分段、索引任务的**业务与元数据**管理；调用 `RagClient` 触发索引构建/重建与检索；维护片段文本与来源。
- **对外权威**：提供 `KnowledgeFacade`（供 docgraph 校验片段存在、agent 取证据）。
- **不包含**：知识库之间的关系（归 docgraph）、向量计算本身（归 AI 服务）。
- **依赖**：common 系列、domain、infra、security、ai-client。

### 3.9 hwc-docgraph（文档关联与 GraphRAG）
- **职责**：文档/片段关联图的**业务与元数据**管理：节点/边的增删改、来源（自动/人工）标记、关联检索调用。
- **强边界**：**只处理文档与文档/片段关系**，不涉及设备、传感、备件、工单等非文档实体；节点必须外键回溯 `hwc-knowledge` 的真实片段。
- **对外权威**：提供 `DocGraphFacade`（供 agent 做关系扩展、workorder 渲染溯源图的文档引用部分）。
- **依赖**：common 系列、domain、infra、security、ai-client、hwc-knowledge。

### 3.10 hwc-device-data（设备数据管理）
- **职责**：数据集管理、数据导入、故障模拟（基于 device 配置生成）、清洗、异常提取（基于 device 告警规则）。
- **对外权威**：提供 `DeviceDataFacade`（供 agent 取异常清单、workorder/看板取数据）。
- **不包含**：阈值定义（归 device）。
- **依赖**：common 系列、domain、infra、security、hwc-device。

### 3.11 hwc-agent（问答与协同诊断）
- **职责**：**单 Agent 问答**（会话、双知识源检索、引用、兜底）与**多 Agent 协同诊断**（Agent 配置、工具绑定、协同流程、执行、冲突仲裁、安全否决、诊断记录）。
- **对外权威**：提供 `AgentFacade`（供 publish 发布流程、workorder 取诊断结论）。
- **边界**：不维护知识库（knowledge/docgraph）、不维护设备配置（device）；AI 能力经 `ai-client` 调用；多 Agent 的领域边界规则在此模块落地。
- **依赖**：common 系列、domain、infra、security、ai-client、hwc-device、hwc-device-data、hwc-knowledge、hwc-docgraph。

### 3.12 hwc-publish（服务发布与调用监控）
- **职责**：流程发布、凭证生成、上线/暂停/版本切换、鉴权与限流、调用日志与监控指标。
- **边界**：只发布 `hwc-agent` 已定义的流程，不修改流程逻辑。
- **依赖**：common 系列、domain、infra、security、hwc-agent。

### 3.13 hwc-workorder（看板与工单）
- **职责**：设备健康看板（评分/状态/趋势/风险）、健康评分规则、故障溯源图、工单生成与导出。
- **边界**：只读消费方，不产生新业务结论；工单数据一律引用 device/agent/docgraph，禁止二次录入。
- **依赖**：common 系列、domain、infra、security、hwc-device、hwc-device-data、hwc-agent、hwc-docgraph。

### 3.14 hwc-app-user / hwc-app-admin（应用层）
- **职责**：仅做**模块装配 + Web 入口**。各自装配可用领域模块、暴露本端 REST API、配置双端端口与安全过滤链。
- **hwc-app-user**：装配 device(只读)、device-data(读)、agent、workorder、knowledge(读)；仅用户端 API。
- **hwc-app-admin**：装配全部领域模块；暴露管理端 API。
- **不包含**：任何业务逻辑（不得写 service 实现）。
- **依赖**：按端装配的领域模块 + security + common-web。

---

## 4. 模块依赖规则

### 4.1 分层依赖（只允许上层依赖下层）

```
应用层        hwc-app-user / hwc-app-admin
                    │
领域层        device · knowledge · docgraph · device-data · agent · publish · workorder
                    │
基础/模型层   security · infra · ai-client · domain · common-web · common
```

规则：
- 领域模块之间禁止循环依赖，禁止跨层反向依赖。
- 基础层模块之间：`common-web → common`；`security → common, common-web, infra, domain`；`infra → common, domain`；`ai-client → common, domain`。
- `hwc-domain` 与 `hwc-common` 为**最底层**，不依赖任何领域模块。

### 4.2 领域层内部依赖偏序（避免环）

| 层级 | 模块 | 允许依赖（领域内） |
|------|------|--------------------|
| D0 | hwc-device、hwc-knowledge | —（互不依赖） |
| D1 | hwc-device-data、hwc-docgraph | device-data→device；docgraph→knowledge |
| D2 | hwc-agent | device、device-data、knowledge、docgraph |
| D3 | hwc-workorder、hwc-publish | workorder→device、device-data、agent、docgraph；publish→agent |

> 禁止 D0←D1 反向依赖；D2 不得被 D0/D1 依赖；D3 不得被更低层依赖。

### 4.3 跨领域交互方式

- 优先通过 **Facade 接口 + DTO**（各模块暴露 `api` 包），禁止直接引用他模块的 `mapper`、`entity`、`service.impl`。
- 非强一致的跨领域联动（如"文档停用后刷新关联图"）走 **领域事件（Spring Event）**，避免直接耦合。
- 数据一致性：跨模块引用只读主数据（如 device 的阈值），**不复制、不硬编码**。

### 4.4 包规范（按功能分包）

**本项目采用「按功能分包」：以功能为单位建包，功能包下再分 controller / service 等角色包。**

- 一个功能包对应一个 Maven 模块，如 `com.hwc.device`、`com.hwc.knowledge`；功能包**下**按角色分包：`controller` / `service`（+ `impl`）/ `mapper` / `model` / `config` / `util` / `handler` / `api`（对外 Facade）。
- 单个功能含多个子功能时，可在功能包下再分子功能包，子功能包内同样含 `controller` / `service` 等。

```text
com.hwc.device                     # 功能包（= Maven 模块 hwc-device）
├── controller
├── service/impl
├── mapper
├── model
├── config / util / handler
└── api                            # 对外 Facade
```

- 说明：后端 skill 默认「水平分包」，本项目经评估改为**按功能分包**，属该规范允许的「项目结构需在项目规范中明确说明并一致执行」的例外，本文即为该说明。

---

## 5. Java ↔ Python AI 服务契约

### 5.1 职责边界

| 能力 | Java 侧 | Python AI 服务侧 |
|------|---------|------------------|
| 文档管理/分段元数据 | ✅ 权威 | 接收片段文本建索引 |
| 向量索引/检索/重排 | ❌ | ✅ |
| 文档关联图（GraphRAG） | ✅ 业务元数据、增删改、留痕 | ✅ 图存储与关系检索；LangGraph 抽取 |
| 单 Agent 问答 | ✅ 会话/权限/引用展示 | ✅ 检索+生成 |
| 多 Agent 协同 | ✅ 流程配置/记录/仲裁展示 | ✅ LangGraph 编排、各 Agent 执行 |
| 设备配置/数据/工单 | ✅ | ❌ |
| 权限/审计 | ✅ | ❌ |

### 5.2 接口清单（REST，供 hwc-ai-client 调用）

| 调用方模块 | AI 接口 | 用途 |
|-----------|---------|------|
| hwc-knowledge | `POST /rag/index`、`POST /rag/reindex`、`POST /rag/search` | 索引构建、重建、片段检索 |
| hwc-docgraph | `POST /graph/extract`、`POST /graph/query` | 关系抽取（候选边）、关联检索 |
| hwc-agent | `POST /chat` | 单 Agent 问答 |
| hwc-agent | `POST /diagnosis/run` | 多 Agent 协同诊断（LangGraph） |

统一约定：JSON 出入参、`traceId` 透传、超时与重试、**熔断降级**（AI 不可用时业务侧给中文提示，不阻塞其他功能）。

### 5.3 数据归属

- 片段文本、文档元数据：**Java 为准**，索引时同步给 AI 服务。
- 向量索引、关系图：**AI 服务持有**，Java 仅存业务元数据与关系边定义（可重建）。
- 任何一方重建后，以 Java 侧元数据为准触发 AI 侧重建，保证可恢复。

---

## 6. 需求模块（M01–M11）→ 工程模块 映射

| 需求模块 | 工程模块 |
|----------|----------|
| M01 账号与权限 | hwc-security（+ 双端 app 装配） |
| M02 设备配置 | hwc-device |
| M03 知识库与 RAG | hwc-knowledge（+ hwc-ai-client/RAG） |
| M04 文档关联与 GraphRAG | hwc-docgraph（+ hwc-ai-client/graph） |
| M05 设备数据管理 | hwc-device-data |
| M06 智能问答（单 Agent） | hwc-agent |
| M07 多 Agent 协同诊断 | hwc-agent |
| M08 服务发布与监控 | hwc-publish |
| M09 可视化与工单 | hwc-workorder |
| M10 双端界面与体验 | hwc-app-user、hwc-app-admin |
| M11 开发过程记录 | 流程约束（非代码模块） |

---

## 7. 双端与共用策略

- **共用**：全部领域模块、基础模块、数据库、AI 服务。
- **隔离**：两套启动模块、两套安全过滤链、两套 API 命名空间（如 `/api/user/**`、`/api/admin/**`）。
- **最小启停单元**：`hwc-app-user` / `hwc-app-admin` 可独立打包启动（两个 jar），也可由网关统一路由。
- **权限落地**：在 app 装配层按端裁剪 Bean 与 API；hwc-security 提供统一鉴权。

---

## 8. 与后端开发规范的符合性

| 规范要求 | 落地 |
|----------|------|
| 禁止引入清单外依赖 | parent pom 统一管理版本，新依赖需评审 |
| 按功能分包 | 功能（=模块）包下分 controller/service/mapper/model/... |
| 构造器注入 | 统一 `@RequiredArgsConstructor` + `private final` |
| 注解驱动、禁 XML Bean | 全注解，`@Configuration` + `@Bean` |
| 配置外置 | `application-{env}.yml` + `@ConfigurationProperties` |
| 不硬编码主数据 | 阈值/备件/停机损失统一取自 hwc-device |
| 日志与异常 | SLF4J、捕获具体异常、完整堆栈 |
| 单文件/函数规模 | 单文件 ≤800 行、单函数 ≤100 行 |

---

## 9. 自洽性与合理性复核

### 9.1 一致性检查

| 检查点 | 结论 |
|--------|------|
| 模块职责是否单一 | 是：每个模块一句话职责，均声明"不包含"边界 |
| 是否循环依赖 | 无：应用→领域→基础单向；领域内 D0→D1→D2→D3 偏序 |
| AI 与 Java 职责是否重叠 | 不重叠：Java 持业务元数据，AI 持索引/图；仅 ai-client 通信 |
| 主数据是否单一来源 | 是：阈值/备件/停机损失仅 hwc-device 权威 |
| RAG 与 GraphRAG 是否分离 | 是：knowledge 与 docgraph 独立模块，docgraph 强约束"只做文档关联" |
| 双端是否重复实现 | 否：共用领域模块，仅 app 层装配差异 |
| 权限是否横切覆盖 | 是：hwc-security 统一提供，app 层裁剪 |
| 与需求 M01–M11 是否对齐 | 是：第 6 章映射齐全 |

### 9.2 残留提示

1. **领域层交互**：device-data→device、docgraph→knowledge 等编译期依赖需保持单向；若后续出现反向需求，改用领域事件解耦。
2. **AI 服务可用性**：需在 hwc-ai-client 明确定义熔断阈值与降级话术（对齐需求"服务不可用有明确提示"）。
3. **关系图元数据一致性**：Java 存的边定义与 AI 服务存的图需有对账/重建机制。
4. **模块数量**：15 个模块对竞赛规模偏多，若需精简，可将 `hwc-app-user`/`hwc-app-admin` 合并为一个应用模块、按路径隔离（但不推荐，会弱化双端隔离）。

### 9.3 结论

模块按「基础—模型—基础设施—领域—应用」分层，以**能力（功能）**切模块、**按功能分包（功能包下含 controller/service）**；领域模块单向依赖、职责单一、主数据单一来源、AI 能力外置且仅经 ai-client 访问。相比前一版需求模块，主要优化为：**新增 hwc-ai-client 作为 AI 边界、拆分 knowledge 与 docgraph、把 security 与 audit 收敛为横切模块、明确双端 app 装配层**，整体自洽。