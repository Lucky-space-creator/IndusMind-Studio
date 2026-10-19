# Java 后端详细设计

> 出品：项目架构智能体 / Java 开发智能体
> 版本：V1.0
> 关联：总纲 `docs/设计文档/系统总体架构设计.md`；模块与边界 `docs/设计文档/Java多模块架构设计.md`
> 定位：在「模块划分与边界」之上的**实现级设计**——工程结构、包规范、数据模型、接口规范、鉴权、事务、AI 集成、配置与部署。

---

## 1. 概述与范围

- 技术栈：Java 21、Spring Boot 3.x、Maven 多模块、MyBatis-Plus、MySQL 8、Redis、Spring Security、SpringDoc。
- 职责：**只做传统业务后端**——业务编排、权限、设备配置、数据管理、工单、服务发布、审计。
- 不做：RAG/GraphRAG/Agent 的检索与推理（经 `hwc-ai-client` 调用 Python 服务）。
- 双端：`hwc-app-user`、`hwc-app-admin` 两个启动应用，共用领域模块与数据库。

---

## 2. 工程结构（Maven 多模块）

```
HuaWeiCompetition/                       # parent pom（packaging=pom）
├── pom.xml                              # 依赖版本统管（dependencyManagement）
├── hwc-common/                          # 通用返回/异常/工具/常量
├── hwc-common-web/                      # 全局异常、统一响应、拦截器、OpenAPI
├── hwc-security/                        # 登录/JWT/RBAC/数据范围/审计
├── hwc-domain/                          # 共享领域模型 entity/dto/vo/enum
├── hwc-infra/                           # MyBatis-Plus/MySQL/Redis/MinIO/ID 生成
├── hwc-ai-client/                       # Python AI 服务 HTTP 客户端
├── hwc-device/                          # 设备配置（主数据）
├── hwc-knowledge/                       # 知识库与 RAG（业务元数据）
├── hwc-docgraph/                        # 文档关联与 GraphRAG（业务元数据）
├── hwc-device-data/                     # 设备数据（导入/模拟/清洗/异常）
├── hwc-agent/                           # 单/多 Agent 问答与协同诊断
├── hwc-publish/                         # 服务发布与调用监控
├── hwc-workorder/                       # 看板与工单
├── hwc-app-user/                        # 用户端启动应用
└── hwc-app-admin/                       # 管理端启动应用
```

- 依赖**单向无环**：app → 领域 → 基础；领域内 D0→D1→D2→D3（见模块文档）。
- `hwc-ai-client` 是**唯一**可访问 Python 服务的模块。

---

## 3. 分层与包规范

**按功能分包**：功能包 = Maven 模块，功能包**下**再按角色分包。

```
com.hwc.device                     # 功能包（= hwc-device）
├── controller                     # REST 接口
├── service                        # 业务接口
│   └── impl                       # 业务实现
├── mapper                         # MyBatis-Plus Mapper
├── model
│   ├── entity                     # 数据库实体
│   ├── dto                        # 入参
│   └── vo                         # 出参
├── config                         # 模块配置
├── handler                        # 处理器/事件监听
├── util                           # 工具
└── api                            # 对外 Facade 接口 + DTO（跨模块唯一入口）
```

- 单功能含多个子功能时，可在功能包下再分子功能包（子功能包内同样含 `controller/service` 等）。
- 跨模块只允许引用他模块 `api` 包；**禁止**引用他模块 `mapper`/`entity`/`service.impl`。
- 命名后缀：`Controller`/`Service`/`ServiceImpl`/`Mapper`/`Entity`/`DTO`/`VO`/`Config`/`Util`。
- 依赖注入用构造器注入（`@RequiredArgsConstructor` + `private final`）；Bean/事务/校验/配置绑定全用注解声明（**注解优先**），禁 XML 定义 Bean/AOP/事务。

### 3.1 持久层（MyBatis-Plus + XML）
- **复杂 SQL 一律写 XML Mapper**，不在 Mapper 接口堆注解，也不在 Service 中拼接 SQL。
- 走 XML 的判定（满足其一）：多表 join / 子查询 / 动态条件（`<if>`/`<choose>`/`<foreach>`/`<where>`）/ 聚合分组 / 复杂分页 / 批量 / 需 `resultMap`。
- 简单单表 CRUD 用 MyBatis-Plus 通用方法或 LambdaQuery。
- XML 位置：`src/main/resources/mapper/<模块>/XxxMapper.xml`，由 `mybatis-plus.mapper-locations` 统一扫描；`namespace` = Mapper 接口全限定名，`id` = 方法名。
- 安全：参数用 `#{}`（预编译），禁 `${}` 拼接外部输入；避免 `SELECT *`；分页用分页插件。

### 3.2 注释规范（粒度适中）
- 类头注明**用途/职责**一句话；公共方法用文档注释写清功能与 `@param`/`@return`/`@throws`；复杂逻辑注释**为什么**。
- 避免过简（复述方法名）与过繁（大段废话）；随代码同步更新；禁止保留被注释掉的代码。

