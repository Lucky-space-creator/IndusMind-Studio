# -*- coding: utf-8 -*-
"""GraphRAG 逐库抽取（kb32 已完成）：串行调 extract，日志写 E:/tmp_graphrag.log"""
import time
import requests

BASE = "http://127.0.0.1:8090"
LOG = r"E:\tmp_graphrag.log"
KBS = [33, 34, 35, 36, 37, 38]


def log(msg):
    line = time.strftime("%H:%M:%S") + " " + msg
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def main():
    r = requests.post(BASE + "/api/admin/auth/login",
                      json={"username": "admin", "password": "Admin@123"}, timeout=30)
    s = requests.Session()
    s.headers["Authorization"] = "Bearer " + r.json()["data"]["token"]
    for kb in KBS:
        t0 = time.time()
        try:
            r = s.post(BASE + "/api/admin/docgraph/extract", json={"kbId": kb}, timeout=36000)
            d = r.json()
            log(f"kb{kb}: code={d.get('code')} edges={((d.get('data') or {}).get('addedEdges'))} {round(time.time()-t0)}s")
        except Exception as e:
            log(f"kb{kb}: ERR {type(e).__name__} {str(e)[:150]} {round(time.time()-t0)}s")
            s = requests.Session()
            rr = requests.post(BASE + "/api/admin/auth/login",
                               json={"username": "admin", "password": "Admin@123"}, timeout=30)
            s.headers["Authorization"] = "Bearer " + rr.json()["data"]["token"]
    log("ALL DONE")


if __name__ == "__main__":
    main()