# 后端开发 Skill 提取

> 来源：`C:\Users\LENOVO\OneDrive\桌面\Skills\后端`
> 覆盖技能：`agent-developcommon-skill`（后端通用，多语言）、`agent-java-skill`（Java 专精）
> 说明：以下为通用提取，未绑定具体技术栈；Java 部分作为专精补充。

## 一、技能清单

| 技能 | 定位 | 适用语言/框架 |
|------|------|----------------|
| agent-developcommon-skill | 后端开发通用规范 | Java、Python、PHP、JS/TS/Node、C++、C、Go |
| agent-java-skill | Java 后端专精规范 | Java 17/21、Spring Boot、MyBatis |

## 二、工作流程（边界与职责）

### 2.1 任务分类
- **简单任务**（单函数修改、加工具方法）：思考 → 可行性分析 → 修改代码。
- **复杂任务**（新增模块、重构、多文件联动）：分析 → 拆分计划 → 逐一可行性评估（任一步存疑即停止并询问澄清）→ 逐步执行并自检。
- **Bug 修复**：模拟首次排查（看日志、复现、确认影响范围、查最近变更）→ 提出假设并用日志/断点/测试验证 → 仅当假设验证通过才修改。

### 2.2 硬性边界（禁止跨越）
- 不确定的方案/结论，**不得**动手改代码。
- 无充分依据（日志、复现、代码分析）时，**严禁**推测性修改。
- 不引入依赖清单外的第三方库（任务明确要求且评估通过除外）。
- 不修改项目基础配置（`pom.xml`、`package.json`、`go.mod`、`requirements.txt` 等）与目录结构，除非任务要求。
- 禁止为“炫技”过度设计架构。

## 三、通用编码规范

### 3.1 代码风格
- 缩进 4 空格；行宽建议 ≤120 字符；花括号 K&R 风格。
- 所有外部类型/模块必须 `import` 后使用**简单类名**，**禁止全限定名**（如 `java.util.List`）。
- 导入按「标准库 → 第三方 → 项目内部」排序，删除未使用导入。

### 3.2 命名
- 类/类型：`PascalCase`；方法/函数：`camelCase`（Python/Go 用 `snake_case`）；常量：`UPPER_SNAKE_CASE`。
- 变量语义明确，禁止 `tmp`、`data`、`obj` 等模糊名；缩写仅限通用缩写（`id`、`url`）。

### 3.3 注释与文档
- 公共 API（类/接口/公开方法）必须写文档注释：功能、参数、返回值、异常。
- 复杂业务逻辑（算法、状态机、多线程/协程）前加意图注释；注释语言统一中文。
- 严禁保留被注释掉的代码；新建类/方法前先说明用途。

### 3.4 错误处理
- 禁止裸 `catch (Exception e)` / `except:`，必须捕获具体异常。
- 所有 catch 必须记录完整堆栈（如 `log.error("msg", e)`）；禁止静默吞异常。
- 所有外部输入（请求、文件、网络响应）必须做非空/格式/范围校验并友好报错。

### 3.5 可读性与维护性
- 单函数 ≤50 行、单文件 ≤400 行、嵌套 ≤4 层。
- DRY：通用逻辑封装为工具函数/类；优先复用标准库与成熟依赖。

### 3.6 配置管理
- 所有配置（连接串、密钥、环境参数）集中在配置类/外部配置文件，禁止硬编码。
- 支持多环境（`application-{env}.yml`、`.env` 等）。

### 3.7 测试要求
- 关键业务逻辑必须提供单元测试，覆盖正常路径与边界。
- 命名：`test<功能>_<场景>` / `Test<Function>_<Scenario>`。

## 四、各语言要点（通用技能）

- **Java（17/21）**：鼓励 Records、Switch 表达式、文本块、模式匹配、虚拟线程；避免 `Date`/`Calendar`，用 `java.time`；集合优先 Spring Boot / MyBatis / Hutool；日志 SLF4J + Logback。
- **Python（3.10+）**：PEP8、类型注解、`asyncio`、`dataclass`、模式匹配；FastAPI/Django/Flask；logging 模块。
- **PHP（8.0+）**：严格类型 `declare(strict_types=1)`、Attributes、Enums；Laravel/Symfony；Composer；Monolog。
- **JS/TS/Node（ES2022+/TS5+）**：ES Module、`async/await`、可选链、空值合并；Express/NestJS/Koa；pino/winston。
- **C++（17/20）**：智能指针、范围 for、lambda、结构化绑定；CMake；spdlog。
- **C（11/17）**：标准库优先，注意 `malloc/free` 防泄漏；Makefile/CMake；syslog。
- **Go（1.20+）**：goroutine/channel、`context` 超时取消、`error` 处理避免 panic；net/http 或 Gin/Echo；Go Modules；slog。

> 通用约束：**禁止**用 `Map.of()`/`List.of()` 等不可变工厂处理业务数据（不支持 null，易 NPE），业务数据用可变集合。

## 五、Java 专精补充（agent-java-skill）

- **命名后缀**：类必须以类型后缀结尾（`Controller`、`Service`、`Repository`、`Entity`、`Config`、`Util`）。
- **规模上限**：单函数 ≤100 行、单文件 ≤800 行、嵌套 ≤8 层。
- **分包规范（强制水平分包）**：按功能角色分包 `controller` / `service` / `mapper` / `model` / `config` / `util` / `handler`；**禁止**按业务领域垂直建顶层包，**禁止**将不同角色类混放同包。
- **注解驱动**：容器 Bean 必须类路径注解声明，禁止 XML 定义 Bean/AOP/事务。
- **依赖注入**：优先构造器注入（`private final` + Lombok `@RequiredArgsConstructor`，单构造器免 `@Autowired`）；字段注入仅限简单场景。
- **配置绑定**：外部化配置用 `@ConfigurationProperties` + `@EnableConfigurationProperties` 集中到 `*Properties` 类；禁止业务类散落 `@Value`。
- **WebSocket**：无请求-响应机制，必须检查每条消息发送路径，补充成功/失败日志。
- **风格冲突**：以项目现有风格为准，本规范作为补充。

## 六、输出格式要求

- 直接输出代码，不加“这是生成的代码”之类前后缀。
- 修改原有代码时提供**完整文件内容**（或 diff）。
- 代码块顶部标注语言；多文件按路径依次列出（如 `src/main/java/com/example/UserService.java`）。
- 附修改依据（日志错误、复现步骤、验证方法）。

## 七、设计原则（防过度设计）

- 不重新发明轮子，优先成熟框架与标准库。
- 最少代码原则，满足需求即可，避免冗余抽象。
- 按实际复杂度选设计模式，不“为模式而模式”。
- 善用注解/装饰器减少样板代码（`@Data`、`@Builder`、`@Slf4j`、`@Service` 等）。

---

**执行任何修改前，若存在歧义或不确定之处，先提问澄清，而非擅自决定。**