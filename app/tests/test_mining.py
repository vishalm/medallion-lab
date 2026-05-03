"""Smoke tests on mining endpoints: each must return the shape Act 6
expects, even on small synthetic datasets.
"""
from __future__ import annotations

from backend.mining import techniques


def test_clustering_returns_points_and_centroids():
    r = techniques.clustering(4)
    assert "error" not in r
    assert r["k"] == 4
    assert len(r["points"]) > 0
    assert len(r["centroids"]) == 4
    for p in r["points"][:5]:
        assert 0 <= p["cluster"] < 4


def test_classification_returns_grid_and_accuracy():
    r = techniques.classification(30)
    # Seed may concentrate all recency on one side -> test skip.
    if "error" in r:
        assert "threshold" in r["error"].lower() or "data" in r["error"].lower()
        return
    assert 0 <= r["accuracy"] <= 1
    assert len(r["grid"]) == 900
    assert len(r["points"]) > 0


def test_regression_returns_history_and_future():
    r = techniques.regression(14)
    assert "error" not in r
    assert len(r["future"]) == 14
    assert len(r["history"]) > 0
    for f in r["future"]:
        assert f["lo"] <= f["predicted"] <= f["hi"]


def test_association_returns_rules_or_empty():
    r = techniques.association(0.002, 0.1)
    assert "error" not in r
    assert "rules" in r
    assert r["basket_count"] >= 0


def test_anomaly_returns_confusion():
    r = techniques.anomaly(0.03)
    assert "error" not in r
    c = r["confusion"]
    for key in ("true_fraud_flagged", "true_fraud_missed", "false_positive", "true_negative"):
        assert key in c
        assert c[key] >= 0
