# 数据库表设计（DDL 级）

> 出品：项目架构智能体 / 数据层智能体
> 版本：V1.1（待用户审查）
> 关联：`docs/设计文档/数据模型设计.md`（表职责矩阵，本文为其 DDL 细化）；`docs/设计文档/Java后端详细设计.md` §5；`docs/设计文档/Python服务详细设计.md` §9
> 配套脚本（**双库分文件夹**）：
> - MySQL（Java 业务库）：`code/backend/sql/mysql/`——`V1__init_schema.sql`（43 张表）、`V2__init_data.sql`（初始化）、`V3__demo_data.sql`（演示数据）
> - PostgreSQL（Python 向量库，pgvector）：`code/ai-service/sql/postgresql/`——`V1__init_schema.sql`（向量表）
> 数据库：MySQL 8.0+（InnoDB，utf8mb4 / utf8mb4_0900_ai_ci）；PostgreSQL 15+（pgvector 扩展）

---

## 1. 设计决策清单（请重点审查）

| # | 决策 | 说明 | 状态 |
|---|------|------|------|
| D1 | 主键 `id BIGINT UNSIGNED AUTO_INCREMENT` | 单库部署，无分布式需求，自增最简 | 待确认 |
| D2 | 逻辑删除 `deleted BIGINT DEFAULT 0`，删除时**置为 id** | 使 `(code, deleted)` 唯一索引可正确工作（避免多条已删记录冲突） | 待确认 |
| D3 | `data_record` 采用**窄表**（一行一指标值） | 矩阵遗留待定项的决策；列：dataset_id/device_id/metric_id/collect_time/metric_value；配合 `(dataset_id, metric_id, collect_time)` 唯一索引；演示数据量可控，暂不分区 | 待确认 |
| D4 | 阈值采用**三级嵌套区间** | normal ⊆ warn ⊆ fault，判定见 §3.2；字段：`normal_min/max、warn_min/max、fault_min/max`；满足 REQ-M02-08 区间合理性校验：`fault_min ≤ warn_min ≤ normal_min ≤ normal_max ≤ warn_max ≤ fault_max` | 待确认 |
| D5 | 新增 3 张表（相对职责矩阵） | `dev_spare_part_type`（备件↔设备类型多对多）、`wo_work_order_part`（工单备件明细）、`wo_score_rule`（健康评分规则，REQ-M09-02 P0） | 待确认 |
| D6 | 工单备件**快照字段**例外 | 工单为存档交付物，打印后须与生成时一致，属"另建版本表"合法场景；同时保留 `spare_part_id` 引用 | 待确认 |
| D7 | 密码 BCrypt（自带盐），不单设 salt 列 | 满足"加盐哈希"要求 | 待确认 |
| D8 | `pub_credential.secret_key` 应用层 AES 加密存储 | 凭证不落明文 | 待确认 |
| D9 | 不建 `sys_menu` 表 | 菜单由前端静态路由 + 权限码过滤（登录返回 permissions），权限五层中的"页面"层由前端路由元信息承载 | 待确认 |
| D10 | 日志表/纯关联表**精简通用字段** | `sys_audit_log`、`pub_call_log`：仅保留 `id/create_time`（日志只增不改）；纯关联表（`sys_user_role` 等）：`id/create_time/creator` | 待确认 |
| D11 | JSON 列约定 | MySQL 原生 JSON 类型；结构见各表字典；Java 侧用类型处理器映射 | — |
| D12 | 不建物理外键、不加 CHECK | 沿用矩阵规范；M02-08 阈值区间校验在应用层实现 | — |
| D13 | 业务版本字段与乐观锁冲突处理 | `kb_document.version`（文档版本）、`agent_flow.version`（流程版本号）、`pub_version.version`（服务版本）为业务字段，三表乐观锁字段改名 `version_lock`；其余表仍为 `version` | 待确认 |
| D14 | `agent_tool_binding.kb_ids` 三态语义 | `[]`=不接知识库（监测/备件成本/工单 Agent）；`NULL`=运行时按设备类型动态圈定（根因/安全 Agent，避免硬绑知识库导致新增知识库不生效） | 待确认 |
| D15 | **双库分文件夹**（用户已确认方向） | MySQL（Java 业务库）脚本在 `code/backend/sql/mysql/`；PostgreSQL/pgvector（Python 向量库）脚本在 `code/ai-service/sql/postgresql/`；Java 不直连 PostgreSQL，Python 不直连 MySQL | 已确认 |
| D16 | `agent_run.device_id` 可空 | diagnosis 类型应用层必填校验；single（通用问答 /chat）无设备上下文（需求分析报告 A5） | 已修复 |
| D17 | 权限点 59 `knowledge:search:read` + 配置员权限修正 | 用户端知识检索（只读）页面权限点（A4）；配置员无 data:*（A1，以需求 §1.4 为权威），补 device 只读 | 已修复 |

