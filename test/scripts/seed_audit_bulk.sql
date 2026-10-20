-- 审计日志导出上限专项造数（批次B / 任务5.2）
-- 用途：向窄时间范围 2026-09-01 00:00:00 ~ 23:59:59 追加 50,001 条记录（module=test_bulk）
-- 设计：n=1..50001，operate_time = 2026-09-01 00:00:00 + (n-1) 秒
--   * 全日范围 50,001 条 > 上限 50,000 → 导出被拒（A-AL2-12）
--   * 00:00:00 ~ 06:00:00 闭区间 = 21,601 条 ≤ 上限 → 导出成功（A-AL2-14）
-- 与基础造数（id 1-22，10 月时间）无交集，不影响 A-AL1/A-AL2 主线断言
-- 清理：执行下方被注释的 DELETE（保留 5.1 基础造数 id 1-22）

INSERT INTO sys_audit_log
  (operator_id, operator_name, endpoint, module, action, target_type, target_id, result, ip, trace_id, operate_time, create_time)
SELECT 99, 'bulk01', 'admin', 'test_bulk', 'create', 'bulk', CONCAT('B-', LPAD(n, 6, '0')), 1, '10.9.9.9', CONCAT('tr-bulk-', LPAD(n, 6, '0')),
       TIMESTAMPADD(SECOND, n - 1, '2026-09-01 00:00:00'),
       TIMESTAMPADD(SECOND, n - 1, '2026-09-01 00:00:00')
FROM (
  SELECT a.d + b.d * 10 + c.d * 100 + e.d * 1000 + f.d * 10000 + 1 AS n
  FROM (SELECT 0 d UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a
  CROSS JOIN (SELECT 0 d UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b
  CROSS JOIN (SELECT 0 d UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) c
  CROSS JOIN (SELECT 0 d UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) e
  CROSS JOIN (SELECT 0 d UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) f
) seq
WHERE n <= 50001;

-- 验证：全日 50,001 条；00:00:00~06:00:00 共 21,600 条
-- SELECT COUNT(*) FROM sys_audit_log WHERE module='test_bulk';
-- SELECT COUNT(*) FROM sys_audit_log WHERE module='test_bulk' AND operate_time <= '2026-09-01 06:00:00';

-- 清理（验证完成后执行，保留基础造数 id 1-22）：
-- DELETE FROM sys_audit_log WHERE module='test_bulk';