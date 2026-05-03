"""HTTP smoke tests via TestClient. Every endpoint must respond; the
shape checks above already validate payloads.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_act2_endpoints():
    for path in ["/api/act2/oltp/read", "/api/act2/olap/on-oltp", "/api/act2/olap/on-gold"]:
        r = client.get(path)
        assert r.status_code == 200, path
    r = client.post("/api/act2/oltp/insert")
    assert r.status_code == 200


def test_act3_cube():
    r = client.get("/api/act3/meta")
    assert r.status_code == 200
    meta = r.json()
    assert "dimensions" in meta and "measures" in meta

    r2 = client.post("/api/act3/query", json={"group_by": ["country"], "measure": "amount"})
    assert r2.status_code == 200
    body = r2.json()
    assert body["rows"]


def test_act4_shapes():
    for s in ["star", "snowflake", "galaxy"]:
        r = client.get(f"/api/act4/{s}")
        assert r.status_code == 200
        j = r.json()
        assert "facts" in j and "dims" in j


def test_act5_stream_tick_adds_rows():
    before = client.get("/api/act5/counts").json()["bronze"]
    r = client.post("/api/act5/stream/tick?n=3")
    assert r.status_code == 200
    assert r.json()["injected"] == 3
    after = client.get("/api/act5/counts").json()["bronze"]
    assert after == before + 3


def test_act5_stream_tick_rejects_out_of_range():
    assert client.post("/api/act5/stream/tick?n=0").status_code == 400
    assert client.post("/api/act5/stream/tick?n=999").status_code == 400


def test_act5_layer_counts_and_inject():
    r = client.get("/api/act5/counts")
    assert r.status_code == 200
    before = r.json()
    assert before["bronze"] > 0

    r2 = client.post("/api/act5/inject/drift")
    assert r2.status_code == 200
    assert r2.json()["injected"] > 0

    r3 = client.post("/api/act5/replay")
    assert r3.status_code == 200

    r4 = client.get("/api/act5/dq")
    assert r4.status_code == 200
    assert len(r4.json()["events"]) > 0


def test_act5_sample_each_layer():
    for L in ["bronze", "silver", "gold_fact", "gold_dim_customer", "gold_dim_product"]:
        r = client.get(f"/api/act5/sample/{L}?limit=5")
        assert r.status_code == 200, L


def test_act6_all_techniques():
    assert client.get("/api/act6/clustering?k=3").status_code == 200
    assert client.get("/api/act6/classification?threshold=30").status_code == 200
    assert client.get("/api/act6/regression?horizon=10").status_code == 200
    assert client.get("/api/act6/association?min_support=0.005&min_confidence=0.15").status_code == 200
    assert client.get("/api/act6/anomaly?contamination=0.03").status_code == 200


def test_act7_sql():
    r = client.get("/api/act7/examples")
    assert r.status_code == 200
    assert len(r.json()["examples"]) >= 3

    r2 = client.post("/api/act7/run", json={"sql": "SELECT COUNT(*) AS n FROM gold_fact_sales"})
    assert r2.status_code == 200
    assert "rows" in r2.json()

    r3 = client.post("/api/act7/run", json={"sql": "DROP TABLE gold_fact_sales"})
    assert r3.status_code == 200
    assert "error" in r3.json()
