-- 审计日志接口测试基础造数（批次B / 任务5.1）
-- 造数登记：id 范围 1-22（表初始为空，auto_increment 从 1 开始）
-- 用途：A-AL1 查询用例 / A-AL2 导出用例 / 批次C 前端实测
-- 设计要点：
--   * 多模块 account(10)/audit(6)/test_mod(6)，test_mod 为下拉外自定义值
--   * 多动作 create/delete/update/export，多操作人 admin(9)/config1(6)/review1(4)/tester01(3，不存在值)
--   * 跨日分布 2026-10-01 ~ 2026-10-05；id=1 为固定时间 2026-10-01 08:30:00（秒级断言锚点）
--   * id=4 errorMsg 含特殊字符（逗号+双引号+换行），供 CSV 转义断言复用
--   * id=5 精确等于闭区间下界、id=12 精确等于上界（闭区间边界包含断言锚点）
--   * id=22 为范围内最大时间 2026-10-05 23:59:59（降序首条断言锚点）
-- 可重复执行：先清理本批造数再插入（保留 id>22 的运行时审计记录语义：本脚本不触碰 id>22）

DELETE FROM sys_audit_log WHERE id <= 22;

INSERT INTO sys_audit_log
  (id, operator_id, operator_name, endpoint, module, action, target_type, target_id,
   before_value, after_value, result, error_msg, ip, trace_id, operate_time, create_time)
VALUES
  (1,  1,  'admin',    'admin', 'account', 'create', 'user',      '3',     NULL, '{"status":"created"}', 1, NULL,                              '192.168.1.10', 'tr-al-001', '2026-10-01 08:30:00', '2026-10-01 08:30:00'),
  (2,  2,  'config1',  'admin', 'account', 'delete', 'user',      '9',     '{"status":"active"}', NULL, 1, NULL,                              '192.168.1.11', 'tr-al-002', '2026-10-01 10:15:00', '2026-10-01 10:15:00'),
  (3,  99, 'tester01', 'admin', 'test_mod','create', 'widget',    'W-01',  NULL, NULL,                 1, NULL,                              '10.0.0.3',     'tr-al-003', '2026-10-01 14:20:00', '2026-10-01 14:20:00'),
  (4,  5,  'review1',  'admin', 'audit',   'export', 'audit_log', NULL,    NULL, NULL,                 0, '含,逗号"双引号\n换行内容',        '10.0.0.4',     'tr-al-004', '2026-10-01 16:45:30', '2026-10-01 16:45:30'),
  (5,  1,  'admin',    'admin', 'account', 'delete', 'user',      '10',    NULL, NULL,                 1, NULL,                              '192.168.1.10', 'tr-al-005', '2026-10-02 00:00:00', '2026-10-02 00:00:00'),
  (6,  2,  'config1',  'admin', 'test_mod','update', 'widget',    'W-01',  '{"level":1}', '{"level":2}', 1, NULL,                           '192.168.1.11', 'tr-al-006', '2026-10-02 11:30:00', '2026-10-02 11:30:00'),
  (7,  1,  'admin',    'admin', 'audit',   'export', 'audit_log', NULL,    NULL, NULL,                 1, NULL,                              '192.168.1.10', 'tr-al-007', '2026-10-02 15:00:00', '2026-10-02 15:00:00'),
  (8,  99, 'tester01', 'admin', 'account', 'create', 'user',      '11',    NULL, NULL,                 0, '参数校验失败：目标不存在',        '10.0.0.3',     'tr-al-008', '2026-10-02 17:20:00', '2026-10-02 17:20:00'),
  (9,  5,  'review1',  'admin', 'account', 'update', 'user',      '3',     NULL, '{"nick":"r1"}',       1, NULL,                              '10.0.0.4',     'tr-al-009', '2026-10-03 08:50:00', '2026-10-03 08:50:00'),
  (10, 1,  'admin',    'admin', 'test_mod','delete', 'widget',    'W-02',  NULL, NULL,                 1, NULL,                              '192.168.1.10', 'tr-al-010', '2026-10-03 10:40:00', '2026-10-03 10:40:00'),
  (11, 2,  'config1',  'admin', 'audit',   'export', 'audit_log', NULL,    NULL, NULL,                 1, NULL,                              '192.168.1.11', 'tr-al-011', '2026-10-03 13:25:00', '2026-10-03 13:25:00'),
  (12, 1,  'admin',    'admin', 'account', 'create', 'user',      '12',    NULL, '{"status":"created"}', 1, NULL,                             '192.168.1.10', 'tr-al-012', '2026-10-03 23:59:59', '2026-10-03 23:59:59'),
  (13, 99, 'tester01', 'admin', 'audit',   'export', 'audit_log', NULL,    NULL, NULL,                 0, '权限不足',                        '10.0.0.3',     'tr-al-013', '2026-10-04 09:35:00', '2026-10-04 09:35:00'),
  (14, 1,  'admin',    'admin', 'account', 'delete', 'user',      '13',    NULL, NULL,                 1, NULL,                              '192.168.1.10', 'tr-al-014', '2026-10-04 11:00:00', '2026-10-04 11:00:00'),
  (15, 2,  'config1',  'admin', 'account', 'create', 'user',      '14',    NULL, NULL,                 1, NULL,                              '192.168.1.11', 'tr-al-015', '2026-10-04 14:15:00', '2026-10-04 14:15:00'),
  (16, 5,  'review1',  'admin', 'test_mod','create', 'widget',    'W-03',  NULL, NULL,                 1, NULL,                              '10.0.0.4',     'tr-al-016', '2026-10-04 16:30:00', '2026-10-04 16:30:00'),
  (17, 1,  'admin',    'admin', 'audit',   'export', 'audit_log', NULL,    NULL, NULL,                 1, NULL,                              '192.168.1.10', 'tr-al-017', '2026-10-05 08:00:00', '2026-10-05 08:00:00'),
  (18, 99, 'tester01', 'admin', 'test_mod','delete', 'widget',    'W-01',  NULL, NULL,                 0, '对象已被删除',                    '10.0.0.3',     'tr-al-018', '2026-10-05 10:10:00', '2026-10-05 10:10:00'),
  (19, 2,  'config1',  'admin', 'account', 'update', 'user',      '14',    NULL, '{"status":"locked"}',  1, NULL,                              '192.168.1.11', 'tr-al-019', '2026-10-05 12:00:00', '2026-10-05 12:00:00'),
  (20, 1,  'admin',    'admin', 'account', 'create', 'user',      '15',    NULL, NULL,                 1, NULL,                              '192.168.1.10', 'tr-al-020', '2026-10-05 15:45:00', '2026-10-05 15:45:00'),
  (21, 5,  'review1',  'admin', 'audit',   'export', 'audit_log', NULL,    NULL, NULL,                 1, NULL,                              '10.0.0.4',     'tr-al-021', '2026-10-05 18:30:00', '2026-10-05 18:30:00'),
  (22, 1,  'admin',    'admin', 'test_mod','create', 'device',    'D-001', NULL, '{"name":"CNC-01"}',   1, NULL,                              '192.168.1.10', 'tr-al-022', '2026-10-05 23:59:59', '2026-10-05 23:59:59');