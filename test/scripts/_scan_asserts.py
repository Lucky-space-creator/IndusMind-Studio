import json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
data = json.load(open("test/scripts/testcases/10_admin_api_cases.json", encoding="utf-8"))
for c in data["cases"]:
    if c["id"].startswith("A-GR") or c["id"] in ("A-KB-20", "A-KB-24"):
        print(json.dumps({k: c.get(k) for k in ("id", "name", "method", "path", "query", "json")}, ensure_ascii=False))
print("DONE")