> D1–D14 于 2026-10-16 经用户确认（用户指示按当前设计继续推进开发），视为已接受。

---

## 2. 表清单总览（43 张）

| 领域 | 前缀 | 表 | 数量 |
|------|------|----|----|
| 权限与审计 | sys_ | sys_user、sys_role、sys_user_role、sys_permission、sys_role_permission、sys_role_data_scope、sys_audit_log | 7 |
| 设备配置（主数据） | dev_ | dev_type、dev_model、dev_info、dev_metric、dev_metric_threshold、dev_alarm_rule、dev_spare_part、dev_spare_part_type*、dev_downtime_cost | 9 |
| 知识库 | kb_ | kb_knowledge_base、kb_document、kb_segment、kb_index_task | 4 |
| 文档关联 | kb_graph_ | kb_graph_node、kb_graph_edge | 2 |
| 设备数据 | data_ | data_dataset、data_record、data_cleaned、data_anomaly | 4 |
| Agent 与诊断 | agent_/diagnosis_/chat_ | agent_definition、agent_tool_binding、agent_flow、agent_flow_node、agent_run、agent_step、diagnosis_record、chat_session、chat_message | 9 |
| 服务发布 | pub_ | pub_service、pub_credential、pub_version、pub_call_log | 4 |
| 看板与工单 | wo_ | wo_score_rule*、wo_dashboard_metric、wo_work_order、wo_work_order_part* | 4 |

> `*` 为相对职责矩阵新增的表（决策 D5）。

### 核心关系链路（文本 ER）

```
主数据链  dev_type ─< dev_model ─< dev_info
          dev_type ─< dev_metric ─< dev_metric_threshold / dev_alarm_rule
          dev_spare_part ─< dev_spare_part_type >─ dev_type
          dev_downtime_cost（按 device / line / global）
知识链    kb_knowledge_base ─< kb_document ─< kb_segment
          kb_graph_node(ref_id→kb_document/kb_segment) ─< kb_graph_edge
数据链    dev_info ─< data_dataset ─< data_record ─> data_cleaned ─> data_anomaly
诊断链    agent_run ─< agent_step ；agent_run ─1 diagnosis_record
          diagnosis_record ─1 wo_work_order ─< wo_work_order_part >─ dev_spare_part
问答链    sys_user ─< chat_session ─< chat_message
发布链    agent_flow ─< pub_service ─< pub_version / pub_credential ─< pub_call_log
看板链    dev_info + data_anomaly →（wo_score_rule 规则）→ wo_dashboard_metric
```

---

## 3. 通用规范

