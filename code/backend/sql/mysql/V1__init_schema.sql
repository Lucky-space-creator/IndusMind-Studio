-- =====================================================================
-- V1__init_schema.sql  业务关系库（MySQL 8.0+）建表脚本
-- 出品：数据层智能体（依据 docs/设计文档/数据库表设计-DDL.md V1.0）
-- 规范：InnoDB / utf8mb4_0900_ai_ci；无物理外键；逻辑删除 deleted BIGINT(0=未删,删除时置为id)
-- =====================================================================
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. 权限与审计（hwc-security）
-- ---------------------------------------------------------------------

CREATE TABLE `sys_user` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username`         VARCHAR(64)  NOT NULL COMMENT '登录名',
  `password`         VARCHAR(100) NOT NULL COMMENT '密码（BCrypt 哈希，自带盐）',
  `nickname`         VARCHAR(64)  NULL DEFAULT NULL COMMENT '显示名',
  `phone`            VARCHAR(20)  NULL DEFAULT NULL COMMENT '手机号',
  `email`            VARCHAR(128) NULL DEFAULT NULL COMMENT '邮箱',
  `status`           TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1=启用,0=禁用',
  `last_login_time`  DATETIME(3)  NULL DEFAULT NULL COMMENT '最近登录时间',
  `remark`           VARCHAR(512) NULL DEFAULT NULL COMMENT '备注',
  `create_time`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`          VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`          VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`          BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`          INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_username` (`username`, `deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='账号';

CREATE TABLE `sys_role` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `code`        VARCHAR(64)  NOT NULL COMMENT '角色编码',
  `name`        VARCHAR(64)  NOT NULL COMMENT '角色名称',
  `end_type`    VARCHAR(10)  NOT NULL DEFAULT 'both' COMMENT '可访问端:user/admin/both',
  `built_in`    TINYINT      NOT NULL DEFAULT 0 COMMENT '内置角色:1=不可删除',
  `sort`        INT          NOT NULL DEFAULT 0 COMMENT '排序',
  `description` VARCHAR(255) NULL DEFAULT NULL COMMENT '描述',
  `create_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`     BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`     INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_code` (`code`, `deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色（含可访问端）';

CREATE TABLE `sys_user_role` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`     BIGINT UNSIGNED NOT NULL COMMENT '用户id',
  `role_id`     BIGINT UNSIGNED NOT NULL COMMENT '角色id',
  `create_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `creator`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_role` (`user_id`, `role_id`),
  KEY `idx_user_role_role` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户-角色关联（物理删除）';

CREATE TABLE `sys_permission` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `code`        VARCHAR(128) NOT NULL COMMENT '权限编码:<模块>:<资源>:<动作>',
  `name`        VARCHAR(64)  NOT NULL COMMENT '权限名称',
  `module`      VARCHAR(32)  NOT NULL COMMENT '模块',
  `resource`    VARCHAR(32)  NOT NULL COMMENT '资源',
  `action`      VARCHAR(16)  NOT NULL COMMENT '动作:read/write/publish/delete/export',
  `end_type`    VARCHAR(10)  NOT NULL COMMENT '所属端:user/admin',
  `sort`        INT          NOT NULL DEFAULT 0 COMMENT '排序',
  `remark`      VARCHAR(255) NULL DEFAULT NULL COMMENT '备注',
  `create_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`     BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`     INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_permission_code` (`code`, `deleted`),
  KEY `idx_permission_module` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='权限点';

CREATE TABLE `sys_role_permission` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `role_id`       BIGINT UNSIGNED NOT NULL COMMENT '角色id',
  `permission_id` BIGINT UNSIGNED NOT NULL COMMENT '权限id',
  `create_time`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `creator`       VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_permission` (`role_id`, `permission_id`),
  KEY `idx_role_permission_permission` (`permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色-权限关联（物理删除）';

CREATE TABLE `sys_role_data_scope` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `role_id`     BIGINT UNSIGNED NOT NULL COMMENT '角色id',
  `scope_type`  VARCHAR(16)  NOT NULL COMMENT '范围类型:ALL/DEVICE_TYPE/DEVICE/KNOWLEDGE_BASE',
  `scope_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '范围对象id,ALL时为0',
  `remark`      VARCHAR(255) NULL DEFAULT NULL COMMENT '备注',
  `create_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`     BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`     INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  KEY `idx_scope_role` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色数据范围（P1）';

CREATE TABLE `sys_audit_log` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `operator_id`   BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '操作人id',
  `operator_name` VARCHAR(64)  NULL DEFAULT NULL COMMENT '操作人名',
  `endpoint`      VARCHAR(10)  NULL DEFAULT NULL COMMENT '来源端:user/admin',
  `module`        VARCHAR(32)  NOT NULL COMMENT '模块',
  `action`        VARCHAR(32)  NOT NULL COMMENT '动作:login/logout/create/update/delete/publish/export等',
  `target_type`   VARCHAR(32)  NULL DEFAULT NULL COMMENT '对象类型',
  `target_id`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '对象id',
  `before_value`  JSON         NULL DEFAULT NULL COMMENT '变更前值',
  `after_value`   JSON         NULL DEFAULT NULL COMMENT '变更后值',
  `result`        TINYINT      NOT NULL DEFAULT 1 COMMENT '结果:1=成功,0=失败',
  `error_msg`     VARCHAR(512) NULL DEFAULT NULL COMMENT '错误信息',
  `ip`            VARCHAR(64)  NULL DEFAULT NULL COMMENT '来源IP',
  `trace_id`      VARCHAR(64)  NULL DEFAULT NULL COMMENT '链路id',
  `operate_time`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '操作时间',
  `create_time`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_audit_operator` (`operator_name`, `operate_time`),
  KEY `idx_audit_module` (`module`, `operate_time`),
  KEY `idx_audit_time` (`operate_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='操作审计日志（只增不改）';

-- ---------------------------------------------------------------------
-- 2. 设备配置（hwc-device，主数据：全系统唯一权威）
-- ---------------------------------------------------------------------

CREATE TABLE `dev_type` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `code`        VARCHAR(32)  NOT NULL COMMENT '类型编码',
  `name`        VARCHAR(64)  NOT NULL COMMENT '类型名称:如数控机床/电机/变压器',
  `vendor`      VARCHAR(128) NULL DEFAULT NULL COMMENT '厂商',
  `description` VARCHAR(512) NULL DEFAULT NULL COMMENT '描述',
  `create_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`     BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`     INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_type_code` (`code`, `deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='设备类型（主数据）';

CREATE TABLE `dev_model` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `type_id`     BIGINT UNSIGNED NOT NULL COMMENT '设备类型id',
  `code`        VARCHAR(32)  NOT NULL COMMENT '型号编码',
  `name`        VARCHAR(128) NOT NULL COMMENT '型号名称',
  `spec`        VARCHAR(255) NULL DEFAULT NULL COMMENT '规格说明',
  `create_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`     BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`     INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_model_code` (`code`, `deleted`),
  KEY `idx_model_type` (`type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='设备型号（主数据）';

CREATE TABLE `dev_info` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `code`        VARCHAR(32)  NOT NULL COMMENT '设备编号',
  `name`        VARCHAR(128) NOT NULL COMMENT '设备名称',
  `type_id`     BIGINT UNSIGNED NOT NULL COMMENT '设备类型id（冗余自model，减少看板join）',
  `model_id`    BIGINT UNSIGNED NOT NULL COMMENT '型号id',
  `line_name`   VARCHAR(64)  NULL DEFAULT NULL COMMENT '所属产线',
  `location`    VARCHAR(128) NULL DEFAULT NULL COMMENT '安装位置',
  `status`      VARCHAR(16)  NOT NULL DEFAULT 'running' COMMENT '状态:running/standby/maintenance/fault',
  `run_date`    DATE         NULL DEFAULT NULL COMMENT '投运日期',
  `remark`      VARCHAR(512) NULL DEFAULT NULL COMMENT '备注',
  `create_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`     BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`     INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_info_code` (`code`, `deleted`),
  KEY `idx_info_type` (`type_id`),
  KEY `idx_info_model` (`model_id`),
  KEY `idx_info_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='设备台账（主数据）';

CREATE TABLE `dev_metric` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `type_id`         BIGINT UNSIGNED NOT NULL COMMENT '设备类型id',
  `code`            VARCHAR(32)  NOT NULL COMMENT '指标编码:temperature/vibration/current等',
  `name`            VARCHAR(64)  NOT NULL COMMENT '指标名称',
  `unit`            VARCHAR(16)  NULL DEFAULT NULL COMMENT '单位',
  `sample_interval` INT          NOT NULL DEFAULT 60 COMMENT '采样频率（秒）',
  `create_time`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`         VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`         VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`         BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`         INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_metric_type_code` (`type_id`, `code`, `deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='监测指标定义（主数据，按设备类型）';

CREATE TABLE `dev_metric_threshold` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `metric_id`   BIGINT UNSIGNED NOT NULL COMMENT '指标id',
  `normal_min`  DECIMAL(14,4) NOT NULL COMMENT '正常区间下限',
  `normal_max`  DECIMAL(14,4) NOT NULL COMMENT '正常区间上限',
  `warn_min`    DECIMAL(14,4) NOT NULL COMMENT '预警区间下限（含正常区间）',
  `warn_max`    DECIMAL(14,4) NOT NULL COMMENT '预警区间上限（含正常区间）',
  `fault_min`   DECIMAL(14,4) NOT NULL COMMENT '故障边界下限（含预警区间）',
  `fault_max`   DECIMAL(14,4) NOT NULL COMMENT '故障边界上限（含预警区间）',
  `remark`      VARCHAR(512) NULL DEFAULT NULL COMMENT '备注',
  `create_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`     BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`     INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_threshold_metric` (`metric_id`, `deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='指标阈值（三级嵌套区间:normal⊆warn⊆fault；判定:值∈normal为正常,出normal在warn内为预警,出warn在fault内为故障,出fault为疑似坏点剔除；校验:fault_min≤warn_min≤normal_min≤normal_max≤warn_max≤fault_max，应用层实现）';

CREATE TABLE `dev_alarm_rule` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `metric_id`      BIGINT UNSIGNED NOT NULL COMMENT '指标id',
  `level`          VARCHAR(16)  NOT NULL COMMENT '告警等级:warn/fault',
  `condition_type` VARCHAR(32)  NOT NULL COMMENT '触发条件类型:threshold_breach阈值越限/continuous_over持续超限/trend趋势持续/fluctuation异常波动',
  `duration_count` INT          NULL DEFAULT NULL COMMENT '持续次数（持续超限时生效）',
  `threshold_expr` JSON         NULL DEFAULT NULL COMMENT '触发条件参数:如{"window":10,"delta":0.8}',
  `enabled`        TINYINT      NOT NULL DEFAULT 1 COMMENT '是否启用:1=是,0=否',
  `description`    VARCHAR(512) NULL DEFAULT NULL COMMENT '规则说明',
  `create_time`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`        VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`        VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`        BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`        INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  KEY `idx_alarm_metric` (`metric_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='告警规则（主数据，供异常提取引用）';

CREATE TABLE `dev_spare_part` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `code`         VARCHAR(32)   NOT NULL COMMENT '备件编码',
  `name`         VARCHAR(128)  NOT NULL COMMENT '备件名称',
  `model`        VARCHAR(64)   NULL DEFAULT NULL COMMENT '备件型号',
  `unit`         VARCHAR(16)   NULL DEFAULT NULL COMMENT '单位',
  `stock`        INT           NOT NULL DEFAULT 0 COMMENT '当前库存',
  `safety_stock` INT           NOT NULL DEFAULT 0 COMMENT '安全库存',
  `unit_price`   DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '采购单价（元）',
  `status`       TINYINT       NOT NULL DEFAULT 1 COMMENT '状态:1=启用,0=停用',
  `remark`       VARCHAR(512)  NULL DEFAULT NULL COMMENT '备注',
  `create_time`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`      VARCHAR(64)   NULL DEFAULT NULL COMMENT '创建人',
  `updater`      VARCHAR(64)   NULL DEFAULT NULL COMMENT '更新人',
  `deleted`      BIGINT        NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`      INT           NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_spare_code` (`code`, `deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='备件（主数据）';

CREATE TABLE `dev_spare_part_type` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `spare_part_id` BIGINT UNSIGNED NOT NULL COMMENT '备件id',
  `dev_type_id`   BIGINT UNSIGNED NOT NULL COMMENT '适用设备类型id',
  `create_time`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `creator`       VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_spare_type` (`spare_part_id`, `dev_type_id`),
  KEY `idx_spare_type_type` (`dev_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='备件-适用设备类型关联（多对多，物理删除）';

CREATE TABLE `dev_downtime_cost` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `scope_type`    VARCHAR(16)   NOT NULL COMMENT '范围:global全局/device设备/line产线',
  `device_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '设备id（scope=device时）',
  `line_name`     VARCHAR(64)   NULL DEFAULT NULL COMMENT '产线名（scope=line时）',
  `cost_per_hour` DECIMAL(12,2) NOT NULL COMMENT '每小时停机损失（元）',
  `remark`        VARCHAR(512)  NULL DEFAULT NULL COMMENT '备注',
  `create_time`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`       VARCHAR(64)   NULL DEFAULT NULL COMMENT '创建人',
  `updater`       VARCHAR(64)   NULL DEFAULT NULL COMMENT '更新人',
  `deleted`       BIGINT        NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`       INT           NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  KEY `idx_downtime_device` (`device_id`),
  KEY `idx_downtime_line` (`line_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='停机损失标准（主数据；取值优先级:device>line>global，应用层实现）';

-- ---------------------------------------------------------------------
-- 3. 知识库（hwc-knowledge）
-- ---------------------------------------------------------------------

CREATE TABLE `kb_knowledge_base` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`         VARCHAR(128)  NOT NULL COMMENT '知识库名称',
  `dev_type_id`  BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '设备类型id（按设备类型分类，0=不限）',
  `vendor`       VARCHAR(128)  NULL DEFAULT NULL COMMENT '厂商（按厂商分类）',
  `fault_level`  VARCHAR(16)   NULL DEFAULT NULL COMMENT '故障等级:general通用/common常见/severe疑难',
  `doc_count`    INT           NOT NULL DEFAULT 0 COMMENT '文档数（派生统计）',
  `index_status` VARCHAR(16)   NOT NULL DEFAULT 'idle' COMMENT '索引状态:idle/building/ready/failed',
  `description`  VARCHAR(512)  NULL DEFAULT NULL COMMENT '描述',
  `create_time`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`      VARCHAR(64)   NULL DEFAULT NULL COMMENT '创建人',
  `updater`      VARCHAR(64)   NULL DEFAULT NULL COMMENT '更新人',
  `deleted`      BIGINT        NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`      INT           NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_kb_name` (`name`, `deleted`),
  KEY `idx_kb_type` (`dev_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='知识库';

CREATE TABLE `kb_document` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `kb_id`         BIGINT UNSIGNED NOT NULL COMMENT '知识库id',
  `doc_name`      VARCHAR(255)  NOT NULL COMMENT '文档名称',
  `doc_type`      VARCHAR(32)   NOT NULL COMMENT '类型:manual维修手册/procedure操作规程/history历史维修记录',
  `version`       VARCHAR(32)   NOT NULL DEFAULT 'V1' COMMENT '文档版本',
  `status`        VARCHAR(16)   NOT NULL DEFAULT 'enabled' COMMENT '状态:enabled/disabled（停用不参与检索）',
  `file_url`      VARCHAR(512)  NULL DEFAULT NULL COMMENT '文件地址（MinIO）',
  `file_type`     VARCHAR(16)   NULL DEFAULT NULL COMMENT '文件类型:pdf/docx/md',
  `file_size`     BIGINT        NULL DEFAULT NULL COMMENT '文件大小（字节）',
  `segment_count` INT           NOT NULL DEFAULT 0 COMMENT '片段数（派生统计）',
  `remark`        VARCHAR(512)  NULL DEFAULT NULL COMMENT '备注',
  `create_time`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`       VARCHAR(64)   NULL DEFAULT NULL COMMENT '创建人',
  `updater`       VARCHAR(64)   NULL DEFAULT NULL COMMENT '更新人',
  `deleted`       BIGINT        NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version_lock`  INT           NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  KEY `idx_document_kb` (`kb_id`),
  KEY `idx_document_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='知识库文档';

CREATE TABLE `kb_segment` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `doc_id`     BIGINT UNSIGNED NOT NULL COMMENT '文档id',
  `seq_no`     INT          NOT NULL COMMENT '片段序号（文档内递增）',
  `content`    TEXT         NOT NULL COMMENT '片段内容',
  `chapter`    VARCHAR(255) NULL DEFAULT NULL COMMENT '来源章节',
  `page_no`    INT          NULL DEFAULT NULL COMMENT '来源页码',
  `char_count` INT          NOT NULL DEFAULT 0 COMMENT '字符数',
  `keywords`   JSON         NULL DEFAULT NULL COMMENT '补充关键词（检索增强）',
  `create_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`    VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`    VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`    BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`    INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_segment_doc_seq` (`doc_id`, `seq_no`, `deleted`),
  KEY `idx_segment_doc` (`doc_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='知识库片段（pgvector 向量的元数据来源，segment_id 为外键）';

CREATE TABLE `kb_index_task` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `kb_id`         BIGINT UNSIGNED NOT NULL COMMENT '知识库id',
  `doc_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '文档id（全库重建时为0）',
  `task_type`     VARCHAR(16)   NOT NULL COMMENT '任务类型:index/reindex',
  `status`        VARCHAR(16)   NOT NULL DEFAULT 'pending' COMMENT '状态:pending/processing/success/failed',
  `progress`      INT           NOT NULL DEFAULT 0 COMMENT '进度(0-100)',
  `index_version` VARCHAR(32)   NULL DEFAULT NULL COMMENT '索引版本',
  `error_msg`     VARCHAR(512)  NULL DEFAULT NULL COMMENT '错误信息',
  `started_at`    DATETIME(3)   NULL DEFAULT NULL COMMENT '开始时间',
  `finished_at`   DATETIME(3)   NULL DEFAULT NULL COMMENT '结束时间',
  `create_time`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`       VARCHAR(64)   NULL DEFAULT NULL COMMENT '创建人',
  `updater`       VARCHAR(64)   NULL DEFAULT NULL COMMENT '更新人',
  `deleted`       BIGINT        NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`       INT           NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  KEY `idx_index_task_kb` (`kb_id`),
  KEY `idx_index_task_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='索引构建任务（驱动 Java→Python /rag/index 调用）';

-- ---------------------------------------------------------------------
-- 4. 文档关联（hwc-docgraph，GraphRAG 业务元数据；只做文档/片段间关系）
-- ---------------------------------------------------------------------

CREATE TABLE `kb_graph_node` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `kb_id`      BIGINT UNSIGNED NOT NULL COMMENT '知识库id',
  `node_type`  VARCHAR(16)  NOT NULL COMMENT '节点类型:document/section/segment',
  `ref_id`     BIGINT UNSIGNED NOT NULL COMMENT '回溯id:document→kb_document.id,section/segment→kb_segment.id',
  `title`      VARCHAR(255) NULL DEFAULT NULL COMMENT '节点标题',
  `extra`      JSON         NULL DEFAULT NULL COMMENT '扩展信息（章节号等）',
  `create_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`    VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`    VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`    BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`    INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_graph_node_ref` (`node_type`, `ref_id`, `deleted`),
  KEY `idx_graph_node_kb` (`kb_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='文档关联图节点（Neo4j 节点的元数据镜像，可重建图）';

CREATE TABLE `kb_graph_edge` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `from_node_id`  BIGINT UNSIGNED NOT NULL COMMENT '起始节点id',
  `to_node_id`    BIGINT UNSIGNED NOT NULL COMMENT '目标节点id',
  `relation_type` VARCHAR(32)   NOT NULL COMMENT '关系类型:reference引用/supplement补充/replacement替代/prerequisite前置/same_device同设备/same_fault同故障',
  `source`        VARCHAR(16)   NOT NULL DEFAULT 'auto' COMMENT '来源:auto自动抽取/manual人工',
  `confidence`    DECIMAL(5,4)  NULL DEFAULT NULL COMMENT '自动抽取置信度(0-1)',
  `status`        VARCHAR(16)   NOT NULL DEFAULT 'confirmed' COMMENT '状态:pending待确认/confirmed已确认/rejected已拒绝（auto边需人工确认）',
  `remark`        VARCHAR(255)  NULL DEFAULT NULL COMMENT '人工备注',
  `create_time`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`       VARCHAR(64)   NULL DEFAULT NULL COMMENT '创建人',
  `updater`       VARCHAR(64)   NULL DEFAULT NULL COMMENT '更新人',
  `deleted`       BIGINT        NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`       INT           NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_graph_edge` (`from_node_id`, `to_node_id`, `relation_type`, `deleted`),
  KEY `idx_graph_edge_to` (`to_node_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='文档关联边（只描述文档/片段间关系；auto边由Python /graph/extract 抽取回写，人工可确认/编辑/拒绝）';

-- ---------------------------------------------------------------------
-- 5. 设备数据（hwc-device-data）
-- ---------------------------------------------------------------------

CREATE TABLE `data_dataset` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`          VARCHAR(128)  NOT NULL COMMENT '数据集名称',
  `device_id`     BIGINT UNSIGNED NOT NULL COMMENT '设备id',
  `source_type`   VARCHAR(16)   NOT NULL COMMENT '来源:import导入/simulate模拟',
  `file_url`      VARCHAR(512)  NULL DEFAULT NULL COMMENT '导入文件地址',
  `time_start`    DATETIME(3)   NULL DEFAULT NULL COMMENT '数据起始时间',
  `time_end`      DATETIME(3)   NULL DEFAULT NULL COMMENT '数据结束时间',
  `record_count`  INT           NOT NULL DEFAULT 0 COMMENT '原始记录数（派生统计）',
  `metric_ids`    JSON          NULL DEFAULT NULL COMMENT '包含的指标id列表',
  `clean_config`  JSON          NULL DEFAULT NULL COMMENT '清洗规则配置',
  `cleaned_count` INT           NOT NULL DEFAULT 0 COMMENT '清洗后记录数（派生统计）',
  `anomaly_count` INT           NOT NULL DEFAULT 0 COMMENT '异常数（派生统计）',
  `status`        VARCHAR(16)   NOT NULL DEFAULT 'uploaded' COMMENT '状态:uploaded/cleaning/cleaned/extracting/ready/failed',
  `error_msg`     VARCHAR(512)  NULL DEFAULT NULL COMMENT '错误信息',
  `create_time`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`       VARCHAR(64)   NULL DEFAULT NULL COMMENT '创建人',
  `updater`       VARCHAR(64)   NULL DEFAULT NULL COMMENT '更新人',
  `deleted`       BIGINT        NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`       INT           NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  KEY `idx_dataset_device` (`device_id`),
  KEY `idx_dataset_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='设备数据集';

CREATE TABLE `data_record` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `dataset_id`   BIGINT UNSIGNED NOT NULL COMMENT '数据集id',
  `device_id`    BIGINT UNSIGNED NOT NULL COMMENT '设备id（冗余自dataset，便于按设备查趋势）',
  `metric_id`    BIGINT UNSIGNED NOT NULL COMMENT '指标id',
  `collect_time` DATETIME(3)   NOT NULL COMMENT '采集时间',
  `metric_value` DECIMAL(14,4) NOT NULL COMMENT '指标值',
  `create_time`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_record_key` (`dataset_id`, `metric_id`, `collect_time`),
  KEY `idx_record_dataset_time` (`dataset_id`, `collect_time`),
  KEY `idx_record_device` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='原始监测记录（窄表：一行一指标值；只增不改；数据量大时按dataset_id分区归档）';

CREATE TABLE `data_cleaned` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `dataset_id`    BIGINT UNSIGNED NOT NULL COMMENT '数据集id',
  `record_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '原始记录id（0=清洗新增）',
  `metric_id`     BIGINT UNSIGNED NOT NULL COMMENT '指标id',
  `collect_time`  DATETIME(3)   NOT NULL COMMENT '采集时间',
  `raw_value`     DECIMAL(14,4) NULL DEFAULT NULL COMMENT '原始值（被剔除时为空）',
  `cleaned_value` DECIMAL(14,4) NULL DEFAULT NULL COMMENT '清洗后值（被剔除时为空）',
  `is_modified`   TINYINT       NOT NULL DEFAULT 0 COMMENT '是否被修改:1=是,0=否',
  `rules_applied` JSON          NULL DEFAULT NULL COMMENT '应用的清洗规则:如["missing_fill","outlier_remove","dedup"]',
  `remark`        VARCHAR(255)  NULL DEFAULT NULL COMMENT '备注',
  `create_time`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_cleaned_key` (`dataset_id`, `metric_id`, `collect_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='清洗结果（过程数据）';

CREATE TABLE `data_anomaly` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `dataset_id`   BIGINT UNSIGNED NOT NULL COMMENT '数据集id',
  `device_id`    BIGINT UNSIGNED NOT NULL COMMENT '设备id',
  `metric_id`    BIGINT UNSIGNED NOT NULL COMMENT '指标id',
  `anomaly_type` VARCHAR(32)  NOT NULL COMMENT '异常类型:threshold_breach阈值越限/continuous_trend持续升降/sudden_fluctuation异常波动',
  `severity`     VARCHAR(16)  NOT NULL COMMENT '严重度:warn/fault',
  `start_time`   DATETIME(3)  NOT NULL COMMENT '异常开始时间',
  `end_time`     DATETIME(3)  NOT NULL COMMENT '异常结束时间',
  `sample_count` INT          NOT NULL DEFAULT 0 COMMENT '涉及样本数',
  `peak_value`   DECIMAL(14,4) NULL DEFAULT NULL COMMENT '峰值',
  `avg_value`    DECIMAL(14,4) NULL DEFAULT NULL COMMENT '均值',
  `summary`      VARCHAR(512) NULL DEFAULT NULL COMMENT '异常摘要',
  `detail`       JSON         NULL DEFAULT NULL COMMENT '明细（样本序列、判定依据等）',
  `create_time`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`      VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`      VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`      BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`      INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  KEY `idx_anomaly_dataset` (`dataset_id`),
  KEY `idx_anomaly_device` (`device_id`, `severity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='异常清单（M05 产出，监测 Agent 输入）';

-- ---------------------------------------------------------------------
-- 6. Agent 与诊断（hwc-agent）
-- ---------------------------------------------------------------------

CREATE TABLE `agent_definition` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `code`          VARCHAR(32)  NOT NULL COMMENT 'Agent编码:monitor/root_cause/spare_cost/safety/work_order',
  `name`          VARCHAR(64)  NOT NULL COMMENT 'Agent名称',
  `domain`        VARCHAR(32)  NOT NULL COMMENT '领域:监测/根因诊断/备件成本/安全规范/工单编排',
  `responsibility` VARCHAR(512) NOT NULL COMMENT '职责描述',
  `instruction`   TEXT         NOT NULL COMMENT '系统指令（System Prompt）',
  `boundary`      VARCHAR(512) NOT NULL COMMENT '越界禁止事项（对应M07领域边界）',
  `params`        JSON         NULL DEFAULT NULL COMMENT '运行参数',
  `output_format` TEXT         NULL DEFAULT NULL COMMENT '回复格式要求/模板',
  `model_config`  JSON         NULL DEFAULT NULL COMMENT '模型配置:{"model":"...","temperature":0.2}',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1=启用,0=停用',
  `sort`          INT          NOT NULL DEFAULT 0 COMMENT '排序',
  `create_time`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`       VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`       VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`       BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`       INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_agent_code` (`code`, `deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Agent 配置';

CREATE TABLE `agent_tool_binding` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `agent_id`          BIGINT UNSIGNED NOT NULL COMMENT 'Agent id',
  `kb_ids`            JSON         NULL DEFAULT NULL COMMENT '知识库范围（kb_id 数组，领域隔离依据）',
  `match_strictness`  VARCHAR(16)  NOT NULL DEFAULT 'medium' COMMENT '匹配严格度:high/medium/low',
  `tools`             JSON         NULL DEFAULT NULL COMMENT '启用工具编码:spare_stock_query/downtime_cost_calc/threshold_query/safety_check/anomaly_query',
  `remark`            VARCHAR(512) NULL DEFAULT NULL COMMENT '备注',
  `create_time`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`           VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`           VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`           BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`           INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_binding_agent` (`agent_id`, `deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Agent 知识与工具绑定';

CREATE TABLE `agent_flow` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `code`        VARCHAR(32)  NOT NULL COMMENT '流程编码',
  `name`        VARCHAR(128) NOT NULL COMMENT '流程名称',
  `version`     INT          NOT NULL DEFAULT 1 COMMENT '版本号',
  `status`      VARCHAR(16)  NOT NULL DEFAULT 'draft' COMMENT '状态:draft/published/offline',
  `is_preset`   TINYINT      NOT NULL DEFAULT 0 COMMENT '预设流程:1=是（不可删）',
  `description` VARCHAR(512) NULL DEFAULT NULL COMMENT '描述',
  `create_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`     BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version_lock` INT         NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_flow_code` (`code`, `deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Agent 协同流程';

CREATE TABLE `agent_flow_node` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `flow_id`           BIGINT UNSIGNED NOT NULL COMMENT '流程id',
  `node_order`        INT          NOT NULL COMMENT '执行顺序',
  `node_name`         VARCHAR(64)  NOT NULL COMMENT '节点名称',
  `agent_id`          BIGINT UNSIGNED NOT NULL COMMENT 'Agent id',
  `trigger_condition` JSON         NULL DEFAULT NULL COMMENT '触发条件:null=无条件;如{"expr":"monitor.severity != normal"}',
  `timeout_seconds`   INT          NOT NULL DEFAULT 120 COMMENT '超时（秒）',
  `remark`            VARCHAR(255) NULL DEFAULT NULL COMMENT '备注',
  `create_time`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`           VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`           VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`           BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`           INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  KEY `idx_flow_node_flow` (`flow_id`),
  KEY `idx_flow_node_agent` (`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='协同流程节点';

CREATE TABLE `agent_run` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `run_type`    VARCHAR(16)  NOT NULL COMMENT '类型:single单Agent/multi协同',
  `flow_id`     BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '流程id（multi时）',
  `session_id`  BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '问答会话id（问答触发时）',
  `device_id`   BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '设备id（diagnosis必填,应用层校验;single通用问答可空）',
  `dataset_id`  BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '数据集id',
  `input`       JSON         NULL DEFAULT NULL COMMENT '输入（问题/上下文/异常引用等）',
  `status`      VARCHAR(16)  NOT NULL DEFAULT 'running' COMMENT '状态:running/success/failed/timeout',
  `conclusion`  TEXT         NULL DEFAULT NULL COMMENT '总结论',
  `trace_id`    VARCHAR(64)  NULL DEFAULT NULL COMMENT '链路id（幂等/排障）',
  `started_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '开始时间',
  `ended_at`    DATETIME(3)  NULL DEFAULT NULL COMMENT '结束时间',
  `duration_ms` INT          NULL DEFAULT NULL COMMENT '总耗时（毫秒）',
  `error_msg`   VARCHAR(512) NULL DEFAULT NULL COMMENT '错误信息',
  `create_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`     BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`     INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  KEY `idx_run_flow` (`flow_id`),
  KEY `idx_run_session` (`session_id`),
  KEY `idx_run_device` (`device_id`),
  KEY `idx_run_trace` (`trace_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Agent 运行记录';

CREATE TABLE `agent_step` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `run_id`      BIGINT UNSIGNED NOT NULL COMMENT '运行id',
  `step_order`  INT          NOT NULL COMMENT '步骤顺序',
  `agent_id`    BIGINT UNSIGNED NOT NULL COMMENT 'Agent id',
  `phase`       VARCHAR(16)  NOT NULL COMMENT '阶段:retrieve检索/reason推理/tool工具/generate生成',
  `summary`     VARCHAR(1024) NULL DEFAULT NULL COMMENT '步骤摘要',
  `detail`      JSON         NULL DEFAULT NULL COMMENT '明细（工具调用结果/中间推理）',
  `citations`   JSON         NULL DEFAULT NULL COMMENT '引用:[{"docId":1,"segmentId":10,"chapter":"3.2","page":15,"score":0.87}]',
  `duration_ms` INT          NULL DEFAULT NULL COMMENT '耗时（毫秒）',
  `status`      VARCHAR(16)  NOT NULL DEFAULT 'success' COMMENT '状态:success/failed/skipped',
  `create_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_step_run` (`run_id`, `step_order`),
  KEY `idx_step_agent` (`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Agent 步骤明细（过程数据，只增）';

CREATE TABLE `diagnosis_record` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `run_id`            BIGINT UNSIGNED NOT NULL COMMENT '来源运行id',
  `device_id`         BIGINT UNSIGNED NOT NULL COMMENT '设备id',
  `dataset_id`        BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '数据集id',
  `fault_summary`     VARCHAR(512)  NULL DEFAULT NULL COMMENT '故障摘要',
  `root_cause`        TEXT          NULL DEFAULT NULL COMMENT '根因结论（按可能性排序的候选+依据）',
  `risk_level`        VARCHAR(16)   NOT NULL DEFAULT 'medium' COMMENT '风险等级:low/medium/high',
  `safety_conclusion` VARCHAR(1024) NULL DEFAULT NULL COMMENT '安全核查结论',
  `citations`         JSON          NULL DEFAULT NULL COMMENT '引用:[{"docId":1,"segmentId":10,"chapter":"3.2","page":15}]',
  `conclusion_time`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '结论时间',
  `create_time`       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`           VARCHAR(64)   NULL DEFAULT NULL COMMENT '创建人',
  `updater`           VARCHAR(64)   NULL DEFAULT NULL COMMENT '更新人',
  `deleted`           BIGINT        NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`           INT           NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_diagnosis_run` (`run_id`, `deleted`),
  KEY `idx_diagnosis_device` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='诊断记录（协同诊断业务结论）';

CREATE TABLE `chat_session` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`           BIGINT UNSIGNED NOT NULL COMMENT '用户id',
  `title`             VARCHAR(128)  NULL DEFAULT NULL COMMENT '会话标题',
  `message_count`     INT           NOT NULL DEFAULT 0 COMMENT '消息数（派生统计）',
  `last_message_time` DATETIME(3)   NULL DEFAULT NULL COMMENT '最近消息时间',
  `status`            VARCHAR(16)   NOT NULL DEFAULT 'active' COMMENT '状态:active/closed',
  `create_time`       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`           VARCHAR(64)   NULL DEFAULT NULL COMMENT '创建人',
  `updater`           VARCHAR(64)   NULL DEFAULT NULL COMMENT '更新人',
  `deleted`           BIGINT        NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`           INT           NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  KEY `idx_session_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='问答会话';

CREATE TABLE `chat_message` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `session_id`  BIGINT UNSIGNED NOT NULL COMMENT '会话id',
  `role`        VARCHAR(16)  NOT NULL COMMENT '角色:user/assistant',
  `content`     TEXT         NOT NULL COMMENT '消息内容',
  `citations`   JSON         NULL DEFAULT NULL COMMENT '引用:[{"docId":1,"segmentId":10,"chapter":"3.2","page":15,"score":0.87}]',
  `create_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_message_session` (`session_id`, `create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='问答消息（只增）';

-- ---------------------------------------------------------------------
-- 7. 服务发布（hwc-publish）
-- ---------------------------------------------------------------------

CREATE TABLE `pub_service` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `flow_id`         BIGINT UNSIGNED NOT NULL COMMENT '协同流程id',
  `code`            VARCHAR(64)  NOT NULL COMMENT '服务编码（API路径用）',
  `name`            VARCHAR(128) NOT NULL COMMENT '服务名称',
  `status`          VARCHAR(16)  NOT NULL DEFAULT 'online' COMMENT '状态:online/paused/offline',
  `current_version` VARCHAR(32)  NULL DEFAULT NULL COMMENT '当前版本',
  `description`     VARCHAR(512) NULL DEFAULT NULL COMMENT '描述',
  `create_time`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`         VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`         VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`         BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`         INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_service_code` (`code`, `deleted`),
  KEY `idx_service_flow` (`flow_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='已发布服务';

CREATE TABLE `pub_credential` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `service_id`  BIGINT UNSIGNED NOT NULL COMMENT '服务id',
  `access_key`  VARCHAR(64)  NOT NULL COMMENT '访问键',
  `secret_key`  VARCHAR(255) NOT NULL COMMENT '密钥（应用层AES加密存储）',
  `status`      VARCHAR(16)  NOT NULL DEFAULT 'enabled' COMMENT '状态:enabled/disabled',
  `expire_time` DATETIME(3)  NULL DEFAULT NULL COMMENT '过期时间（空=永久）',
  `remark`      VARCHAR(255) NULL DEFAULT NULL COMMENT '备注',
  `create_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`     BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`     INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_credential_ak` (`access_key`),
  KEY `idx_credential_service` (`service_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='服务调用凭证';

CREATE TABLE `pub_version` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `service_id`      BIGINT UNSIGNED NOT NULL COMMENT '服务id',
  `version`         VARCHAR(32)  NOT NULL COMMENT '版本号',
  `config_snapshot` JSON         NULL DEFAULT NULL COMMENT '配置快照（流程+Agent绑定）',
  `changelog`       VARCHAR(512) NULL DEFAULT NULL COMMENT '变更说明',
  `published_by`    VARCHAR(64)  NULL DEFAULT NULL COMMENT '发布人',
  `published_at`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '发布时间',
  `create_time`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`         VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`         VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`         BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version_lock`    INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_version` (`service_id`, `version`, `deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='服务版本记录';

CREATE TABLE `pub_call_log` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `service_id`   BIGINT UNSIGNED NOT NULL COMMENT '服务id',
  `credential_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '凭证id',
  `trace_id`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '链路id',
  `api_path`     VARCHAR(255) NULL DEFAULT NULL COMMENT '调用路径',
  `latency_ms`   INT          NULL DEFAULT NULL COMMENT '耗时（毫秒）',
  `success`      TINYINT      NOT NULL DEFAULT 1 COMMENT '是否成功:1=是,0=否',
  `http_status`  INT          NULL DEFAULT NULL COMMENT 'HTTP状态码',
  `error_msg`    VARCHAR(512) NULL DEFAULT NULL COMMENT '错误信息',
  `call_time`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '调用时间',
  `create_time`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_call_service` (`service_id`, `call_time`),
  KEY `idx_call_trace` (`trace_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='服务调用日志（只增）';

-- ---------------------------------------------------------------------
-- 8. 看板与工单（hwc-workorder）
-- ---------------------------------------------------------------------

CREATE TABLE `wo_score_rule` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `scope_type`  VARCHAR(16)  NOT NULL COMMENT '范围:global/device_type/device',
  `scope_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '范围对象id,global时为0',
  `rule_config` JSON         NOT NULL COMMENT '评分规则:如{"deviationWeight":0.6,"anomalyPenalty":0.4,"maxDeduction":40}',
  `status`      TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1=启用,0=停用',
  `remark`      VARCHAR(512) NULL DEFAULT NULL COMMENT '备注',
  `create_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '创建人',
  `updater`     VARCHAR(64)  NULL DEFAULT NULL COMMENT '更新人',
  `deleted`     BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`     INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_score_rule_scope` (`scope_type`, `scope_id`, `deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='健康评分规则（REQ-M09-02，可配置；取值优先级:device>device_type>global）';

CREATE TABLE `wo_dashboard_metric` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `device_id`        BIGINT UNSIGNED NOT NULL COMMENT '设备id',
  `dataset_id`       BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '数据集id',
  `health_score`     DECIMAL(5,2)  NOT NULL DEFAULT 100 COMMENT '健康评分(0-100)',
  `status`           VARCHAR(16)   NOT NULL DEFAULT 'normal' COMMENT '状态:normal/warn/fault',
  `risk_hint`        VARCHAR(512)  NULL DEFAULT NULL COMMENT '未来故障风险提示',
  `metric_snapshot`  JSON          NULL DEFAULT NULL COMMENT '关键指标最新值快照:[{"metricId":1,"name":"温度","value":75.2,"status":"warn"}]',
  `anomaly_count`    INT           NOT NULL DEFAULT 0 COMMENT '异常数',
  `snapshot_time`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '快照时间',
  `create_time`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`          VARCHAR(64)   NULL DEFAULT NULL COMMENT '创建人',
  `updater`          VARCHAR(64)   NULL DEFAULT NULL COMMENT '更新人',
  `deleted`          BIGINT        NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`          INT           NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  KEY `idx_dash_device` (`device_id`, `snapshot_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='设备健康看板快照';

CREATE TABLE `wo_work_order` (
  `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_no`           VARCHAR(32)   NOT NULL COMMENT '工单号',
  `diagnosis_id`       BIGINT UNSIGNED NOT NULL COMMENT '来源诊断记录id',
  `device_id`          BIGINT UNSIGNED NOT NULL COMMENT '设备id',
  `fault_summary`      VARCHAR(512)  NULL DEFAULT NULL COMMENT '故障摘要',
  `root_cause`         TEXT          NULL DEFAULT NULL COMMENT '根因结论（来自根因诊断Agent）',
  `risk_level`         VARCHAR(16)   NOT NULL DEFAULT 'medium' COMMENT '风险等级:low/medium/high',
  `safety_requirements` TEXT         NULL DEFAULT NULL COMMENT '安全要求（来自安全规范Agent，含否决结论）',
  `repair_steps`       JSON          NULL DEFAULT NULL COMMENT '维修步骤:[{"step":1,"action":"...","tools":"...","duration":"30min"}]',
  `est_downtime_hours` DECIMAL(6,2)  NULL DEFAULT NULL COMMENT '预计停机时长（小时）',
  `downtime_cost`      DECIMAL(12,2) NULL DEFAULT NULL COMMENT '停机损失（元）',
  `parts_cost`         DECIMAL(12,2) NULL DEFAULT NULL COMMENT '备件成本合计（元）',
  `total_cost`         DECIMAL(12,2) NULL DEFAULT NULL COMMENT '总成本（元）',
  `file_url`           VARCHAR(512)  NULL DEFAULT NULL COMMENT '导出文档地址',
  `status`             VARCHAR(16)   NOT NULL DEFAULT 'generated' COMMENT '状态:generated/confirmed/exported',
  `generated_by`       VARCHAR(64)   NULL DEFAULT NULL COMMENT '生成人',
  `generated_time`     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '生成时间',
  `create_time`        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`            VARCHAR(64)   NULL DEFAULT NULL COMMENT '创建人',
  `updater`            VARCHAR(64)   NULL DEFAULT NULL COMMENT '更新人',
  `deleted`            BIGINT        NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`            INT           NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`, `deleted`),
  KEY `idx_order_diagnosis` (`diagnosis_id`),
  KEY `idx_order_device` (`device_id`),
  KEY `idx_order_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='维修工单（数据来自M02/M07，不二次录入）';

CREATE TABLE `wo_work_order_part` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_id`       BIGINT UNSIGNED NOT NULL COMMENT '工单id',
  `spare_part_id`  BIGINT UNSIGNED NOT NULL COMMENT '备件id（引用dev_spare_part）',
  `part_name`      VARCHAR(128)  NOT NULL COMMENT '备件名称（生成时快照，保证工单存档一致）',
  `part_model`     VARCHAR(64)   NULL DEFAULT NULL COMMENT '备件型号（快照）',
  `quantity`       INT           NOT NULL DEFAULT 1 COMMENT '数量',
  `unit_price`     DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '单价（生成时快照）',
  `stock_snapshot` INT           NULL DEFAULT NULL COMMENT '生成时库存快照',
  `remark`         VARCHAR(255)  NULL DEFAULT NULL COMMENT '备注',
  `create_time`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `creator`        VARCHAR(64)   NULL DEFAULT NULL COMMENT '创建人',
  `updater`        VARCHAR(64)   NULL DEFAULT NULL COMMENT '更新人',
  `deleted`        BIGINT        NOT NULL DEFAULT 0 COMMENT '逻辑删除:0=未删,删除时置为id',
  `version`        INT           NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  PRIMARY KEY (`id`),
  KEY `idx_order_part_order` (`order_id`),
  KEY `idx_order_part_spare` (`spare_part_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='工单备件明细（存档快照例外，见设计文档D6）';