---

## 4. 依赖管理

- **parent pom** 统管所有版本（`dependencyManagement`）；子模块只声明 `groupId/artifactId`，不写版本。
- 新增依赖须经项目架构智能体评审；禁止引入清单外第三方库。
- Spring Boot BOM 作为基础，Lombok/Hutool/MyBatis-Plus 等由 parent 管理。
- 构建：`mvn -pl hwc-app-user -am spring-boot:run` 可单应用启动。

---

## 5. 数据模型（核心表设计概览）

> 表名前缀体现领域；所有表含 `id`、`create_time`、`update_time`、`creator`、`updater`、`deleted`（逻辑删除）。

### 5.1 权限与审计（hwc-security）
| 表 | 关键字段 |
|----|----------|
| `sys_user` | username、password(加盐哈希)、nickname、status |
| `sys_role` | code、name、end(user/admin/both) |
| `sys_user_role` | user_id、role_id |
| `sys_permission` | code、name、module、action(read/write/publish/delete/export) |
| `sys_role_permission` | role_id、permission_id |
| `sys_role_data_scope` | role_id、scope_type、scope_value |
| `sys_audit_log` | operator、action、target、before、after、time |

### 5.2 设备配置（hwc-device，主数据）
| 表 | 关键字段 |
|----|----------|
| `dev_type` | 名称、厂商 |
| `dev_model` | type_id、型号、规格 |
| `dev_info` | 编号、名称、model_id、产线/位置、状态 |
| `dev_metric` | type_id、指标名、单位、采样频率 |
| `dev_metric_threshold` | metric_id、正常下限/上限、预警阈值、故障阈值 |
| `dev_alarm_rule` | metric_id、等级、触发条件 |
| `dev_spare_part` | 名称、型号、适用设备、库存、单价、安全库存 |
| `dev_downtime_cost` | 设备/产线、每小时停机损失 |

### 5.3 知识库与关联（hwc-knowledge / hwc-docgraph）
| 表 | 关键字段 |
|----|----------|
| `kb_knowledge_base` | 名称、设备类型、厂商、故障等级 |
| `kb_document` | kb_id、名称、类型、版本、状态(启用/停用)、文件地址 |
| `kb_segment` | doc_id、序号、内容、来源章节/页码、字符数 |
| `kb_index_task` | kb_id、状态、进度、索引版本 |
| `kb_graph_node` | kb_id、类型(doc/section/segment)、ref_id(→片段) |
| `kb_graph_edge` | from_node、to_node、relation(引用/替代/补充/前置/同设备/同故障)、source(auto/manual) |

> `kb_graph_edge` 只描述**文档/片段间**关系；节点 `ref_id` 外键回溯 `kb_segment`。

### 5.4 设备数据（hwc-device-data）
| 表 | 关键字段 |
|----|----------|
| `data_dataset` | 设备、来源(导入/模拟)、时间范围、记录数、状态 |
| `data_record` | dataset_id、采集时间、指标值(JSON/宽表) |
| `data_cleaned` | dataset_id、清洗规则、清洗后数据 |
| `data_anomaly` | dataset_id、指标、类型(超限/持续升降/异常波动)、摘要 |

### 5.5 Agent 与诊断（hwc-agent）
| 表 | 关键字段 |
|----|----------|
| `agent_definition` | 名称、职责、指令、参数、回复格式 |
| `agent_tool_binding` | agent_id、知识库范围、匹配严格度、启用工具 |
| `agent_flow` | 名称、版本、状态 |
| `agent_flow_node` | flow_id、agent_id、顺序、触发条件 |
| `agent_run` | 类型(单/多)、输入、状态、结论 |
| `agent_step` | run_id、agent、阶段、摘要、工具结果、引用、耗时 |
| `diagnosis_record` | 设备、故障、结论、引用、风险等级 |
| `chat_session` / `chat_message` | 会话、消息、引用 |

### 5.6 发布与工单（hwc-publish / hwc-workorder）
| 表 | 关键字段 |
|----|----------|
| `pub_service` | flow_id、状态(上线/暂停)、当前版本 |
| `pub_credential` | service_id、access_key、secret |
| `pub_version` | service_id、版本、发布时间 |
| `pub_call_log` | service_id、traceId、耗时、成功、时间 |
| `wo_dashboard_metric` | 设备、健康评分、状态、风险、快照时间 |
| `wo_work_order` | 设备信息、根因、风险、备件、库存、安全要求、步骤、停机损失、下载地址 |

---

## 6. 接口设计规范

