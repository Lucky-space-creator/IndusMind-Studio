# -*- coding: utf-8 -*-
"""GraphRAG 直接编排抽取：调 ai-service /graph/extract 并写 MySQL 图节点/边（等价 Java extractAutoEdges 链路）。
用法: python graphrag_extract_direct.py <kbId>"""
import json
import sys
import time

import pymysql
import requests

AI_URL = "http://127.0.0.1:8100/graph/extract"
SEG_LIMIT = 60
DB = dict(host="localhost", user="root", password="root", database="hwc", charset="utf8mb4")


def sanitize(value):
    if value is None:
        return None
    out = []
    for ch in value:
        code = ord(ch)
        if 0xD800 <= code <= 0xDBFF:
            out.append(ch)
        elif 0xDC00 <= code <= 0xDFFF:
            continue
        elif code >= 0x20 or ch in "\t\n\r":
            out.append(ch)
    return "".join(out)


def title_of(chapter, content, seq_no):
    if chapter and chapter.strip():
        return sanitize(chapter)[:255]
    if content is None:
        return "片段-" + str(seq_no)
    cleaned = sanitize(content)
    return cleaned[:50]


def ensure_node(cur, kb_id, node_type, ref_id, title, extra):
    cur.execute("SELECT id FROM kb_graph_node WHERE node_type=%s AND ref_id=%s LIMIT 1", (node_type, ref_id))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        "INSERT INTO kb_graph_node(kb_id,node_type,ref_id,title,extra,deleted,version) VALUES(%s,%s,%s,%s,%s,0,0)",
        (kb_id, node_type, ref_id, title, extra),
    )
    return cur.lastrowid


def main():
    kb_id = int(sys.argv[1])
    conn = pymysql.connect(**DB)
    cur = conn.cursor()
    cur.execute("SELECT id, doc_name FROM kb_document WHERE kb_id=%s AND deleted=0 ORDER BY id", (kb_id,))
    docs = cur.fetchall()
    print(f"kb{kb_id}: {len(docs)} docs", flush=True)
    total_edges = 0
    t0 = time.time()
    for i, (doc_id, doc_name) in enumerate(docs, 1):
        ensure_node(cur, kb_id, "document", doc_id, sanitize(doc_name)[:255], None)
        cur.execute(
            "SELECT id,doc_id,chapter,content,seq_no FROM kb_segment WHERE doc_id=%s ORDER BY seq_no LIMIT %s",
            (doc_id, SEG_LIMIT),
        )
        segs = cur.fetchall()
        if len(segs) < 2:
            print(f"  [{i}/{len(docs)}] skip doc{doc_id} (segs={len(segs)})", flush=True)
            continue
        node_map = {}
        payload = []
        for sid, did, chapter, content, seq_no in segs:
            extra = json.dumps({"chapter": sanitize(chapter)}, ensure_ascii=False) if chapter else None
            node_map[sid] = ensure_node(cur, kb_id, "segment", sid, title_of(chapter, content, seq_no), extra)
            payload.append({"segmentId": sid, "docId": did, "chapter": chapter or "", "content": content or ""})
        conn.commit()
        try:
            r = requests.post(AI_URL, json={"kbId": kb_id, "segments": payload}, timeout=1800)
            edges = (r.json() or {}).get("data") or []
        except Exception as exc:
            print(f"  [{i}/{len(docs)}] ERR doc{doc_id}: {type(exc).__name__} {str(exc)[:120]}", flush=True)
            continue
        added = 0
        for e in edges:
            f_node = node_map.get(e.get("fromRefId"))
            t_node = node_map.get(e.get("toRefId"))
            if not f_node or not t_node or f_node == t_node:
                continue
            rel = e.get("relationType")
            cur.execute(
                "SELECT 1 FROM kb_graph_edge WHERE from_node_id=%s AND to_node_id=%s AND relation_type=%s LIMIT 1",
                (f_node, t_node, rel),
            )
            if cur.fetchone():
                continue
            cur.execute(
                "INSERT INTO kb_graph_edge(from_node_id,to_node_id,relation_type,source,confidence,status,deleted,version)"
                " VALUES(%s,%s,%s,'auto',%s,'pending',0,0)",
                (f_node, t_node, rel, e.get("confidence")),
            )
            added += 1
        conn.commit()
        total_edges += added
        print(f"  [{i}/{len(docs)}] doc{doc_id} segs={len(segs)} edges+{added} total={total_edges} {round(time.time()-t0)}s", flush=True)
    print(f"kb{kb_id} DONE edges={total_edges} elapsed={round((time.time()-t0)/60,1)}min", flush=True)
    conn.close()


if __name__ == "__main__":
    main()