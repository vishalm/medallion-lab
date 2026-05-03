"""Bronze -> Silver -> Gold pipeline for Act 9 (CFO Finance Lab).

Bronze = the two raw source tables (Concur + corporate-card) seeded
by seed_finance.run_finance_seed().

Silver = `fin_slv_transactions` — unioned, deduped, FX-normalised to
AED, vendor-canonicalised, employee-mapped (and therefore dept-mapped).

Gold = two semantic marts:
  - fin_gld_spend_by_dept_month
  - fin_gld_top_vendors

Each transform truncates its target and rebuilds — so Vishal can hit
'Run Pipeline' on stage as many times as he wants without state drift.
Quality issues (orphans, FX gaps, vendor misses) are logged as
data_quality_events with layer='finance'.
"""
from __future__ import annotations

from datetime import datetime, timezone

from ..db import connection
from .normalize import (
    build_alias_index, canonicalize_vendor, parse_messy_date, to_aed,
)


def _now() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds")


def _log_dq(conn, kind: str, detail: str, rows_affected: int) -> None:
    conn.execute(
        "INSERT INTO data_quality_events (layer, kind, detail, rows_affected, created_at) "
        "VALUES (?,?,?,?,?)",
        ("finance", kind, detail, rows_affected, _now()),
    )


def transform_to_silver() -> dict:
    """Union Concur + corporate-card into fin_slv_transactions (AED).

    Idempotent: drops + rebuilds the silver table contents.
    Returns a counts/quality summary for the UI to display.
    """
    with connection() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM fin_slv_transactions;")

        vendors = [dict(r) for r in c.execute(
            "SELECT vendor_id, canonical_name, aliases_json FROM fin_dim_vendor"
        ).fetchall()]
        alias_idx = build_alias_index(vendors)

        emp_to_dept = {
            r["employee_id"]: r["dept_id"]
            for r in c.execute(
                "SELECT employee_id, dept_id FROM fin_dim_employee"
            ).fetchall()
        }

        inserted = 0
        bad_dates = 0
        vendor_misses = 0
        orphan_employee = 0

        # Concur source.
        concur_rows = c.execute(
            "SELECT row_id, employee_id, category, merchant, amount, currency, submitted_date "
            "FROM fin_src_concur_expenses"
        ).fetchall()
        for r in concur_rows:
            iso = parse_messy_date(r["submitted_date"])
            if not iso:
                bad_dates += 1
                continue
            vendor_id = canonicalize_vendor(r["merchant"], alias_idx)
            if not vendor_id:
                vendor_misses += 1
            dept_id = emp_to_dept.get(r["employee_id"])
            if not dept_id:
                orphan_employee += 1
                continue
            amt_aed = to_aed(r["amount"], r["currency"])
            txn_id = f"CN-{r['row_id']:06d}"
            c.execute(
                "INSERT INTO fin_slv_transactions VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    txn_id, "concur", r["employee_id"], dept_id, vendor_id,
                    r["category"], iso, amt_aed, r["currency"], float(r["amount"]),
                ),
            )
            inserted += 1

        # Corporate-card source (USD only). Vendor only via alias.
        card_rows = c.execute(
            "SELECT row_id, employee_id, vendor_str, amount_usd, posted_date "
            "FROM fin_src_corporate_card"
        ).fetchall()
        for r in card_rows:
            iso = parse_messy_date(r["posted_date"])
            if not iso:
                bad_dates += 1
                continue
            vendor_id = canonicalize_vendor(r["vendor_str"], alias_idx)
            if not vendor_id:
                vendor_misses += 1
            if not r["employee_id"]:
                # Unmappable card row: drop into quarantine count.
                orphan_employee += 1
                continue
            dept_id = emp_to_dept.get(r["employee_id"])
            if not dept_id:
                orphan_employee += 1
                continue
            # Category falls back to canonical vendor's category.
            category = None
            if vendor_id:
                row = conn.execute(
                    "SELECT category FROM fin_dim_vendor WHERE vendor_id=?",
                    (vendor_id,),
                ).fetchone()
                if row:
                    category = row["category"]
            amt_aed = to_aed(r["amount_usd"], "USD")
            txn_id = f"CC-{r['row_id']:06d}"
            c.execute(
                "INSERT INTO fin_slv_transactions VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    txn_id, "card", r["employee_id"], dept_id, vendor_id,
                    category, iso, amt_aed, "USD", float(r["amount_usd"]),
                ),
            )
            inserted += 1

        if bad_dates:
            _log_dq(conn, "bad_date_format",
                    f"dropped {bad_dates} rows with unparseable dates", bad_dates)
        if vendor_misses:
            _log_dq(conn, "vendor_unmatched",
                    f"{vendor_misses} rows landed in Silver with NULL vendor_id", vendor_misses)
        if orphan_employee:
            _log_dq(conn, "orphan_employee",
                    f"quarantined {orphan_employee} rows with missing/unknown employee", orphan_employee)

        return {
            "silver_inserted": inserted,
            "bad_dates": bad_dates,
            "vendor_misses": vendor_misses,
            "orphan_employee": orphan_employee,
            "concur_total": len(concur_rows),
            "card_total": len(card_rows),
        }


