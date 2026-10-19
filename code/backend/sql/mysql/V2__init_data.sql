-- =====================================================================
-- V2__init_data.sql  初始化数据：内置角色 / 权限点 / 角色映射 / 默认账号
--                     / 内置 Agent 与工具绑定 / 预设协同流程 / 全局评分规则
-- 依据：docs/设计文档/数据库表设计-DDL.md §5；需求方案V2.md §1.4 权限矩阵、M07
-- 默认账号：admin / Admin@123（BCrypt，首次登录建议改密）
-- =====================================================================
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. 内置角色（对应需求 §1.4，均不可删除）
-- ---------------------------------------------------------------------
INSERT INTO `sys_role` (`id`, `code`, `name`, `end_type`, `built_in`, `sort`, `description`, `creator`) VALUES
(1, 'ADMIN',        '管理员',       'admin', 1, 1, '资料与数据治理、账号权限、审计', 'system'),
(2, 'CONFIGURATOR', '配置员',       'admin', 1, 2, '配置 Agent 与流程、维护文档关联、发布服务', 'system'),
(3, 'ENGINEER',     '维修工程师',   'user',  1, 3, '发起/查看诊断、问答、核对依据、导出工单', 'system'),
(4, 'PRODUCER',     '生产管理人员', 'user',  1, 4, '查看设备状态与停机风险', 'system'),
(5, 'REVIEWER',     '评审用户',     'both',  1, 5, '双端只读，通过样例验证完整流程', 'system');

