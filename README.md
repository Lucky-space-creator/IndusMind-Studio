# IndusMind Studio

工业设备巡检与运维智能系统 —— 知识沉淀 → 智能问答 → 多 Agent 协同诊断 → 工单交付。

## 分支说明

| 分支 | 内容 |
|------|------|
| `main` | 全部代码 + 统一部署命令（本分支） |
| `backend` | Java 后端（Spring Boot 多模块，`code/backend`） |
| `frontend` | Web 前端双端（`code/frontend`） |
| `ai_service` | Python AI 服务（FastAPI + LangGraph，`code/ai-service`） |

## 架构总览

- **Java 后端**：Spring Boot 3.3.5 多模块（hwc-app-user:8080 / hwc-app-admin:8090），MySQL 8（43 表）
- **Python AI 服务**：FastAPI:8100，RAG / GraphRAG / 单 Agent 问答 / 多 Agent 协同诊断
- **前端双端**：用户端（React + shadcn/ui）、管理端（React + Ant Design 5），pnpm workspace
- **基础设施**：MySQL / Redis / MinIO / PostgreSQL(pgvector) / Neo4j，docker-compose 编排

## 统一部署命令

### 1. 基础设施（docker-compose 一键编排）

```bash
cd code/deploy
docker compose up -d
```

MySQL 首次启动自动执行 `code/backend/sql/mysql/` 下 V1-V3 脚本（建表 + 种子数据）。

### 2. Java 后端（双应用）

```bash
# 构建（全量打包）
node test/scripts/mvn_build.cjs

# 启动用户端（8080）
java -jar code/backend/hwc-app-user/target/hwc-app-user-1.0.0.jar

# 启动管理端（8090）
java -jar code/backend/hwc-app-admin/target/hwc-app-admin-1.0.0.jar
```

### 3. Python AI 服务（8100）

```bash
cd code/ai-service
pip install -e ".[dev]"
cp config/.env.example config/.env
uvicorn app.main:app --port 8100
```

依赖 PostgreSQL(pgvector)、Neo4j；LLM Provider 可配（ollama / dashscope / openai 兼容）。

### 4. 前端双端

```bash
cd code/frontend
pnpm install
pnpm build:user    # 用户端构建
pnpm build:admin   # 管理端构建
pnpm dev:user      # 或开发模式
pnpm dev:admin
```

### 5. 一键三端联测（可选验证）

```bash
node test/scripts/run_all.cjs
```

## 默认账号

| 端 | 账号 | 密码 |
|----|------|------|
| 管理端 | admin | Admin@123 |
| 用户端 | engineer1 | User@123（详见 `code/backend/sql/mysql/V3__demo_data.sql`） |

## 目录结构

```
code/
├── backend/      # Java 多模块后端（15 模块）
├── ai-service/   # Python AI 服务
├── frontend/     # 前端双端（apps/user-web + apps/admin-web + packages/*）
└── deploy/       # docker-compose 基础设施编排
docs/             # 需求/设计/规范文档
test/             # 测试用例、脚本与报告
```