# HWC AI Service

工业设备巡检与运维智能系统 —— AI 服务（Python / FastAPI）。

## 职责边界

- **RAG**：片段 Embedding / 向量+关键词混合检索 / 重排（分段归 Java，本服务不做分段）
- **GraphRAG**：文档间关系抽取（LangGraph 流水线）与关联检索，仅限文档实体
- **单 Agent 问答**（`/chat`）：RAG + GraphRAG 双知识源，带引用回答
- **多 Agent 协同诊断**（`/diagnosis/run`）：监测 → 根因诊断 → 并行[备件成本, 安全规范] → 仲裁/安全否决 → 工单

## 结构

```
app/
├── main.py          # FastAPI 入口、traceId 中间件
├── api/             # 路由层（rag/graph/chat/diagnosis）
├── rag/             # embedding、索引、混合检索、重排
├── graphrag/        # 关系抽取、关联图管理、关联检索
├── agents/
│   ├── single/      # 单 Agent 问答
│   └── multi/       # 多 Agent 编排（nodes/ 为各领域节点）
├── core/            # LLM/Embedding/Reranker 接入、配置
└── models/          # Pydantic 请求/响应模型
config/.env          # 环境配置（参照 .env.example）
sql/postgresql/      # pgvector 建表脚本
tests/               # pytest
```

## 启动

```bash
pip install -e ".[dev]"
cp config/.env.example config/.env
uvicorn app.main:app --port 8100
```

依赖中间件：PostgreSQL(pgvector)、Neo4j、Redis、（离线演示）Ollama。

## 模型 Provider

`LLM_PROVIDER` / `EMBEDDING_PROVIDER` 支持 `dashscope | ollama | openai`（OpenAI 兼容协议）。
离线演示默认：`qwen2.5:7b` + `bge-m3`（embedding_dim=1024）。