-- ---------------------------------------------------------------------
-- 2. 权限点（编码格式 <模块>:<资源>:<动作>；动作 read/write/publish/delete/export）
-- ---------------------------------------------------------------------
INSERT INTO `sys_permission` (`id`, `code`, `name`, `module`, `resource`, `action`, `end_type`, `sort`) VALUES
-- 设备配置（管理端）
(1,  'device:type:read',          '设备类型与型号查看', 'device',     'type',          'read',    'admin', 1101),
(2,  'device:type:write',         '设备类型与型号编辑', 'device',     'type',          'write',   'admin', 1102),
(3,  'device:info:read',          '设备台账查看',       'device',     'info',          'read',    'admin', 1103),
(4,  'device:info:write',         '设备台账编辑',       'device',     'info',          'write',   'admin', 1104),
(5,  'device:metric:read',        '指标与阈值查看',     'device',     'metric',        'read',    'admin', 1105),
(6,  'device:metric:write',       '指标与阈值编辑',     'device',     'metric',        'write',   'admin', 1106),
(7,  'device:alarm-rule:read',    '告警规则查看',       'device',     'alarm-rule',    'read',    'admin', 1107),
(8,  'device:alarm-rule:write',   '告警规则编辑',       'device',     'alarm-rule',    'write',   'admin', 1108),
(9,  'device:spare-part:read',    '备件查看',           'device',     'spare-part',    'read',    'admin', 1109),
(10, 'device:spare-part:write',   '备件编辑',           'device',     'spare-part',    'write',   'admin', 1110),
(11, 'device:downtime-cost:read', '停机损失查看',       'device',     'downtime-cost', 'read',    'admin', 1111),
(12, 'device:downtime-cost:write','停机损失编辑',       'device',     'downtime-cost', 'write',   'admin', 1112),
-- 知识库（管理端）
(13, 'knowledge:kb:read',         '知识库查看',         'knowledge',  'kb',            'read',    'admin', 1201),
(14, 'knowledge:kb:write',        '知识库编辑',         'knowledge',  'kb',            'write',   'admin', 1202),
(15, 'knowledge:document:read',   '文档查看',           'knowledge',  'document',      'read',    'admin', 1203),
(16, 'knowledge:document:write',  '文档上传与编辑',     'knowledge',  'document',      'write',   'admin', 1204),
(17, 'knowledge:document:publish','文档启停',           'knowledge',  'document',      'publish', 'admin', 1205),
(18, 'knowledge:document:delete', '文档删除',           'knowledge',  'document',      'delete',  'admin', 1206),
(19, 'knowledge:segment:read',    '片段查看',           'knowledge',  'segment',       'read',    'admin', 1207),
(20, 'knowledge:segment:write',   '片段校对',           'knowledge',  'segment',       'write',   'admin', 1208),
(21, 'knowledge:index:read',      '索引任务查看',       'knowledge',  'index',         'read',    'admin', 1209),
(22, 'knowledge:index:write',     '索引构建与重建',     'knowledge',  'index',         'write',   'admin', 1210),
-- 文档关联（管理端）
(23, 'docgraph:graph:read',       '关联图查看',         'docgraph',   'graph',         'read',    'admin', 1301),
(24, 'docgraph:graph:write',      '关联边管理',         'docgraph',   'graph',         'write',   'admin', 1302),
-- 设备数据（管理端）
(25, 'data:dataset:read',         '数据集查看',         'data',       'dataset',       'read',    'admin', 1401),
(26, 'data:dataset:write',        '数据导入与模拟',     'data',       'dataset',       'write',   'admin', 1402),
(27, 'data:dataset:delete',       '数据集删除',         'data',       'dataset',       'delete',  'admin', 1403),
(28, 'data:clean:read',           '清洗结果查看',       'data',       'clean',         'read',    'admin', 1404),
(29, 'data:clean:write',          '清洗执行',           'data',       'clean',         'write',   'admin', 1405),
(30, 'data:anomaly:read',         '异常清单查看',       'data',       'anomaly',       'read',    'admin', 1406),
(31, 'data:anomaly:export',       '异常导出',           'data',       'anomaly',       'export',  'admin', 1407),
-- Agent（管理端）
(32, 'agent:definition:read',     'Agent查看',          'agent',      'definition',    'read',    'admin', 1501),
(33, 'agent:definition:write',    'Agent编辑',          'agent',      'definition',    'write',   'admin', 1502),
(34, 'agent:binding:read',        '知识与工具绑定查看', 'agent',      'binding',       'read',    'admin', 1503),
(35, 'agent:binding:write',       '知识与工具绑定编辑', 'agent',      'binding',       'write',   'admin', 1504),
(36, 'agent:flow:read',           '协同流程查看',       'agent',      'flow',          'read',    'admin', 1505),
(37, 'agent:flow:write',          '协同流程编辑',       'agent',      'flow',          'write',   'admin', 1506),
-- 服务发布（管理端）
(38, 'publish:service:read',      '服务查看',           'publish',    'service',       'read',    'admin', 1601),
(39, 'publish:service:write',     '服务编辑',           'publish',    'service',       'write',   'admin', 1602),
(40, 'publish:service:publish',   '服务上线与暂停',     'publish',    'service',       'publish', 'admin', 1603),
(41, 'publish:credential:read',   '凭证查看',           'publish',    'credential',    'read',    'admin', 1604),
(42, 'publish:credential:write',  '凭证编辑',           'publish',    'credential',    'write',   'admin', 1605),
(43, 'publish:call-log:read',     '调用日志查看',       'publish',    'call-log',      'read',    'admin', 1606),
-- 审计（管理端）
(44, 'audit:log:read',            '审计日志查看',       'audit',      'log',           'read',    'admin', 1701),
(45, 'audit:log:export',          '审计日志导出',       'audit',      'log',           'export',  'admin', 1702),
-- 账号（管理端）
(46, 'account:user:read',         '用户查看',           'account',    'user',          'read',    'admin', 1801),
(47, 'account:user:write',        '用户编辑',           'account',    'user',          'write',   'admin', 1802),
(48, 'account:user:delete',       '用户删除',           'account',    'user',          'delete',  'admin', 1803),
(49, 'account:role:read',         '角色查看',           'account',    'role',          'read',    'admin', 1804),
(50, 'account:role:write',        '角色编辑',           'account',    'role',          'write',   'admin', 1805),
-- 用户端
(51, 'dashboard:read',            '设备健康看板查看',   'dashboard',  'board',         'read',    'user',  2101),
(52, 'chat:read',                 '问答会话查看',       'chat',       'session',       'read',    'user',  2201),
(53, 'chat:write',                '发起问答',           'chat',       'session',       'write',   'user',  2202),
(54, 'diagnosis:read',            '诊断记录查看',       'diagnosis',  'record',        'read',    'user',  2301),
(55, 'diagnosis:write',           '发起协同诊断',       'diagnosis',  'record',        'write',   'user',  2302),
(56, 'trace:read',                '故障溯源图查看',     'trace',      'graph',         'read',    'user',  2401),
(57, 'workorder:read',            '工单查看',           'workorder',  'order',         'read',    'user',  2501),
(58, 'workorder:export',          '工单导出下载',       'workorder',  'order',         'export',  'user',  2502),
(59, 'knowledge:search:read',     '知识检索（只读）',   'knowledge',  'search',        'read',    'user',  2601);

