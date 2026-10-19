-- =====================================================================
-- V3__demo_data.sql  演示数据：演示账号 / 设备主数据 / 阈值 / 告警规则 /
--                     备件 / 停机损失 / 知识库与文档元数据 / 数据范围示例
-- 依据：docs/设计文档/数据库表设计-DDL.md §6
-- 演示账号（密码统一 Demo@123，BCrypt）：
--   admin2/config1/eng1/prod1/review1 —— 分别对应五类内置角色（admin2 仅演示，正式环境用 admin）
-- =====================================================================
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. 演示账号（密码统一 Demo@123）
-- ---------------------------------------------------------------------
INSERT INTO `sys_user` (`id`, `username`, `password`, `nickname`, `status`, `remark`, `creator`) VALUES
(2, 'config1', '$2a$10$NPbxYthX29A4Tkm5pVVcOuwI3ZRU6cm7TveEZfseo0TyAL.sPKzJS', '演示-配置员',   1, '演示账号，密码 Demo@123', 'system'),
(3, 'eng1',    '$2a$10$NPbxYthX29A4Tkm5pVVcOuwI3ZRU6cm7TveEZfseo0TyAL.sPKzJS', '演示-维修工程师', 1, '演示账号，密码 Demo@123', 'system'),
(4, 'prod1',   '$2a$10$NPbxYthX29A4Tkm5pVVcOuwI3ZRU6cm7TveEZfseo0TyAL.sPKzJS', '演示-生产管理人员', 1, '演示账号，密码 Demo@123', 'system'),
(5, 'review1', '$2a$10$NPbxYthX29A4Tkm5pVVcOuwI3ZRU6cm7TveEZfseo0TyAL.sPKzJS', '演示-评审用户', 1, '演示账号，密码 Demo@123', 'system');
INSERT INTO `sys_user_role` (`user_id`, `role_id`, `creator`) VALUES
(2, 2, 'system'), (3, 3, 'system'), (4, 4, 'system'), (5, 5, 'system');
-- 生产管理人员数据范围示例：仅可见产线A相关（DEVICE 范围示意，P1 生效）
INSERT INTO `sys_role_data_scope` (`role_id`, `scope_type`, `scope_id`, `remark`, `creator`) VALUES
(4, 'DEVICE_TYPE', 1, '生产管理人员示例：仅看数控机床类设备', 'system');

-- ---------------------------------------------------------------------
-- 2. 设备类型 / 型号 / 台账
-- ---------------------------------------------------------------------
INSERT INTO `dev_type` (`id`, `code`, `name`, `vendor`, `description`, `creator`) VALUES
(1, 'CNC',   '数控机床',     '华中数控', '立式加工中心类数控机床', 'system'),
(2, 'MOTOR', '三相异步电机', '湘电集团', '车间驱动电机', 'system');
INSERT INTO `dev_model` (`id`, `type_id`, `code`, `name`, `spec`, `creator`) VALUES
(1, 1, 'CNC-V500', 'V500 立式加工中心', '工作台500mm，主轴功率7.5kW', 'system'),
(2, 1, 'CNC-V800', 'V800 立式加工中心', '工作台800mm，主轴功率15kW', 'system'),
(3, 2, 'MOTOR-Y225', 'Y225 鼠笼式电机', '225机座号，37kW，2极', 'system');
INSERT INTO `dev_info` (`id`, `code`, `name`, `type_id`, `model_id`, `line_name`, `location`, `status`, `run_date`, `creator`) VALUES
(1, 'M01-CNC-001', '一号加工中心', 1, 1, '产线A', '车间一层东区', 'running',     '2021-06-15', 'system'),
(2, 'M02-CNC-002', '二号加工中心', 1, 2, '产线A', '车间一层中区', 'running',     '2019-03-20', 'system'),
(3, 'M03-MOT-001', '循环泵电机',   2, 3, '产线B', '泵房二层',     'maintenance', '2020-11-08', 'system');

-- ---------------------------------------------------------------------
-- 3. 监测指标与阈值（三级嵌套区间 normal⊆warn⊆fault）
-- ---------------------------------------------------------------------
INSERT INTO `dev_metric` (`id`, `type_id`, `code`, `name`, `unit`, `sample_interval`, `creator`) VALUES
(1, 1, 'spindle_temp',  '主轴温度',   '℃',   60, 'system'),
(2, 1, 'vibration',     '振动速度',   'mm/s', 60, 'system'),
(3, 1, 'spindle_speed', '主轴转速',   'rpm',  10, 'system'),
(4, 1, 'spindle_current','主轴电流',  'A',    60, 'system'),
(5, 2, 'winding_temp',  '绕组温度',   '℃',   60, 'system'),
(6, 2, 'motor_current', '电机电流',   'A',    60, 'system'),
(7, 2, 'insulation_res','绝缘电阻',   'MΩ', 3600, 'system');
INSERT INTO `dev_metric_threshold` (`metric_id`, `normal_min`, `normal_max`, `warn_min`, `warn_max`, `fault_min`, `fault_max`, `remark`, `creator`) VALUES
(1,  20.0000,   70.0000,   10.0000,   80.0000,    0.0000,   90.0000, '主轴温度：70以上预警，90以上故障', 'system'),
(2,   0.0000,    4.5000,    0.0000,    7.1000,    0.0000,   11.0000, '振动（ISO 10816 类比）：4.5以上预警，7.1以上故障', 'system'),
(3, 100.0000, 8000.0000,   50.0000, 8200.0000,    0.0000, 8500.0000, '额定转速区间', 'system'),
(4,   5.0000,   30.0000,    3.0000,   35.0000,    0.0000,   40.0000, '主轴额定电流30A', 'system'),
(5,  20.0000,   95.0000,   10.0000,  105.0000,    0.0000,  115.0000, 'B级绝缘绕组温升限值', 'system'),
(6,  10.0000,   68.0000,    8.0000,   75.0000,    5.0000,   82.0000, '37kW 电机额定电流约68A', 'system'),
(7,   5.0000, 10000.0000,   2.0000, 10000.0000,   1.0000, 10000.0000, '绝缘电阻下限：5MΩ预警，2MΩ故障（越大越好）', 'system');

