# 前端开发 Skill 提取

> 来源：`C:\Users\LENOVO\OneDrive\桌面\Skills\前端`
> 覆盖技能：`ui设计方案`（ui-ux-pro-max）、`动态组件库`（react-bits）、`压缩前端代码`（karpathy-guidelines）、`反AI设计`（impeccable）
> 说明：以下为通用提取，未绑定具体技术栈。

## 一、技能清单

| 技能 | 定位 | 核心内容 |
|------|------|----------|
| 压缩前端代码 / karpathy-guidelines | 编码行为准则 | 减少 LLM 常见编码错误 |
| ui设计方案 / ui-ux-pro-max | UI/UX 设计智能库 | 84 风格、192 配色、74 字体配对、98 UX 准则、25 图表类型、22 技术栈 |
| 动态组件库 / react-bits | React 动态组件库 | 165+ 动画组件（文字/动效/交互/背景） |
| 反AI设计 / impeccable | 反 AI 味设计总监 | 23 命令 + 59 条确定性检测规则 |

## 二、编码行为准则（karpathy-guidelines）——最高优先

1. **先想后写**：明确陈述假设；不确定就提问；有多种解释时全部列出而非私自选择；有更简单方案要指出。
2. **简洁优先**：只写解决问题的最少代码；不加未要求的功能、抽象、可配置性；不为不可能场景写错误处理；能 200 行写完的若 50 行可完成就重写。
3. **外科手术式修改**：只动必须动的地方；不顺手“改进”相邻代码/注释/格式；不重构没坏的东西；匹配现有风格；发现无关死代码只提示不删除；只清理**自己改动**造成的孤立引用。
4. **目标驱动执行**：把任务转成可验证目标（“加校验”→“先写非法输入测试再让其通过”）；多步任务给出 `步骤 → 验证` 计划。

> 检验标准：每一行改动都能直接追溯到用户请求。

## 三、UI/UX 设计规范（ui-ux-pro-max）

### 3.1 规则优先级（1→10）
| 优先级 | 类别 | 影响 | 关键检查 | 反模式 |
|--------|------|------|----------|--------|
| 1 | 可访问性 | 关键 | 对比度 4.5:1、Alt、键盘导航、aria-label | 移除焦点环、纯图标按钮无标签 |
| 2 | 触控与交互 | 关键 | 最小 44×44px、≥8px 间距、加载反馈 | 仅依赖 hover、状态瞬时切换 |
| 3 | 性能 | 高 | WebP/AVIF、懒加载、预留空间（CLS<0.1） | 布局抖动、CLS |
| 4 | 风格选择 | 高 | 契合产品类型、一致性、SVG 图标 | 混用扁平与拟物、emoji 当图标 |
| 5 | 布局与响应式 | 高 | 移动优先断点、viewport、无横向滚动 | 横向滚动、固定 px 容器、禁用缩放 |
| 6 | 排版与色彩 | 中 | 基准 16px、行高 1.5、语义色 token | 正文 <12px、灰底灰字、组件内裸 hex |
| 7 | 动画 | 中 | 时长 150–300ms、动效表达含义、空间连续 | 纯装饰动画、动 width/height、无降级 |
| 8 | 表单与反馈 | 中 | 可见 label、就近报错、辅助文本 | 只用 placeholder 当 label、错误只在顶部 |
| 9 | 导航模式 | 高 | 可预测返回、底部导航 ≤5、深链 | 导航过载、返回异常、无深链 |
| 10 | 图表与数据 | 低 | 图例、Tooltip、可访问配色 | 仅靠颜色传达含义 |

### 3.2 工作流
1. **分析需求**：产品类型、受众/场景、风格关键词、**技术栈**（从 `package.json`/`pubspec.yaml`/`composer.json` 等探测，禁止臆断）。
2. **生成设计系统**（新页面/新项目必需）：先跑 `--design-system` 拿到风格、配色、字体、效果与反模式。
3. **持久化**：`--persist --output-dir <项目根>` 生成 `design-system/<slug>/MASTER.md`（全局真源）+ `pages/`（页级覆盖，覆盖优于 Master）。
4. **按需细化**：`--domain product|style|color|typography|chart|ux|landing|icons|gsap|react|web`。
5. **栈规范**：`--stack <stack>`（react/nextjs/vue/nuxt/svelte/astro/shadcn/html-tailwind/threejs 等）。
- **0 结果处理**：不得编造；换关键词重试一次，仍无则回退内置默认值并**明确告知用户**。

## 四、React 动态组件库（react-bits）

- 覆盖四大类：**文字动画**（32）、**动效 Animations**（36）、**交互组件 Components**（44）、**动态背景 Backgrounds**（53）。
- **核心原则**：先查组件目录再动手，优先复用；默认 JS+CSS 变体，TS 项目用 TS 变体，Tailwind 项目用 Tailwind 变体；每个组件**单文件自包含**、props 驱动。
- **性能与可访问性**：`requestAnimationFrame` 清理、`IntersectionObserver` 触发、`prefers-reduced-motion` 降级、canvas 按 devicePixelRatio 适配。
- **技术栈**：`motion`(framer-motion)、`gsap`(+ScrollTrigger/SplitText)、`three`/`ogl`、原生 canvas，不混用多余依赖。
- **规范**：组件默认导出、文件与组件同名（CSS 同名同目录）；props 命名 `text`/`className`/`...rest`/布尔开关/数值动画参数；`will-change` 仅动画期间开启。

## 五、反 AI 设计（impeccable）——设计质量

### 5.1 理念
以**获奖设计总监**标准要求产出：生产级代码、峰值创意、清晰观点、对用户需求深刻理解。**做满、不偷懒、不折中**；在受限轮次内验证（桌面+移动同位批检，一次批量修完，最多再确认一轮即停）。

### 5.2 四种访客模式
- **Persuade**（说服）：营销/落地页/定价——赢得注意力与行动。
- **Operate**（操作）：App/仪表盘/工具——可扫读、一致、符合原生预期。
- **Read**（阅读）：文档/文章/帮助——为理解而结构化。
- **Experience**（体验）：作品集/画廊——让作品主导，界面退让。

### 5.3 关键语义
- **Brief 优先**：尊重已定基调/年代/材质/字体/配色，不因“饱和警告”擅自改向。
- **精修保留，重设计替换**：精修保持既有身份；重设计保留产品事实但把旧视觉当反参考，绝不折中打磨旧皮。
- **视觉权威是证据而非文件名**：缺 `DESIGN.md` 不等于绿地项目。

### 5.4 典型反模式（AI 味）
Inter 一把梭、紫→蓝渐变、卡片套卡片、彩色底上的灰字、每个标题上都压圆角方块图标。需靠 59 条确定性检测规则 + 人工批判规避。

### 5.5 常用命令
`init / document / extract / shape`（构建）、`critique / audit`（评估）、`polish / bolder / quieter / distill / harden / onboard`（精修）、`animate / colorize / typeset / layout / delight / overdrive`（增强）、`clarify / adapt / optimize`（修复）、`live`（浏览器实时迭代）。

---

**核心：通用编码准则打底 → UI/UX 优先级规范保证可用性 → 组件库复用提效 → 反 AI 设计保证不落俗套。**