-- V4: Agent 画布编排（agent_flow_canvas）
-- 1. Agent 定义：派生模板追溯
ALTER TABLE `agent_definition`
  ADD COLUMN `base_template` VARCHAR(32) NOT NULL DEFAULT '' COMMENT '基础模板:monitor/root_cause/spare_cost/safety/work_order' AFTER `domain`;

UPDATE `agent_definition` SET `base_template` = `code`
WHERE `base_template` = '' AND `code` IN ('monitor','root_cause','spare_cost','safety','work_order');

-- 2. 流程：发布快照（草稿-发布分离，执行读取通道）
ALTER TABLE `agent_flow`
  ADD COLUMN `published_snapshot` JSON NULL DEFAULT NULL COMMENT '发布快照:agents完整配置JSON' AFTER `description`;

-- 3. 流程节点：实例键/上游连线/画布坐标
ALTER TABLE `agent_flow_node`
  ADD COLUMN `instance_key` VARCHAR(64) NULL DEFAULT NULL COMMENT '流程内实例键(默认=agent code)' AFTER `agent_id`,
  ADD COLUMN `upstream_instance_key` VARCHAR(64) NULL DEFAULT NULL COMMENT '上游节点实例键(NULL=起点)' AFTER `instance_key`,
  ADD COLUMN `position_x` INT NOT NULL DEFAULT 0 COMMENT '画布X坐标' AFTER `timeout_seconds`,
  ADD COLUMN `position_y` INT NOT NULL DEFAULT 0 COMMENT '画布Y坐标' AFTER `position_x`,
  ADD COLUMN `sort_seq` INT NOT NULL DEFAULT 0 COMMENT '前端提交顺序' AFTER `position_y`;

ALTER TABLE `agent_flow_node`
  ADD KEY `idx_flow_node_instance` (`flow_id`, `instance_key`);

-- 4. 存量节点 instance_key 回填
UPDATE `agent_flow_node` n
JOIN `agent_definition` d ON d.`id` = n.`agent_id`
SET n.`instance_key` = d.`code`
WHERE n.`instance_key` IS NULL;

-- 5. 存量节点画布坐标初始化（纵向网格）
UPDATE `agent_flow_node` SET `position_x` = 80, `position_y` = 80 + (`node_order` - 1) * 160 WHERE `position_x` = 0 AND `position_y` = 0;

-- 6. 执行步骤：实例维度追溯
ALTER TABLE `agent_step`
  ADD COLUMN `instance_key` VARCHAR(64) NULL DEFAULT NULL COMMENT '实例键(多实例区分归属)' AFTER `agent_id`;
-- 7. 存量节点 upstream 链式回填（node_order 顺序串联，保证旧流程可通过画布校验与发布）
UPDATE `agent_flow_node` n
JOIN `agent_flow_node` p ON p.`flow_id` = n.`flow_id` AND p.`node_order` = n.`node_order` - 1 AND p.`deleted` = 0
SET n.`upstream_instance_key` = p.`instance_key`
WHERE n.`upstream_instance_key` IS NULL AND n.`node_order` > 1;
