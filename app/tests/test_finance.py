"""Invariants the Act 9 (CFO Finance Lab) pipeline must satisfy.

We don't test the LLM here — that depends on a running Ollama. Tests
focus on the deterministic, hermetic parts: seed, normalization,
medallion idempotency, mart correctness, anomaly bounds, and the
SQL-injection guard the text_to_sql layer reuses.
"""
from __future__ import annotations

import json

import pytest

from backend.db import connection
from backend.finance import (
    analytics, medallion_finance, normalize, seed_finance, text_to_sql,
)


@pytest.fixture(scope="module", autouse=True)
def _ensure_finance_seeded():
    """Build finance bronze/silver/gold once for the whole module."""
    seed_finance.run_finance_seed()
    medallion_finance.replay()
    yield


# ----- normalize ----------------------------------------------------------

def test_parse_messy_date_handles_three_formats():
    assert normalize.parse_messy_date("2026-04-21") == "2026-04-21"
    assert normalize.parse_messy_date("21/04/2026") == "2026-04-21"
    assert normalize.parse_messy_date("04-21-2026") == "2026-04-21"
    assert normalize.parse_messy_date("not a date") is None
    assert normalize.parse_messy_date("") is None


def test_to_aed_converts_usd_correctly():
    aed = normalize.to_aed(100.0, "USD")
    assert 360 <= aed <= 380, f"USD->AED conversion looks off: {aed}"
    # AED stays AED.
    assert normalize.to_aed(123.45, "AED") == 123.45


def test_alias_index_resolves_canonical_and_alias():
    vendors = [
        {
            "vendor_id": "V01",
            "canonical_name": "Amazon",
            "aliases_json": json.dumps(["AMZN MKTPLACE", "Amazon.ae"]),
        }
    ]
    idx = normalize.build_alias_index(vendors)
    assert normalize.canonicalize_vendor("Amazon", idx) == "V01"
    assert normalize.canonicalize_vendor("AMZN MKTPLACE", idx) == "V01"
    assert normalize.canonicalize_vendor("amzn mktplace charges", idx) == "V01"
    assert normalize.canonicalize_vendor("totally unknown vendor xyz", idx) is None


# ----- medallion ---------------------------------------------------------

def test_silver_has_only_aed_amounts_after_pipeline():
    with connection() as conn:
        bad = conn.execute(
            "SELECT COUNT(*) FROM fin_slv_transactions WHERE amount_aed IS NULL OR amount_aed < 0"
        ).fetchone()[0]
    assert bad == 0


def test_silver_employee_resolves_to_known_dept():
    with connection() as conn:
        orphans = conn.execute(
            """
            SELECT COUNT(*) FROM fin_slv_transactions t
            WHERE NOT EXISTS (
                SELECT 1 FROM fin_dim_employee e
                WHERE e.employee_id = t.employee_id AND e.dept_id = t.dept_id
            )
            """
        ).fetchone()[0]
    assert orphans == 0, "Silver rows have employees that don't match their dept_id"


def test_pipeline_is_idempotent():
    """Running replay() twice must produce identical counts."""
    first = medallion_finance.replay()
    second = medallion_finance.replay()
    assert first["silver"]["silver_inserted"] == second["silver"]["silver_inserted"]
    assert first["gold"]["spend_mart_rows"] == second["gold"]["spend_mart_rows"]
    assert first["gold"]["vendor_mart_rows"] == second["gold"]["vendor_mart_rows"]


def test_top_vendors_pareto_is_monotonic():
    """cumulative_pct must be non-decreasing along pareto_rank."""
    with connection() as conn:
        rows = conn.execute(
            "SELECT pareto_rank, cumulative_pct FROM fin_gld_top_vendors ORDER BY pareto_rank"
        ).fetchall()
    last = -1.0
    for r in rows:
        assert r["cumulative_pct"] >= last, "cumulative_pct went backwards"
        last = r["cumulative_pct"]
    # Last row must be ~100% (all vendors counted).
    assert rows[-1]["cumulative_pct"] >= 99.0


def test_spend_mart_sums_match_silver():
    """The total of the spend mart must equal the sum of Silver amounts."""
    with connection() as conn:
        silver_sum = conn.execute(
            "SELECT ROUND(SUM(amount_aed), 2) FROM fin_slv_transactions"
        ).fetchone()[0] or 0.0
        mart_sum = conn.execute(
            "SELECT ROUND(SUM(total_aed), 2) FROM fin_gld_spend_by_dept_month"
        ).fetchone()[0] or 0.0
    # Allow for a rounding cent given float aggregation.
    assert abs(silver_sum - mart_sum) < 1.0, (silver_sum, mart_sum)


# ----- analytics ---------------------------------------------------------

def test_anomaly_detection_returns_flagged_subset():
    res = analytics.detect_anomalies(sensitivity=0.05, top_k=10)
    assert "flagged" in res
    assert res["total_rows"] > 0
    assert res["outlier_count"] <= res["total_rows"]
    assert len(res["flagged"]) <= 10
    for row in res["flagged"]:
        assert row["anomaly_score"] >= 0
        assert "reasons" in row and len(row["reasons"]) >= 1


def test_anomaly_sensitivity_clamped():
    """Sensitivity outside (0, 0.5) is clamped, not crashed."""
    out_low = analytics.detect_anomalies(sensitivity=0.0, top_k=3)
    out_high = analytics.detect_anomalies(sensitivity=0.99, top_k=3)
    assert out_low["sensitivity"] >= 0.005
    assert out_high["sensitivity"] <= 0.30


# ----- text-to-SQL safety guard ------------------------------------------

def test_extract_sql_strips_fences_and_prefixes():
    raw = "Here you go:\n```sql\nSELECT 1;\n```"
    assert text_to_sql._extract_sql(raw).strip().lower().startswith("select 1")

    raw2 = "SQL: SELECT 2;"
    assert text_to_sql._extract_sql(raw2).strip().lower().startswith("select 2")


def test_ask_rejects_dml_smuggled_through_model():
    """If we fake a DML SQL through _extract_sql, validate must catch it.

    Defence-in-depth: the read-only sqlite URI is the second line of defence,
    but the regex guard from sql_playground is the first.
    """
    from backend.sql_playground import validate

    bad_attempts = [
        "DROP TABLE fin_slv_transactions;",
        "INSERT INTO fin_slv_transactions VALUES (1);",
        "SELECT 1; DELETE FROM fin_slv_transactions;",
        "UPDATE fin_slv_transactions SET amount_aed=0;",
    ]
    for sql in bad_attempts:
        ok, err = validate(sql)
        assert not ok, f"validate accepted forbidden SQL: {sql!r}"
        assert err