- 风格：REST + JSON；用户端 `/api/user/**`，管理端 `/api/admin/**`。
- **开放 API（M08 发布服务调用入口，需求分析报告 A6 补全）**：`POST /api/open/v1/{serviceCode}/invoke`——鉴权 Bearer（`Base64(access_key:secret)`，HMAC 签名列 P1）；校验服务 online 状态与凭证有效性 → 触发协同流程（同 /diagnosis/run 链路）→ 写 `pub_call_log`（traceId/耗时/成功与否）→ 返回统一结果体。
- 统一返回体：
```json
{ "code": 0, "message": "ok", "data": {}, "traceId": "..." }
```
- 分页：`{ "records": [], "total": n, "page": 1, "size": 20 }`。
- 错误码：模块化编码（如 `DEVICE_4001`），前端按码给中文提示。
- 参数校验：`@Valid` + Bean Validation；外部输入必校验。
- 文档：SpringDoc OpenAPI，按端分组。
- 命名：资源名词复数、动词用 HTTP 方法；动作型接口用 `/verb`。

---

## 7. 鉴权与权限

- 登录：账号密码（加盐哈希）→ 签发 JWT；`hwc-security` 提供过滤链。
- 角色×端：角色绑定可访问端（user/admin/both）；`hwc-app-user` 仅放行用户端角色。
- RBAC：角色×模块×操作（read/write/publish/delete/export）；权限编码 `<模块>:<资源>:<动作>`；**前后端双重校验**（前端隐藏 + 后端强制拦截）。
- 数据范围：角色可见设备/知识库范围过滤；Agent 访问数据同受约束。
- 登录响应：返回 `roles`、`menus`、`permissions`、`dataScope`，供前端动态渲染菜单/路由/按钮/数据范围（见 `docs/设计文档/前端界面布局设计.md` §8）。
- 审计：登录、配置变更、发布、文档启停、工单导出等写 `sys_audit_log`。

---

## 8. 事务与一致性

- 本地事务用 `@Transactional`；避免长事务，外部调用（AI/文件）移出事务。
- 跨模块联动（如「文档停用→刷新关联图」）走**领域事件**（`ApplicationEvent`），异步解耦。
- 幂等：发布、诊断触发等写 `traceId` 或业务唯一键防重。
- 主数据只读引用：跨模块读 `hwc-device` 值，不复制、不硬编码。

---

## 9. 与 AI 服务集成（hwc-ai-client）

| Facade | 目标接口 | 用途 |
|--------|----------|------|
| `RagClient` | `POST /rag/index`、`/rag/reindex`、`/rag/search`、`/rag/document-status`、`/rag/delete` | 索引构建/重建、片段检索、文档启停同步、向量清理（A2 补全） |
| `DocGraphClient` | `POST /graph/extract`、`/graph/query`、`/graph/sync` | 关系抽取（候选边）、关联检索、图全量重建（A2 补全） |
| `AgentClient` | `POST /chat`、`/diagnosis/run` | 单 Agent 问答、多 Agent 协同诊断 |

- 触发时机：文档启停/删除时由 hwc-knowledge 事件监听调 document-status/delete；人工增删改边后由 hwc-docgraph 调 graph/sync。

- 统一：JSON、`traceId` 透传、超时、重试（幂等接口）、**熔断降级**。
- 降级策略：AI 不可用时返回明确中文提示「AI 服务暂不可用，请稍后重试」，不阻塞其他功能。
- 数据归属：请求携带 Java 侧片段文本/元数据；响应仅取检索/推理结果。

---

## 10. 配置与多环境

- `application.yml` + `application-{dev,test,prod}.yml`；敏感项外置。
- 用 `@ConfigurationProperties` + `@EnableConfigurationProperties` 收敛到 `*Properties` 类；禁止业务类散落 `@Value`。
- 关键配置：数据源、Redis、MinIO、AI 服务地址/超时/熔断、JWT 密钥与有效期。

---

## 11. 日志与异常

- SLF4J + Logback；统一日志格式含 `traceId`。
- 全局异常处理（`hwc-common-web`）：业务异常 `BizException` → 统一返回体；系统异常记录完整堆栈。
- 禁止裸 `catch (Exception e)`；捕获具体异常、记堆栈、不静默吞异常。

---

## 12. 测试策略

- 单元测试：Service 核心逻辑（阈值判定、异常提取、评分、鉴权），覆盖正常与边界。
- 集成测试：Controller + MyBatis-Plus（Testcontainers/内嵌库）。
- 命名：`Test<功能>_<场景>`。

---

## 13. 部署与启动

- 打包：`hwc-app-user.jar`、`hwc-app-admin.jar`。
- 运行：`java -jar`（JDK21 可启用虚拟线程）；Nginx 反向代理 `/api/user`、`/api/admin`。
- 依赖外部组件：MySQL、Redis、MinIO、Python AI 服务（内网）。

---

## 14. 自检清单（开发前 DoR / 交付前 DoD）

- [ ] 归属模块与功能包正确；无跨模块违规引用
- [ ] 主数据取自 `hwc-device`，未硬编码
- [ ] AI 调用仅经 `hwc-ai-client`
- [ ] 构造器注入、注解驱动、配置外置
- [ ] 统一返回体 + 中文错误 + 完整堆栈日志
- [ ] 外部输入已校验；关键逻辑有测试