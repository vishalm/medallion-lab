"""Invariants the Medallion pipeline must satisfy after every replay.

These are the checks we'd want in production: dim keys present,
no nulls past Silver, the three injectors are all caught.
"""
from __future__ import annotations

from backend.db import connection
from backend.medallion import injectors, pipeline


def test_layer_counts_nonempty_after_seed():
    counts = pipeline.layer_counts()
    assert counts["bronze"] > 0
    assert counts["silver"] > 0
    assert counts["gold_fact"] > 0
    assert counts["gold_dim_customer"] > 0
    assert counts["gold_dim_product"] > 0


def test_silver_has_no_null_keys():
    with connection() as conn:
        row = conn.execute(
            "SELECT COUNT(*) FROM silver_sales "
            "WHERE customer_id IS NULL OR product_id IS NULL "
            "OR store_id IS NULL OR sale_ts IS NULL"
        ).fetchone()
    assert row[0] == 0


def test_gold_fact_fks_resolve():
    with connection() as conn:
        orphans = conn.execute(
            """
            SELECT COUNT(*) FROM gold_fact_sales f
            WHERE NOT EXISTS (SELECT 1 FROM gold_dim_customer c WHERE c.customer_id = f.customer_id)
               OR NOT EXISTS (SELECT 1 FROM gold_dim_product p WHERE p.product_id = f.product_id)
               OR NOT EXISTS (SELECT 1 FROM gold_dim_store s WHERE s.store_id = f.store_id)
               OR NOT EXISTS (SELECT 1 FROM gold_dim_date d WHERE d.date_id = f.date_id)
            """
        ).fetchone()
    assert orphans[0] == 0


def test_gold_dim_customer_unique():
    with connection() as conn:
        dups = conn.execute(
            "SELECT customer_id, COUNT(*) FROM gold_dim_customer "
            "GROUP BY customer_id HAVING COUNT(*) > 1"
        ).fetchall()
    assert dups == []


def test_schema_drift_is_detected_and_quarantined():
    before = pipeline.layer_counts()
    r = injectors.inject_schema_drift(20)
    assert r["injected"] == 20

    replay = pipeline.replay_all()
    assert replay["silver"]["dropped_schema"] >= 20, (
        "schema drift must be caught, not silently written to silver"
    )
    after = pipeline.layer_counts()
    # Silver count unchanged: drifted rows were dropped.
    assert after["silver"] == before["silver"]


def test_null_flood_is_quarantined():
    before = pipeline.layer_counts()
    r = injectors.inject_nulls(15)
    assert r["injected"] == 15

    replay = pipeline.replay_all()
    assert replay["silver"]["quarantined_nulls"] >= 15
    after = pipeline.layer_counts()
    assert after["silver"] == before["silver"]


def test_duplicate_flood_is_quarantined():
    before = pipeline.layer_counts()
    r = injectors.inject_dupes(18)
    assert r["injected"] > 0  # depends on how many sampled

    replay = pipeline.replay_all()
    # Some subset will be dupes; at minimum, the quarantine counter fires.
    assert replay["silver"]["quarantined_dupes"] >= 1
    after = pipeline.layer_counts()
    assert after["silver"] == before["silver"]


def test_replay_is_idempotent():
    r1 = pipeline.replay_all()
    r2 = pipeline.replay_all()
    assert r1["silver"]["parsed_ok"] == r2["silver"]["parsed_ok"]
    assert r1["gold"]["gold_inserted"] == r2["gold"]["gold_inserted"]