def transform_to_gold() -> dict:
    """Rebuild fin_gld_spend_by_dept_month and fin_gld_top_vendors."""
    with connection() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM fin_gld_spend_by_dept_month;")
        c.execute("DELETE FROM fin_gld_top_vendors;")

        # Mart 1: spend by dept x month.
        c.execute(
            """
            INSERT INTO fin_gld_spend_by_dept_month
                (dept_id, dept_name, year, month, month_label, total_aed, txn_count)
            SELECT
                t.dept_id,
                d.dept_name,
                CAST(strftime('%Y', t.txn_date) AS INTEGER) AS year,
                CAST(strftime('%m', t.txn_date) AS INTEGER) AS month,
                strftime('%Y-%m', t.txn_date) AS month_label,
                ROUND(SUM(t.amount_aed), 2),
                COUNT(*)
            FROM fin_slv_transactions t
            JOIN fin_dim_department d ON d.dept_id = t.dept_id
            GROUP BY t.dept_id, d.dept_name, year, month, month_label
            """
        )
        spend_rows = c.execute(
            "SELECT COUNT(*) FROM fin_gld_spend_by_dept_month"
        ).fetchone()[0]

        # Mart 2: top vendors with Pareto rank + cumulative pct.
        rows = c.execute(
            """
            SELECT v.vendor_id, v.canonical_name, v.category,
                   ROUND(SUM(t.amount_aed), 2) AS total_aed,
                   COUNT(*) AS txn_count
            FROM fin_slv_transactions t
            JOIN fin_dim_vendor v ON v.vendor_id = t.vendor_id
            WHERE t.vendor_id IS NOT NULL
            GROUP BY v.vendor_id, v.canonical_name, v.category
            ORDER BY total_aed DESC
            """
        ).fetchall()

        total = sum(r["total_aed"] for r in rows) or 1.0
        running = 0.0
        for rank, r in enumerate(rows, start=1):
            running += r["total_aed"]
            cumulative_pct = round(100.0 * running / total, 2)
            c.execute(
                "INSERT INTO fin_gld_top_vendors VALUES (?,?,?,?,?,?,?)",
                (r["vendor_id"], r["canonical_name"], r["category"],
                 r["total_aed"], r["txn_count"], rank, cumulative_pct),
            )

        return {
            "spend_mart_rows": spend_rows,
            "vendor_mart_rows": len(rows),
            "total_spend_aed": round(total, 2),
        }


def replay() -> dict:
    """Full Bronze -> Silver -> Gold rebuild."""
    silver = transform_to_silver()
    gold = transform_to_gold()
    return {"silver": silver, "gold": gold}


def layer_counts() -> dict:
    with connection() as conn:
        c = conn.cursor()

        def n(sql: str) -> int:
            return c.execute(sql).fetchone()[0]

        return {
            "bronze_concur": n("SELECT COUNT(*) FROM fin_src_concur_expenses"),
            "bronze_card": n("SELECT COUNT(*) FROM fin_src_corporate_card"),
            "silver": n("SELECT COUNT(*) FROM fin_slv_transactions"),
            "gold_spend": n("SELECT COUNT(*) FROM fin_gld_spend_by_dept_month"),
            "gold_vendors": n("SELECT COUNT(*) FROM fin_gld_top_vendors"),
            "departments": n("SELECT COUNT(*) FROM fin_dim_department"),
            "employees": n("SELECT COUNT(*) FROM fin_dim_employee"),
            "vendors": n("SELECT COUNT(*) FROM fin_dim_vendor"),
        }


def sample_layer(layer: str, limit: int = 20) -> list[dict]:
    queries = {
        "concur": "SELECT * FROM fin_src_concur_expenses ORDER BY row_id DESC LIMIT ?",
        "card": "SELECT * FROM fin_src_corporate_card ORDER BY row_id DESC LIMIT ?",
        "silver": (
            "SELECT t.txn_id, t.source, e.full_name AS employee, d.dept_name AS department, "
            "v.canonical_name AS vendor, t.category, t.txn_date, t.amount_aed, "
            "t.original_currency, t.original_amount "
            "FROM fin_slv_transactions t "
            "LEFT JOIN fin_dim_employee e ON e.employee_id = t.employee_id "
            "LEFT JOIN fin_dim_department d ON d.dept_id = t.dept_id "
            "LEFT JOIN fin_dim_vendor v ON v.vendor_id = t.vendor_id "
            "ORDER BY t.txn_date DESC LIMIT ?"
        ),
        "gold_spend": "SELECT * FROM fin_gld_spend_by_dept_month ORDER BY year, month, dept_name LIMIT ?",
        "gold_vendors": "SELECT * FROM fin_gld_top_vendors ORDER BY pareto_rank LIMIT ?",
    }
    if layer not in queries:
        raise ValueError(f"unknown finance layer: {layer}")
    with connection() as conn:
        rows = conn.execute(queries[layer], (limit,)).fetchall()
    return [dict(r) for r in rows]