-- ---------------------------------------------------------------------
-- 4. 告警规则
-- ---------------------------------------------------------------------
INSERT INTO `dev_alarm_rule` (`metric_id`, `level`, `condition_type`, `duration_count`, `threshold_expr`, `enabled`, `description`, `creator`) VALUES
(1, 'warn',  'threshold_breach', NULL, NULL, 1, '主轴温度超出正常区间即预警', 'system'),
(1, 'fault', 'continuous_over',  3,    NULL, 1, '主轴温度持续3个采样点超故障边界判故障', 'system'),
(2, 'warn',  'threshold_breach', NULL, NULL, 1, '振动超出正常区间即预警', 'system'),
(2, 'fault', 'threshold_breach', NULL, NULL, 1, '振动超故障边界即故障', 'system'),
(4, 'warn',  'continuous_over',  5,    '{"window":5}', 1, '主轴电流连续5点超预警区间', 'system'),
(5, 'warn',  'threshold_breach', NULL, NULL, 1, '绕组温度超出正常区间即预警', 'system'),
(7, 'fault', 'threshold_breach', NULL, NULL, 1, '绝缘电阻低于故障下限即故障', 'system');

-- ---------------------------------------------------------------------
-- 5. 备件与适用设备类型
-- ---------------------------------------------------------------------
INSERT INTO `dev_spare_part` (`id`, `code`, `name`, `model`, `unit`, `stock`, `safety_stock`, `unit_price`, `status`, `creator`) VALUES
(1, 'SP-001', '主轴角接触球轴承', '7014C/DB', '套',  4, 2, 1280.00, 1, 'system'),
(2, 'SP-002', '主轴润滑脂',       'KLÜBER ISOFLEX NBU 15', 'kg', 12, 5,  380.00, 1, 'system'),
(3, 'SP-003', 'V型传动皮带',      'SPB-2360', '根',  6, 3,  165.00, 1, 'system'),
(4, 'SP-004', '绕组绝缘套管',     '2740酚醛纸管', '个', 30, 10, 22.50, 1, 'system'),
(5, 'SP-005', '电机密封圈',       'Y225-标准', '套',  8, 4,   58.00, 1, 'system');
INSERT INTO `dev_spare_part_type` (`spare_part_id`, `dev_type_id`, `creator`) VALUES
(1, 1, 'system'), (2, 1, 'system'), (3, 1, 'system'),
(4, 2, 'system'), (5, 2, 'system');

-- ---------------------------------------------------------------------
-- 6. 停机损失标准（取值优先级 device > line > global）
-- ---------------------------------------------------------------------
INSERT INTO `dev_downtime_cost` (`scope_type`, `device_id`, `line_name`, `cost_per_hour`, `remark`, `creator`) VALUES
('global', 0, NULL,      2000.00, '全局默认每小时停机损失', 'system'),
('line',   0, '产线A',   5000.00, '产线A每小时停机损失', 'system'),
('device', 2, NULL,      8000.00, '二号加工中心（大件产线关键设备）', 'system');

-- ---------------------------------------------------------------------
-- 7. 知识库与文档元数据（文件本体由系统上传后回填 file_url）
-- ---------------------------------------------------------------------
INSERT INTO `kb_knowledge_base` (`id`, `name`, `dev_type_id`, `vendor`, `fault_level`, `doc_count`, `index_status`, `description`, `creator`) VALUES
(1, '数控机床维修知识库', 1, '华中数控', 'common', 3, 'idle', '数控机床类设备维修手册、操作规程与历史维修记录', 'system');
INSERT INTO `kb_document` (`id`, `kb_id`, `doc_name`, `doc_type`, `version`, `status`, `file_url`, `file_type`, `segment_count`, `remark`, `creator`) VALUES
(1, 1, 'V系列立式加工中心维修手册', 'manual',   'V2.1',    'enabled', NULL, 'pdf', 0, '含主轴、润滑、电气章节', 'system'),
(2, 1, '主轴维护操作规程',           'procedure','V1.0',    'enabled', NULL, 'docx', 0, '日常维护与安全操作要求', 'system'),
(3, 1, '2024年度历史维修记录汇编',   'history',  'V1.0',    'disabled', NULL, 'pdf', 0, '历史维修案例（停用状态演示：不参与检索）', 'system');