# -*- coding: utf-8 -*-
"""GraphRAG 全量抽取：7 库串行（kb38 已完成），日志写 E:/tmp_graphrag_all.log"""
import subprocess
import sys
import time

SCRIPT = r"E:\JavaPro\IndusMind Studio_v1.0\test\scripts\graphrag_extract_direct.py"
LOG = r"E:\tmp_graphrag_all.log"
KBS = [32, 33, 34, 35, 36, 37]


def log(msg):
    line = time.strftime("%H:%M:%S") + " " + msg
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def main():
    for kb in KBS:
        log(f"=== kb{kb} start ===")
        t0 = time.time()
        proc = subprocess.run(
            [sys.executable, "-u", SCRIPT, str(kb)],
            cwd=r"E:\JavaPro\IndusMind Studio_v1.0\code\ai-service",
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        for line in (proc.stdout or "").splitlines():
            log(f"  {line}")
        if proc.stderr:
            for line in proc.stderr.splitlines()[-5:]:
                log(f"  STDERR {line}")
        log(f"=== kb{kb} done rc={proc.returncode} {round((time.time()-t0)/60,1)}min ===")
    log("ALL DONE")


if __name__ == "__main__":
    main()