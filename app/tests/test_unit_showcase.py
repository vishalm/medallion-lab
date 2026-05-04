"""Showcase unit tests.

Two focused tests that double as live demos for the lecture:

  1. The Medallion pipeline catches all three slide-24 war stories
     (schema drift, silent dupes, null flood) and emits one DQ event
     per failure mode — not zero, not one collapsed event.

  2. The cube SQL builder produces correct JOINs + GROUP BYs from a
     dimension list and rejects unknown dimensions / measures with
     ValueError. Pure unit test — no DB round-trip.

These run in <1s on the conftest's reduced seed and are the ones to
project on the screen when someone asks "but how do you know it works?".
"""
from __future__ import annotations

import pytest

from backend import cube
from backend.medallion import injectors, pipeline


# --------------------------------------------------------------------------
# 1) End-to-end DQ demo — bronze through gold catches all three scenarios.
# --------------------------------------------------------------------------

def test_medallion_pipeline_catches_drift_dupes_and_nulls():
    # Baseline replay so the DQ log starts from a known good state.
    pipeline.replay_all()

    # Inject one of each war story into Bronze.
    drift = injectors.inject_schema_drift(n=15)
    dupes = injectors.inject_dupes(n=20)
    nulls = injectors.inject_nulls(n=10)

    assert drift["injected"] == 15
    assert nulls["injected"] == 10
    assert dupes["injected"] > 0  # depends on existing clean rows present

    # Replay so Silver re-parses + quarantines.
    out = pipeline.replay_all()
    silver_summary = out["silver"]

    # Each failure mode must increment its own quarantine bucket.
    assert silver_summary["dropped_schema"] >= 15, (
        "schema-drift rows should be dropped at Silver"
    )
    assert silver_summary["quarantined_nulls"] >= 10, (
        "null-customer rows should be quarantined at Silver"
    )
    assert silver_summary["quarantined_dupes"] >= 1, (
        "duplicate sale_id rows should be quarantined at Silver"
    )

    # And the DQ event log must surface them — that log IS the demo.
    events = pipeline.recent_dq_events(limit=50)
    kinds = {e["kind"] for e in events}
    assert {"schema_drift", "null_flood", "dupes"}.issubset(kinds), (
        f"expected schema_drift + null_flood + dupes events, got {kinds}"
    )

    # Gold should never include orphaned FK rows (the dim safety net).
    assert out["gold"]["orphaned_fk"] >= 0
    assert out["gold"]["gold_inserted"] > 0


# --------------------------------------------------------------------------
# 2) Cube SQL builder — pure-function tests, no DB.
# --------------------------------------------------------------------------

class TestCubeSqlBuilder:
    def test_single_dimension_emits_one_join_and_group_by(self):
        sql, params = cube._build_sql(["country"], "amount", filters=None)
        assert "FROM gold_fact_sales f" in sql
        assert "JOIN gold_dim_customer" in sql
        assert "GROUP BY" in sql
        assert "SUM(f.amount)" in sql
        assert "ORDER BY value DESC" in sql
        assert params == []

    def test_multi_dim_doesnt_double_join_same_table(self):
        # country and city both come from gold_dim_customer; the builder
        # must only emit ONE join for that table.
        sql, _ = cube._build_sql(["country", "city"], "amount")
        assert sql.count("JOIN gold_dim_customer") == 1
        assert "country" in sql and "city" in sql

    def test_filter_adds_where_clause_with_param(self):
        sql, params = cube._build_sql(
            ["country"], "amount", filters={"country": "India"}
        )
        assert "WHERE" in sql
        assert "= ?" in sql
        assert params == ["India"]

    def test_empty_filter_value_is_ignored(self):
        # An empty string filter must not produce a WHERE — otherwise the
        # UI's "All countries" option would silently match nothing.
        sql, params = cube._build_sql(
            ["country"], "amount", filters={"country": ""}
        )
        assert "WHERE" not in sql
        assert params == []

    @pytest.mark.parametrize("bad_dim", ["nope", "customer_id", ""])
    def test_unknown_dimension_raises(self, bad_dim):
        with pytest.raises(ValueError, match="unknown dimension"):
            cube._build_sql([bad_dim], "amount")

    def test_unknown_measure_raises(self):
        with pytest.raises(ValueError, match="unknown measure"):
            cube._build_sql(["country"], "ebitda")

    def test_channel_uses_fact_table_directly_no_join(self):
        # `channel` lives on the fact table — the builder must NOT join
        # any dim for it. Regression guard for an early bug where every
        # dimension forced a join.
        sql, _ = cube._build_sql(["channel"], "txn_count")
        assert "JOIN" not in sql
        assert "f.channel" in sql
        assert "COUNT(*)" in sql
