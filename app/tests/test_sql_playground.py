"""The playground must refuse any mutation. Read-only SQLite would block
it anyway, but we layer a regex validator on top so students see a
friendly error, not a SQL trace.
"""
from __future__ import annotations

import pytest

from backend import sql_playground


@pytest.mark.parametrize("sql", [
    "DELETE FROM gold_fact_sales",
    "UPDATE gold_fact_sales SET amount = 0",
    "DROP TABLE silver_sales",
    "INSERT INTO silver_sales VALUES (1)",
    "ALTER TABLE silver_sales ADD COLUMN x INTEGER",
    "CREATE TABLE evil(x)",
    "PRAGMA journal_mode = DELETE",
    "VACUUM",
    "ATTACH DATABASE 'other.db' AS other",
    "",
    "   ",
    "SELECT 1; DELETE FROM silver_sales",  # stacked
])
def test_mutations_are_blocked(sql):
    r = sql_playground.run_select(sql)
    assert "error" in r


@pytest.mark.parametrize("sql", [
    "SELECT COUNT(*) FROM gold_fact_sales",
    "WITH x AS (SELECT 1) SELECT * FROM x",
    "SELECT 1",
])
def test_reads_work(sql):
    r = sql_playground.run_select(sql)
    assert "error" not in r
    assert "rows" in r
    assert "latency_ms" in r


def test_explain_returns_plan():
    r = sql_playground.explain("SELECT * FROM gold_fact_sales LIMIT 1")
    assert "error" not in r
    assert r["rows"]