-- ---------------------------------------------------------------------
-- 3. 角色-权限映射（需求 §1.4 矩阵；详见 docs/需求文档/需求分析报告.md A1/A4）
--    ADMIN=管理端全部；CONFIGURATOR=device只读+知识/关联/Agent/发布（无data，需求§1.4权威）；
--    ENGINEER=用户端全部；PRODUCER=看板+只读诊断；REVIEWER=双端只读
-- ---------------------------------------------------------------------
INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `creator`) VALUES
-- ADMIN：1-50 全部（管理端）
(1,1,'system'),(1,2,'system'),(1,3,'system'),(1,4,'system'),(1,5,'system'),(1,6,'system'),(1,7,'system'),(1,8,'system'),(1,9,'system'),(1,10,'system'),
(1,11,'system'),(1,12,'system'),(1,13,'system'),(1,14,'system'),(1,15,'system'),(1,16,'system'),(1,17,'system'),(1,18,'system'),(1,19,'system'),(1,20,'system'),
(1,21,'system'),(1,22,'system'),(1,23,'system'),(1,24,'system'),(1,25,'system'),(1,26,'system'),(1,27,'system'),(1,28,'system'),(1,29,'system'),(1,30,'system'),
(1,31,'system'),(1,32,'system'),(1,33,'system'),(1,34,'system'),(1,35,'system'),(1,36,'system'),(1,37,'system'),(1,38,'system'),(1,39,'system'),(1,40,'system'),
(1,41,'system'),(1,42,'system'),(1,43,'system'),(1,44,'system'),(1,45,'system'),(1,46,'system'),(1,47,'system'),(1,48,'system'),(1,49,'system'),(1,50,'system'),
-- CONFIGURATOR：device只读(1,3,5,7,9,11) + 知识/关联(13-24) + Agent(32-37) + 发布(38-43)；不含data(需求§1.4)
(2,1,'system'),(2,3,'system'),(2,5,'system'),(2,7,'system'),(2,9,'system'),(2,11,'system'),
(2,13,'system'),(2,14,'system'),(2,15,'system'),(2,16,'system'),(2,17,'system'),(2,18,'system'),(2,19,'system'),(2,20,'system'),(2,21,'system'),(2,22,'system'),
(2,23,'system'),(2,24,'system'),(2,32,'system'),(2,33,'system'),(2,34,'system'),(2,35,'system'),(2,36,'system'),(2,37,'system'),
(2,38,'system'),(2,39,'system'),(2,40,'system'),(2,41,'system'),(2,42,'system'),(2,43,'system'),
-- ENGINEER：51-59（用户端全部）
(3,51,'system'),(3,52,'system'),(3,53,'system'),(3,54,'system'),(3,55,'system'),(3,56,'system'),(3,57,'system'),(3,58,'system'),(3,59,'system'),
-- PRODUCER：看板 + 只读诊断
(4,51,'system'),(4,54,'system'),
-- REVIEWER：双端全部 read 权限（含知识检索）
(5,1,'system'),(5,3,'system'),(5,5,'system'),(5,7,'system'),(5,9,'system'),(5,11,'system'),
(5,13,'system'),(5,15,'system'),(5,19,'system'),(5,21,'system'),(5,23,'system'),
(5,25,'system'),(5,28,'system'),(5,30,'system'),(5,32,'system'),(5,34,'system'),(5,36,'system'),
(5,38,'system'),(5,41,'system'),(5,43,'system'),(5,44,'system'),(5,46,'system'),(5,49,'system'),
(5,51,'system'),(5,52,'system'),(5,54,'system'),(5,56,'system'),(5,57,'system'),(5,59,'system');

