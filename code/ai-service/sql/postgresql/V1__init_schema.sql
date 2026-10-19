-- =====================================================================
-- V1__init_schema.sql  向量库（PostgreSQL 15+ / pgvector）建表脚本
-- 出品：数据层智能体（依据 docs/设计文档/数据库表设计-DDL.md §7；
--       docs/设计文档/Python服务详细设计.md §4/§9）
-- 归属：Python AI 服务（ai-service）专用；Java 不直连本库
-- 规范：数据由 /rag/index 索引任务从 Java(MySQL kb_segment) 同步生成，
--       禁止手工 INSERT 业务数据；MySQL 元数据为权威，本库可随时重建
-- 说明：图库 Neo4j 不在本脚本范围（独立部署，由 Python 侧管理）
-- =====================================================================
SET client_encoding = 'UTF8';

-- pgvector 扩展（需数据库预先安装 pgvector 包）
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------
-- 知识片段向量表（对应 MySQL kb_segment / kb_document 的检索投影）
-- 混合检索：embedding（向量相似度） + keywords_tsv（关键词召回）→ 应用层融合重排
-- ---------------------------------------------------------------------
CREATE TABLE kb_segment_vector (
    id            BIGSERIAL PRIMARY KEY,
    segment_id    BIGINT       NOT NULL,                          -- 回溯 MySQL kb_segment.id（应用层保证引用，不建物理外键）
    kb_id         BIGINT       NOT NULL,                          -- 知识库id（检索范围过滤）
    doc_id        BIGINT       NOT NULL,                          -- 文档id（文档维度过滤/重建）
    doc_status    VARCHAR(16)  NOT NULL DEFAULT 'enabled',        -- 冗余自 MySQL kb_document.status；disabled 片段不参与检索（文档启停时由 Java 调 /rag 接口同步）
    content       TEXT         NOT NULL,                          -- 片段内容（命中后直接返回，避免回查 MySQL）
    chapter       VARCHAR(255) NULL,                              -- 来源章节
    page_no       INT          NULL,                              -- 来源页码
    keywords      TEXT         NULL,                              -- 关键词（空格分隔，应用层分词后写入）
    keywords_tsv  TSVECTOR     NULL,                              -- 关键词全文向量（应用写入 to_tsvector('simple', keywords)）
    embedding     VECTOR(1024) NOT NULL,                          -- 嵌入向量（维度随嵌入模型调整：bge-m3=1024；换模型须重建全量索引）
    embed_model   VARCHAR(64)  NOT NULL,                          -- 嵌入模型标识（混用模型检索时区分）
    index_version VARCHAR(32)  NULL,                              -- 索引版本（对应 MySQL kb_index_task.index_version）
    create_time   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    update_time   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uk_segvec_segment UNIQUE (segment_id)
);

COMMENT ON TABLE  kb_segment_vector IS '知识片段向量（Python ai-service 检索专用；数据由索引任务同步，禁手工写入）';
COMMENT ON COLUMN kb_segment_vector.segment_id   IS '回溯 MySQL kb_segment.id';
COMMENT ON COLUMN kb_segment_vector.doc_status   IS '冗余文档状态；检索强制过滤 doc_status=enabled（停用文档不参与检索，REQ-M03-02）';
COMMENT ON COLUMN kb_segment_vector.embedding    IS '嵌入向量 vector(1024)，bge-m3；换模型需全量重建';
COMMENT ON COLUMN kb_segment_vector.keywords_tsv IS '关键词 tsvector，应用层分词后写入，simple 配置';

-- 向量相似度索引（HNSW，余弦距离）
CREATE INDEX idx_segvec_embedding ON kb_segment_vector USING hnsw (embedding vector_cosine_ops);
-- 关键词全文索引（GIN）
CREATE INDEX idx_segvec_keywords  ON kb_segment_vector USING gin (keywords_tsv);
-- 过滤维度索引
CREATE INDEX idx_segvec_kb        ON kb_segment_vector (kb_id);
CREATE INDEX idx_segvec_doc       ON kb_segment_vector (doc_id);

-- ---------------------------------------------------------------------
-- 备注（不在本脚本建表）：
-- 1. LangGraph 多 Agent 协同的 checkpoint 持久化如启用 PostgresSaver，
--    其 checkpoints 表由 LangGraph 运行时自动创建，不纳入本版本管理。
-- 2. 嵌入缓存优先用 Redis/进程内 LRU（见 Python 服务详细设计 §11），不在本库建缓存表。
-- 3. 检索过滤组合：kb_id + doc_status='enabled'；文档启停由 Java 触发同步更新 doc_status。
-- 4. 重建策略：删除某 kb_id/doc_id 下全部向量后重写（MySQL 元数据为权威，见数据模型设计 §7）。