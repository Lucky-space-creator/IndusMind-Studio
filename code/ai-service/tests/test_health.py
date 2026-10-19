from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["service"] == "hwc-ai-service"


def test_trace_id_echo():
    resp = client.get("/health", headers={"X-Trace-Id": "trace-abc-123"})
    assert resp.headers.get("X-Trace-Id") == "trace-abc-123"