- 通用字段（全量表，除 D10 豁免外）：
  ```sql
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `create_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`     BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`     INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本'
  ```
- 索引命名：`idx_<表主体>_<列>` / `uk_<表主体>_<列>`（表主体不含前缀，如 `uk_user_username`）。
- 状态/编码类字段用 VARCHAR + 受控枚举值（应用层枚举校验），便于阅读与扩展。

---

## 4. 数据字典（按领域）

> 完整 DDL（含索引/表注释）见 `code/backend/sql/V1__init_schema.sql`；此处为审查用精简字典。省略号表示通用字段。

### 4.1 权限与审计

**sys_user（账号）**
| 字段 | 类型 | 说明 |
|------|------|------|
| username | varchar(64) | 登录名，`uk(username,deleted)` |
| password | varchar(100) | BCrypt 哈希（自带盐） |
| nickname | varchar(64) | 显示名 |
| phone / email | varchar(20)/(128) | 联系方式，可空 |
| status | tinyint | 1 启用 / 0 禁用 |
| last_login_time | datetime(3) | 最近登录 |

**sys_role（角色）**
| 字段 | 类型 | 说明 |
|------|------|------|
| code | varchar(64) | 角色编码，唯一 |
| name | varchar(64) | 角色名 |
| end_type | varchar(10) | 可访问端：user / admin / both |
| built_in | tinyint | 内置角色不可删 |
| sort | int | 排序 |

**sys_user_role / sys_role_permission（关联）**：`user_id+role_id`、`role_id+permission_id` 联合唯一；精简通用字段。

**sys_permission（权限点）**
| 字段 | 类型 | 说明 |
|------|------|------|
| code | varchar(128) | `<模块>:<资源>:<动作>`，唯一 |
| name | varchar(64) | 权限名 |
| module / resource / action | varchar(32) | 模块 / 资源 / 动作（read/write/publish/delete/export） |
| end_type | varchar(10) | 所属端，供前端过滤 |
| sort | int | 排序 |

**sys_role_data_scope（数据范围，P1）**
| 字段 | 类型 | 说明 |
|------|------|------|
| role_id | bigint | 角色 |
| scope_type | varchar(16) | ALL / DEVICE_TYPE / DEVICE / KNOWLEDGE_BASE |
| scope_id | bigint | 范围对象 id，ALL 时为 0 |

**sys_audit_log（操作审计）**：operator_id、operator_name、endpoint、module、action、target_type、target_id、before_value/after_value(JSON)、result、error_msg、ip、trace_id、operate_time；索引 `(operator_name,operate_time)`、`(module,operate_time)`；仅保留 id/create_time（D10）。

### 4.2 设备配置（主数据，唯一权威）

**dev_type（设备类型）**：code（唯一）、name、vendor（厂商）、description。

**dev_model（型号规格）**：type_id（索引）、code（唯一）、name、spec。

**dev_info（设备台账）**
| 字段 | 类型 | 说明 |
|------|------|------|
| code | varchar(32) | 设备编号，唯一 |
| name | varchar(128) | 设备名称 |
| type_id | bigint | 设备类型（**冗余**自 model.type_id，避免看板多级 join） |
| model_id | bigint | 型号，索引 |
| line_name / location | varchar(64)/(128) | 产线 / 安装位置 |
| status | varchar(16) | running/standby/maintenance/fault |
| run_date | date | 投运日期 |

**dev_metric（监测指标）**：type_id（索引）、code、name、unit、sample_interval（秒）；`uk(type_id,code,deleted)`。

**dev_metric_threshold（指标阈值）**
| 字段 | 类型 | 说明 |
|------|------|------|
| metric_id | bigint | 指标，唯一 |
| normal_min / normal_max | decimal(14,4) | 正常区间 |
| warn_min / warn_max | decimal(14,4) | 预警区间（⊇ 正常） |
| fault_min / fault_max | decimal(14,4) | 故障边界（⊇ 预警） |

> 判定规则（应用层统一实现，M05/M09 共用）：v∈[normal] → 正常；v∉[normal] 且 v∈[warn] → 预警；v∉[warn] 且 v∈[fault] → 故障；v∉[fault] → 疑似坏点（清洗剔除）。

**dev_alarm_rule（告警规则）**：metric_id（索引）、level（warn/fault）、condition_type（threshold_breach/continuous_over/trend/fluctuation）、duration_count（持续次数）、threshold_expr(JSON 触发参数)、enabled、description。

**dev_spare_part（备件）**：code（唯一）、name、model（备件型号）、unit、stock（库存）、safety_stock（安全库存）、unit_price decimal(12,2)、status、remark。

**dev_spare_part_type（备件适用设备类型，新增）**：spare_part_id + dev_type_id 联合唯一。

**dev_downtime_cost（停机损失标准）**：scope_type（global/device/line）、device_id（scope=device 时）、line_name（scope=line 时）、cost_per_hour decimal(12,2)、remark；取值优先级 device > line > global（应用层实现）。

### 4.3 知识库

**kb_knowledge_base（知识库）**：name（唯一）、dev_type_id（按设备类型分类，可空）、vendor、fault_level（general/common/severe，按故障等级分类）、doc_count（派生统计）、index_status（idle/building/ready/failed）、description。

**kb_document（文档）**：kb_id（索引）、doc_name、doc_type（manual/procedure/history）、version、status（enabled/**disabled 不参与检索**）、file_url、file_type、file_size、segment_count（派生统计）、remark。

**kb_segment（片段）**：doc_id（索引）、seq_no、content(TEXT)、chapter、page_no、char_count、keywords(JSON)；`uk(doc_id,seq_no)`。

**kb_index_task（索引任务）**：kb_id、doc_id（全库重建时为空）、task_type（index/reindex）、status（pending/processing/success/failed）、progress(0-100)、index_version、error_msg、started_at、finished_at。

### 4.4 文档关联（GraphRAG 元数据，边界：只做文档/片段间关系）

**kb_graph_node（关联图节点）**
| 字段 | 类型 | 说明 |
|------|------|------|
| kb_id | bigint | 所属知识库，索引 |
| node_type | varchar(16) | document / section / segment |
| ref_id | bigint | 回溯 id：document→kb_document.id，section/segment→kb_segment.id |
| title | varchar(255) | 节点标题 |
| extra | json | 扩展（章节号等） |

> `uk(node_type, ref_id, deleted)`；Neo4j 实际图由 Python 侧持有，本表元数据可重建图。

**kb_graph_edge（关联边）**
| 字段 | 类型 | 说明 |
|------|------|------|
| from_node_id / to_node_id | bigint | 索引 |
| relation_type | varchar(32) | reference/supplement/replacement/prerequisite/same_device/same_fault |
| source | varchar(16) | auto（Python 抽取）/ manual（人工） |
| confidence | decimal(5,4) | 自动抽取置信度 |
| status | varchar(16) | pending/confirmed/rejected（自动边人工确认；manual 边默认 confirmed） |
| remark | varchar(255) | 人工备注 |

> `uk(from_node_id,to_node_id,relation_type,deleted)`。

### 4.5 设备数据

**data_dataset（数据集）**：name、device_id（索引）、source_type（import/simulate）、file_url、time_start、time_end、record_count、metric_ids(JSON)、clean_config(JSON)、cleaned_count、anomaly_count、status（uploaded/cleaning/cleaned/extracting/ready/failed）、error_msg。

**data_record（原始记录，窄表）**：dataset_id、device_id（冗余，便于按设备查趋势）、metric_id、collect_time、metric_value decimal(14,4)；`uk(dataset_id,metric_id,collect_time)`、`idx(dataset_id,collect_time)`。

**data_cleaned（清洗结果）**：dataset_id、record_id（可空，→原始记录）、metric_id、collect_time、raw_value、cleaned_value、is_modified、rules_applied(JSON)、remark；`idx(dataset_id,metric_id,collect_time)`。

**data_anomaly（异常清单）**：dataset_id、device_id、metric_id、anomaly_type（threshold_breach/continuous_trend/sudden_fluctuation）、severity（warn/fault）、start_time、end_time、sample_count、peak_value、avg_value、summary、detail(JSON)；`idx(dataset_id)`、`idx(device_id,severity)`。

### 4.6 Agent 与诊断

**agent_definition（Agent 配置）**：code（唯一：monitor/root_cause/spare_cost/safety/work_order）、name、domain、responsibility、instruction(TEXT 系统指令)、boundary（越界禁止事项，对应 M07 边界列）、params(JSON)、output_format(TEXT)、model_config(JSON)、status、sort。

**agent_tool_binding（知识与工具绑定）**：agent_id（唯一）、kb_ids(JSON 知识库范围，领域隔离依据)、match_strictness(high/medium/low)、tools(JSON 启用工具编码)。

**agent_flow（协同流程）**：code（唯一）、name、version、status（draft/published/offline）、is_preset、description。

**agent_flow_node（流程节点）**：flow_id（索引）、node_order、node_name、agent_id（索引）、trigger_condition(JSON 触发条件)、timeout_seconds、remark。

**agent_run（运行记录）**：run_type（single/multi）、flow_id、session_id（问答触发时）、device_id、dataset_id、input(JSON)、status（running/success/failed/timeout）、conclusion(TEXT)、trace_id（索引）、started_at、ended_at、duration_ms、error_msg。

**agent_step（步骤明细）**：run_id（索引）、step_order、agent_id、phase（retrieve/reason/tool/generate）、summary、detail(JSON 工具结果/中间推理)、citations(JSON 引用：[{docId,segmentId,chapter,page,score}])、duration_ms、status。

**diagnosis_record（诊断记录）**：run_id（唯一）、device_id（索引）、dataset_id、fault_summary、root_cause(TEXT)、risk_level(low/medium/high)、safety_conclusion、citations(JSON)、conclusion_time。

**chat_session（问答会话）**：user_id（索引）、title、message_count、last_message_time、status（active/closed）。

**chat_message（问答消息）**：session_id（索引）、role（user/assistant）、content(TEXT)、citations(JSON)；`idx(session_id,create_time)`。

### 4.7 服务发布

**pub_service（已发布服务）**：flow_id（索引）、code（唯一）、name、status（online/paused/offline）、current_version、description。

**pub_credential（调用凭证）**：service_id（索引）、access_key（唯一）、secret_key（**AES 加密存储**）、status、expire_time、remark。

**pub_version（版本记录）**：service_id（索引）、version、config_snapshot(JSON 流程+Agent 配置快照)、changelog、published_by、published_at；`uk(service_id,version,deleted)`。

**pub_call_log（调用日志）**：service_id、credential_id、trace_id（索引）、api_path、latency_ms、success、http_status、error_msg、call_time（索引）；仅保留 id/create_time（D10）。

### 4.8 看板与工单

**wo_score_rule（健康评分规则，新增）**：scope_type（global/device_type/device）、scope_id（global 时为 0，`uk(scope_type,scope_id,deleted)`）、rule_config(JSON：偏离权重/异常扣分/扣分上限等)、status、remark。

**wo_dashboard_metric（看板快照）**：device_id、dataset_id、health_score decimal(5,2)、status（normal/warn/fault）、risk_hint、metric_snapshot(JSON 关键指标最新值)、anomaly_count、snapshot_time；`idx(device_id,snapshot_time)`。

**wo_work_order（维修工单）**
| 字段 | 类型 | 说明 |
|------|------|------|
| order_no | varchar(32) | 工单号，唯一 |
| diagnosis_id / device_id | bigint | 来源诊断 / 设备，索引 |
| fault_summary | varchar(512) | 故障摘要 |
| root_cause | text | 根因结论（来自诊断 Agent） |
| risk_level | varchar(16) | 风险等级 low/medium/high |
| safety_requirements | text | 安全要求（来自安全 Agent，含否决结论） |
| repair_steps | json | 维修步骤数组（来自工单 Agent） |
| est_downtime_hours | decimal(6,2) | 预计停机时长 |
| downtime_cost / parts_cost / total_cost | decimal(12,2) | 停机损失 / 备件成本 / 合计 |
| file_url | varchar(512) | 导出文档地址 |
| status | varchar(16) | generated/confirmed/exported |
| generated_by / generated_time | — | 生成人 / 时间 |

**wo_work_order_part（工单备件明细，新增）**：order_id（索引）、spare_part_id（引用，索引）、part_name/part_model/unit_price/stock_snapshot（**生成时快照**，决策 D6）、quantity、remark。

---

## 5. 初始化数据设计（V2__init_data.sql）

| 类别 | 内容 |
|------|------|
| 内置角色 5 个 | ADMIN(管理员,admin)、CONFIGURATOR(配置员,admin)、ENGINEER(维修工程师,user)、PRODUCER(生产管理人员,user)、REVIEWER(评审用户,both)，均 built_in=1 |
| 权限点 | 管理端：device:type/info/metric/alarm-rule/spare-part/downtime-cost × read/write；knowledge:kb/document/segment/index × read/write(+document:publish/delete)；docgraph:graph:read/write；data:dataset/clean/anomaly × read/write(+delete/export)；agent:definition/binding/flow × read/write；publish:service/credential/call-log × read/write(+service:publish)；audit:log:read/export；account:user/role × read/write(+user:delete)<br>用户端：dashboard:read、chat:read/write、diagnosis:read/write、trace:read、workorder:read/export |
| 角色-权限映射 | 按需求 §1.4 矩阵：ADMIN=管理端全部；CONFIGURATOR=knowledge/docgraph/agent/publish 相关；ENGINEER=dashboard/chat/diagnosis/trace/workorder；PRODUCER=dashboard:read+diagnosis:read；REVIEWER=双端全部 read |
| 默认账号 | admin（初始密码 `Admin@123`，BCrypt 哈希；首次登录建议改密——P1） |
| 内置 Agent 5 个 | monitor/root_cause/spare_cost/safety/work_order，含职责、系统指令、**边界（禁止事项）**、输出格式、工具与知识库绑定 |
| 预设流程 1 条 | 默认协同诊断：监测 →(异常)→ 根因诊断 →(并行)备件成本+安全规范 →(安全通过)→ 工单编排，含触发条件 |
| 评分规则 1 条 | 全局默认规则（偏离权重 0.6 + 异常扣分 0.4，扣分上限 40） |

## 6. 演示数据（V3__demo_data.sql）

- **演示账号**（密码统一 `Demo@123`）：`config1`（配置员）、`eng1`（维修工程师）、`prod1`（生产管理人员）、`review1`（评审用户，双端只读）；另有数据范围示例（生产管理人员仅看数控机床类设备，P1 生效）。正式管理员为 V2 中的 `admin / Admin@123`。
- **设备主数据**：2 设备类型（数控机床/三相异步电机）→ 3 型号 → 3 台设备（M01-CNC-001 等，分布产线A/B，含 maintenance 状态样例）。
- **指标与阈值**：7 指标（主轴温度/振动/转速/电流、绕组温度/电流/绝缘电阻）+ 三级嵌套阈值（含"下限型"指标绝缘电阻：值越大越好）。
- **告警规则**：7 条（阈值越限/持续超限两类，含持续次数参数）。
- **备件**：5 个（含适用设备类型关联、安全库存）。
- **停机损失**：global 2000 + 产线A 5000 + 设备级 8000（演示优先级取值）。
- **知识库**：1 个（数控机床维修知识库）+ 3 文档元数据（manual/procedure/history 各一，history 为 **disabled 状态**以演示"停用不参与检索"）。

## 7. Python 侧存储（PostgreSQL/pgvector + Neo4j）

### 7.1 PostgreSQL 向量库（`code/ai-service/sql/postgresql/V1__init_schema.sql`）

**kb_segment_vector（知识片段向量，1 张表）**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigserial | 主键 |
| segment_id | bigint | 回溯 MySQL `kb_segment.id`，唯一约束（应用层保证引用，不建物理外键） |
| kb_id / doc_id | bigint | 知识库/文档过滤维度，普通索引 |
| doc_status | varchar(16) | 冗余自 `kb_document.status`；检索强制过滤 enabled（停用文档不参与检索，REQ-M03-02）；文档启停由 Java 触发同步 |
| content | text | 片段内容（命中直接返回，不回查 MySQL） |
| chapter / page_no | — | 来源定位（引用展示用） |
| keywords / keywords_tsv | text / tsvector | 关键词召回（应用层分词后写入 simple 配置），GIN 索引 |
| embedding | vector(1024) | 嵌入向量（bge-m3 维度；换模型须全量重建），HNSW 余弦索引 |
| embed_model / index_version | varchar | 嵌入模型标识 / 索引版本（对应 `kb_index_task.index_version`） |
| create_time / update_time | timestamptz | 时间戳 |

> 约束：本库归 Python ai-service 专用，**Java 不直连**；数据仅由 `/rag/index` 索引任务同步生成，禁手工 INSERT；混合检索 = 向量相似度 + 关键词召回 → 应用层融合重排。
> 不建：LangGraph checkpoint 表（启用 PostgresSaver 时由运行时自动建）；嵌入缓存表（用 Redis/进程内 LRU）。

### 7.2 双库边界与同步

| MySQL 表 | Python 侧对应 | 同步方式 |
|----------|--------------|----------|
| kb_segment | PostgreSQL `kb_segment_vector` | 索引任务（kb_index_task）驱动，Java 经 hwc-ai-client 调 `/rag/index` |
| kb_graph_node / kb_graph_edge | Neo4j 节点/边 | `/graph/extract` 自动抽取（回写候选边 source=auto），人工确认/编辑在 Java 侧落库后同步重建 |

> MySQL 为元数据权威，Python 侧（向量库/图库）可随时由元数据重建（数据模型设计.md §7）。Neo4j 无 SQL 脚本，由 Python 侧管理。

## 8. 迁移与版本

- 脚本：`V{序号}__{描述}.sql`；MySQL 置于 `code/backend/sql/mysql/`（V1 结构 / V2 初始化 / V3 演示数据），PostgreSQL 置于 `code/ai-service/sql/postgresql/`（V1 结构；向量数据由索引任务生成，无初始化/演示脚本）。
- 结构变更须同步更新本文档数据字典与 `数据模型设计.md` 表职责矩阵。
- 破坏性变更先经项目架构智能体评审（沿用既有规范）。

## 9. 待用户确认项（审查清单）

1. **D3 窄表**：`data_record` 一行一指标值是否认可（备选：JSON 宽行，查询灵活但无法建有效索引/约束）？
2. **D4 阈值语义**：三级嵌套区间（normal ⊆ warn ⊆ fault，出 fault 边界判为坏点剔除）是否符合预期？
3. **D5 新增 3 表**：`dev_spare_part_type`、`wo_work_order_part`、`wo_score_rule` 是否认可？
4. **D6 工单快照**：工单备件明细存生成时快照（名称/单价/库存）是否认可？
5. **D9 不建菜单表**：菜单由前端静态路由 + 权限码过滤是否认可？
6. 权限点粒度（模块:资源:动作，约 60 项）是否合适？
7. 演示数据规模（V3）是否需要扩充（如更多设备/指标以支撑看板效果）？