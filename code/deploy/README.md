# 部署与运行指南

## 1. 组件清单

| 组件 | 镜像 | 端口 | 用途 | 归属 |
|------|------|------|------|------|
| MySQL 8 | mysql:8.0 | 3306 | 业务库（43 表，自动初始化 V1–V3） | Java |
| Redis 7 | redis:7-alpine | 6379 | 会话/缓存 | Java |
| MinIO | minio/minio | 9000/9001 | 文档原文/工单 PDF | Java |
| PostgreSQL 16 + pgvector | pgvector/pgvector:pg16 | 5432 | 向量库（自动执行 V1） | Python |
| Neo4j 5 | neo4j:5-community | 7687/7474 | 文档关联图 | Python |

## 2. 启动基础设施

```bash
cd code/deploy
cp .env.example .env        # 按需修改密码/端口
docker compose up -d
```

- MySQL 首次启动自动执行 `../backend/sql/mysql/` 下 V1（建表）→ V2（初始化）→ V3（演示数据）。
- PostgreSQL 首次启动自动执行 `../ai-service/sql/postgresql/V1__init_schema.sql`（含 pgvector 扩展）。

## 3. 模型准备（演示离线方案，需求分析报告 B4）

```bash
# 安装 ollama 后预下载模型（需约 6GB 磁盘）
ollama pull qwen2.5:7b     # LLM
ollama pull bge-m3          # Embedding（1024 维）
```

备选：配置 `AI_PROVIDER=dashscope` 并填 `DASHSCOPE_API_KEY`（需外网）。

## 4. 应用启动顺序

| 顺序 | 应用 | 目录 | 默认端口 |
|------|------|------|----------|
| 1 | Python AI 服务 | `code/ai-service` | 8000 |
| 2 | 管理端后端 | `code/backend`（hwc-app-admin） | 8081 |
| 3 | 用户端后端 | `code/backend`（hwc-app-user） | 8080 |
| 4 | 前端 | `code/frontend` | 5173 / 5174 |

## 5. 默认账号

| 账号 | 密码 | 角色 | 端 |
|------|------|------|-----|
| admin | Admin@123 | 管理员 | 管理端 |
| config1 | Demo@123 | 配置员 | 管理端 |
| eng1 | Demo@123 | 维修工程师 | 用户端 |
| prod1 | Demo@123 | 生产管理人员 | 用户端 |
| review1 | Demo@123 | 评审用户（只读） | 双端 |

## 6. 生产部署（Nginx）

```
/            → user-web / admin-web 静态资源
/api/user/** → hwc-app-user.jar (8080)
/api/admin/**→ hwc-app-admin.jar (8081)
/ai/**       → ai-service (8000，仅内网)
```