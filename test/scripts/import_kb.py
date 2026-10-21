# -*- coding: utf-8 -*-
"""知识库批量导入：233 份（219 PDF + 14 中文卡）→ 7 职能库，走管理端上传 API（同前端按钮链路）。"""
import os
import re
import sys
import time
import requests

BASE = "http://127.0.0.1:8090"
ROOT = r"C:\Users\LENOVO\Downloads\知识库\知识库_整合"
PROGRESS = r"E:\tmp_kbimport_progress.log"
FAILED = r"E:\tmp_kbimport_failed.txt"

KB_PLAN = [
    ("运行管理知识库", r"01_原版手册\01_运行管理", []),
    ("机械检修知识库", r"01_原版手册\02_机械检修", ["MOTOR01", "MOTOR02", "MOTOR03", "MOTOR04"]),
    ("电气检测知识库", r"01_原版手册\03_电气检测", ["TEST01"]),
    ("自动控制知识库", r"01_原版手册\04_自动控制", ["DRIVE01", "DRIVE03", "DRIVE04"]),
    ("安全检修知识库", r"01_原版手册\05_安全检修", ["SAFE01"]),
    ("维修制度知识库", r"01_原版手册\06_维修制度", ["GEN01"]),
    ("故障诊断知识库", r"01_原版手册\07_故障诊断", ["DRIVE02", "TEST02", "TEST03", "TEST04"]),
]

CARD_DIR = r"02_中文知识卡"


def log(msg):
    line = time.strftime("%H:%M:%S") + " " + msg
    print(line, flush=True)
    with open(PROGRESS, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def login():
    r = requests.post(BASE + "/api/admin/auth/login",
                      json={"username": "admin", "password": "Admin@123"}, timeout=30)
    r.raise_for_status()
    return r.json()["data"]["token"]


def create_kb(session, name):
    r = session.get(BASE + "/api/admin/knowledge/kbs", params={"current": 1, "size": 100}, timeout=30)
    for kb in (r.json().get("data") or {}).get("records") or []:
        if kb.get("name") == name:
            return kb["id"]
    r = session.post(BASE + "/api/admin/knowledge/kbs",
                     json={"name": name, "devTypeId": 0, "vendor": "多厂商",
                           "faultLevel": "common", "description": f"{name}（知识库_整合导入 2026-10-20）"},
                     timeout=30)
    d = r.json()
    if d.get("code") != 0:
        raise RuntimeError(f"建库失败 {name}: {d}")
    return d["data"]["id"]


def clean_name(filename):
    stem = os.path.splitext(os.path.basename(filename))[0]
    stem = re.sub(r"_[0-9a-f]{10}$", "", stem)
    return stem[:200]


def collect():
    items = []
    for kb_name, rel_dir, cards in KB_PLAN:
        d = os.path.join(ROOT, rel_dir)
        for fn in sorted(os.listdir(d)):
            if fn.lower().endswith(".pdf"):
                items.append((kb_name, os.path.join(d, fn), "manual"))
        cd = os.path.join(ROOT, CARD_DIR)
        for fn in sorted(os.listdir(cd)):
            prefix = os.path.splitext(fn)[0].split("_")[0]
            if prefix in cards:
                items.append((kb_name, os.path.join(cd, fn), "card"))
    return items


def existing_docs(session):
    names = set()
    page = 1
    while True:
        r = session.get(BASE + "/api/admin/knowledge/documents",
                        params={"current": page, "size": 500}, timeout=30)
        d = r.json().get("data") or {}
        recs = d.get("records") or []
        if not recs:
            break
        names.update(x.get("docName") for x in recs)
        if len(names) >= (d.get("total") or 0):
            break
        page += 1
    return names


def upload(session, kb_id, path, doc_type, name):
    with open(path, "rb") as f:
        r = session.post(
            BASE + "/api/admin/knowledge/documents/upload",
            files={"file": (os.path.basename(path), f, "application/octet-stream")},
            data={"kbId": str(kb_id), "docName": name, "docType": doc_type},
            timeout=1800,
        )
    return r.json()


def main():
    s = requests.Session()
    token = login()
    s.headers["Authorization"] = "Bearer " + token
    kb_ids = {}
    for name, _, _ in KB_PLAN:
        kb_ids[name] = create_kb(s, name)
        log(f"KB 就绪: {name} id={kb_ids[name]}")

    items = collect()
    done = existing_docs(s)
    todo = [(k, p, t, clean_name(p)) for k, p, t in items if clean_name(p) not in done]
    log(f"总计 {len(items)} 份，已完成 {len(items) - len(todo)} 份，待导入 {len(todo)} 份")

    ok = fail = 0
    total_segs = 0
    t0 = time.time()
    for i, (kb_name, path, doc_type, name) in enumerate(todo, 1):
        try:
            d = upload(s, kb_ids[kb_name], path, doc_type, name)
            if d.get("code") == 0:
                segs = (d.get("data") or {}).get("segmentCount") or 0
                total_segs += segs
                ok += 1
                log(f"[{i}/{len(todo)}] OK {segs:>5}片 {kb_name} <- {name[:60]}")
            else:
                fail += 1
                msg = f"[{i}/{len(todo)}] FAIL {kb_name} <- {name[:60]} : code={d.get('code')} {d.get('message')}"
                log(msg)
                with open(FAILED, "a", encoding="utf-8") as f:
                    f.write(path + "\n")
        except Exception as e:
            fail += 1
            msg = f"[{i}/{len(todo)}] ERR {kb_name} <- {name[:60]} : {type(e).__name__} {str(e)[:120]}"
            log(msg)
            with open(FAILED, "a", encoding="utf-8") as f:
                f.write(path + "\n")

    log(f"完成：成功 {ok}，失败 {fail}，切片总数 {total_segs}，耗时 {round((time.time()-t0)/60,1)} 分钟")


if __name__ == "__main__":
    main()