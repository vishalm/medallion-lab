"""Act 7 — a safe SQL playground over the Medallion layers.

Only SELECT / WITH / EXPLAIN QUERY PLAN allowed. Uses a read-only URI
connection so even if someone smuggles a DML statement past the regex,
SQLite refuses it.
"""
from __future__ import annotations

import re
import sqlite3
import time

from .config import DB_PATH

ALLOWED_LEAD = re.compile(r"^\s*(WITH|SELECT|EXPLAIN)\b", re.IGNORECASE)
FORBIDDEN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|PRAGMA|VACUUM)\b",
    re.IGNORECASE,
)

MAX_ROWS = 500

# Example queries wired to buttons in the UI. Each one is a teaching moment.
EXAMPLES = [
    {
        "label": "Gold: top-5 products by revenue",
        "sql": (
            "SELECT p.name, p.category, SUM(f.amount) AS revenue, SUM(f.quantity) AS units\n"
            "FROM gold_fact_sales f\n"
            "JOIN gold_dim_product p ON p.product_id = f.product_id\n"
            "GROUP BY p.name, p.category\n"
            "ORDER BY revenue DESC\n"
            "LIMIT 5;"
        ),
    },
    {
        "label": "Gold: revenue by country x quarter",
        "sql": (
            "SELECT c.country, d.quarter, ROUND(SUM(f.amount), 2) AS revenue\n"
            "FROM gold_fact_sales f\n"
            "JOIN gold_dim_customer c ON c.customer_id = f.customer_id\n"
            "JOIN gold_dim_date d ON d.date_id = f.date_id\n"
            "GROUP BY c.country, d.quarter\n"
            "ORDER BY c.country, d.quarter;"
        ),
    },
    {
        "label": "Silver: raw typed rows",
        "sql": "SELECT * FROM silver_sales ORDER BY sale_ts DESC LIMIT 25;",
    },
    {
        "label": "Bronze: dirty rows quarantined",
        "sql": (
            "SELECT dirt_kind, COUNT(*) AS n\n"
            "FROM bronze_sales_raw\n"
            "WHERE is_dirty = 1\n"
            "GROUP BY dirt_kind;"
        ),
    },
    {
        "label": "DQ: recent data-quality events",
        "sql": (
            "SELECT created_at, layer, kind, rows_affected, detail\n"
            "FROM data_quality_events\n"
            "ORDER BY id DESC\n"
            "LIMIT 10;"
        ),
    },
]


def validate(sql: str) -> tuple[bool, str | None]:
    if not sql or not sql.strip():
        return False, "empty query"
    if not ALLOWED_LEAD.match(sql):
        return False, "only SELECT / WITH / EXPLAIN allowed"
    if FORBIDDEN.search(sql):
        return False, "DML and DDL keywords are blocked"
    if ";" in sql.strip().rstrip(";"):
        return False, "only one statement per run"
    return True, None


def run_select(sql: str) -> dict:
    ok, err = validate(sql)
    if not ok:
        return {"error": err}

    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        t0 = time.perf_counter()
        rows = conn.execute(sql).fetchmany(MAX_ROWS)
        latency_ms = (time.perf_counter() - t0) * 1000
        return {
            "sql": sql,
            "rows": [dict(r) for r in rows],
            "columns": list(rows[0].keys()) if rows else [],
            "row_count": len(rows),
            "truncated": len(rows) == MAX_ROWS,
            "latency_ms": round(latency_ms, 3),
        }
    except sqlite3.Error as e:
        return {"error": str(e)}
    finally:
        conn.close()


def explain(sql: str) -> dict:
    return run_select(f"EXPLAIN QUERY PLAN {sql}")