-- ---------------------------------------------------------------------
-- 4. 默认账号：admin / Admin@123（BCrypt $2a，与 Spring Security 兼容）
-- ---------------------------------------------------------------------
INSERT INTO `sys_user` (`id`, `username`, `password`, `nickname`, `status`, `remark`, `creator`) VALUES
(1, 'admin', '$2a$10$.xXGWf5DB.UIcPqsmtSx2uDuAGMP8UapCN0Z4nVqXwXoIPHf3AF6C', '系统管理员', 1, '内置管理员，初始密码 Admin@123', 'system');
INSERT INTO `sys_user_role` (`user_id`, `role_id`, `creator`) VALUES (1, 1, 'system');
INSERT INTO `sys_role_data_scope` (`role_id`, `scope_type`, `scope_id`, `remark`, `creator`) VALUES
(1, 'ALL', 0, '管理员默认全部数据', 'system');

-- ---------------------------------------------------------------------
-- 5. 内置 Agent（五领域，对应需求 M07 §边界表）
-- ---------------------------------------------------------------------
INSERT INTO `agent_definition`
(`id`, `code`, `name`, `domain`, `responsibility`, `instruction`, `boundary`, `params`, `output_format`, `model_config`, `status`, `sort`, `creator`) VALUES
(1, 'monitor', '监测Agent', '监测',
 '异常确认与严重度分级：基于 M05 异常清单与 M02 阈值，确认异常是否成立并分级。',
 '你是工业设备监测专家。输入为设备某数据集的异常清单（含指标、类型、时间范围、样本统计）与对应阈值定义。请逐条核对异常与阈值的一致性，确认异常是否成立，给出严重度分级（warn/fault）与整体设备状态结论。所有判断必须依据输入数据，不得引入外部假设。',
 '不得推断故障根因；不得推荐备件；不得给出维修建议。',
 '{"topK":10}', '{"deviceStatus":"normal|warn|fault","anomalies":[{"anomalyId":1,"confirmed":true,"severity":"warn","reason":"..."}],"summary":"..."}',
 '{"model":"qwen-plus","temperature":0.1}', 1, 1, 'system'),
(2, 'root_cause', '根因诊断Agent', '根因诊断',
 '故障根因分析：基于确认异常与知识检索证据，输出按可能性排序的候选根因及引用。',
 '你是工业设备故障诊断专家。输入为已确认的异常清单与检索到的知识片段（含来源章节页码）。请结合设备类型与故障模式，推理给出候选根因列表（按可能性降序），每条根因必须标注支撑依据与引用来源；证据不足时明确说明不确定性。',
 '不得推荐备件；不得给出安全操作要求；不得输出维修步骤。',
 '{"topK":10,"useGraph":true}', '{"rootCauses":[{"cause":"...","probability":0.8,"evidence":["..."],"citations":[{"docId":1,"segmentId":10,"chapter":"3.2","page":15}]}],"conclusion":"..."}',
 '{"model":"qwen-plus","temperature":0.2}', 1, 2, 'system'),
(3, 'spare_cost', '备件成本Agent', '备件成本',
 '备件与成本核算：基于根因结论，查询备件库存与停机损失标准，输出备件清单与成本。',
 '你是备件与成本核算专员。输入为根因诊断结论、备件清单候选（含库存、单价、安全库存）与停机损失标准。请核对备件与根因的匹配性，输出所需备件（数量、单价、库存是否充足、是否低于安全库存）、预计停机时长与停机损失。所有数值必须来自输入，不得估算。',
 '不得判断故障根因；不得给出安全要求；不得新增根因结论。',
 '{"tools":["spare_stock_query","downtime_cost_calc"]}', '{"parts":[{"sparePartId":1,"name":"...","quantity":1,"unitPrice":120.00,"stockSufficient":true}],"estDowntimeHours":4.0,"downtimeCost":2000.00,"partsCost":120.00}',
 '{"model":"qwen-plus","temperature":0.1}', 1, 3, 'system'),
(4, 'safety', '安全规范Agent', '安全规范',
 '安全与合规核查：对拟定维修方案进行安全核查，输出安全要求与合规结论，拥有否决权。',
 '你是工业安全规范核查专家。输入为拟定的根因结论与维修要点、检索到的安全规程片段。请逐项核查涉及拆解、电气、参数调整等操作的步骤，输出安全要求清单与合规核查结论（passed/vetoed）；凡规程明确要求而方案缺失的措施，必须指出；存在安全隐患时行使否决权并说明依据。',
 '不得判断故障根因；不得推荐备件；不得修改维修步骤本身。',
 '{"topK":10,"strict":true}', '{"safetyRequirements":["..."],"checkResult":"passed|vetoed","vetoReason":"...","citations":[{"docId":2,"segmentId":33,"chapter":"5.1","page":42}]}',
 '{"model":"qwen-plus","temperature":0.0}', 1, 4, 'system'),
(5, 'work_order', '工单Agent', '工单编排',
 '工单编排：汇总上游各 Agent 结论，生成结构化维修工单。',
 '你是维修工单编排专员。输入为监测结论、根因诊断结论、备件成本结论、安全核查结论。请严格汇总上述结论生成结构化工单（设备信息、故障根因、风险等级、备件清单、安全要求、维修步骤、停机损失）。只允许整合上游已确认的结论，禁止新增任何未经上游确认的内容；安全核查未通过的步骤不得进入工单。',
 '不得新增未经上游确认的结论；不得改写上游结论；不得跳过安全否决。',
 '{}', '{"orderNo":"WO-...","faultSummary":"...","rootCause":"...","riskLevel":"...","parts":[...],"safetyRequirements":[...],"repairSteps":[{"step":1,"action":"..."}],"estDowntimeHours":4.0,"totalCost":0.0}',
 '{"model":"qwen-plus","temperature":0.1}', 1, 5, 'system');

-- Agent 知识与工具绑定（领域隔离：各 Agent 仅访问授权知识库与工具）
INSERT INTO `agent_tool_binding` (`agent_id`, `kb_ids`, `match_strictness`, `tools`, `remark`, `creator`) VALUES
(1, '[]',  'high',   '["threshold_query","anomaly_query"]', '监测Agent：只用阈值与异常数据，不接知识库', 'system'),
(2, NULL,   'medium', '[]',                                 '根因Agent：RAG+GraphRAG 检索（知识库范围由运行时按设备类型动态圈定）', 'system'),
(3, '[]',  'high',   '["spare_stock_query","downtime_cost_calc"]', '备件成本Agent：只用备件与停机损失主数据，不接知识库', 'system'),
(4, NULL,   'high',   '["safety_check"]',                   '安全Agent：仅检索安全规程类知识库', 'system'),
(5, '[]',  'high',   '[]',                                  '工单Agent：只汇总上游结论，不检索', 'system');

-- ---------------------------------------------------------------------
-- 6. 预设协同流程（REQ-M07-03：监测→诊断→备件成本/安全核查→工单）
-- ---------------------------------------------------------------------
INSERT INTO `agent_flow` (`id`, `code`, `name`, `version`, `status`, `is_preset`, `description`, `creator`) VALUES
(1, 'default_diagnosis', '默认协同诊断流程', 1, 'published', 1,
 '监测→（正常则结束）→根因诊断→（并行）备件成本+安全核查→（安全通过且成本完成）→工单编排', 'system');

INSERT INTO `agent_flow_node` (`flow_id`, `node_order`, `node_name`, `agent_id`, `trigger_condition`, `timeout_seconds`, `creator`) VALUES
(1, 1, '异常确认与分级', 1, NULL, 120, 'system'),
(1, 2, '根因诊断',       2, '{"expr":"monitor.deviceStatus != ''normal''"}', 180, 'system'),
(1, 3, '备件成本核算',   3, '{"expr":"root_cause.completed == true"}', 120, 'system'),
(1, 4, '安全规范核查',   4, '{"expr":"root_cause.completed == true"}', 120, 'system'),
(1, 5, '工单编排',       5, '{"expr":"safety.checkResult == ''passed'' && spare_cost.completed == true"}', 120, 'system');

-- ---------------------------------------------------------------------
-- 7. 全局健康评分规则（REQ-M09-02）
-- ---------------------------------------------------------------------
INSERT INTO `wo_score_rule` (`scope_type`, `scope_id`, `rule_config`, `status`, `remark`, `creator`) VALUES
('global', 0, '{"deviationWeight":0.6,"anomalyPenalty":0.4,"maxDeduction":40,"severityPenalty":{"warn":5,"fault":15}}', 1,
 '默认规则：评分=100-偏离扣分(权重0.6)-异常扣分(权重0.4)，总扣分上限40；预警异常每条扣5、故障异常每条扣15', 'system');