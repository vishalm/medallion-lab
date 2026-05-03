"""Read-only mart accessors for the Act 9 BI dashboards.

Frontend hits /api/finance/marts/* which calls these functions.
Marts are populated by medallion_finance.transform_to_gold().
"""
from __future__ import annotations

from ..db import connection


def spend_by_dept_month() -> list[dict]:
    with connection() as conn:
        rows = conn.execute(
            "SELECT dept_id, dept_name, year, month, month_label, total_aed, txn_count "
            "FROM fin_gld_spend_by_dept_month "
            "ORDER BY year, month, dept_name"
        ).fetchall()
    return [dict(r) for r in rows]


def top_vendors(limit: int = 20) -> list[dict]:
    with connection() as conn:
        rows = conn.execute(
            "SELECT vendor_id, canonical_name, category, total_aed, txn_count, "
            "pareto_rank, cumulative_pct FROM fin_gld_top_vendors "
            "ORDER BY pareto_rank LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def drill_dept(dept_id: str, year: int, month: int, limit: int = 50) -> dict:
    """Click-through from a dept x month bar -> the underlying Silver rows."""
    with connection() as conn:
        rows = conn.execute(
            "SELECT t.txn_id, t.source, e.full_name AS employee, "
            "v.canonical_name AS vendor, t.category, t.txn_date, t.amount_aed, "
            "t.original_currency, t.original_amount "
            "FROM fin_slv_transactions t "
            "LEFT JOIN fin_dim_employee e ON e.employee_id = t.employee_id "
            "LEFT JOIN fin_dim_vendor v ON v.vendor_id = t.vendor_id "
            "WHERE t.dept_id = ? "
            "AND CAST(strftime('%Y', t.txn_date) AS INTEGER) = ? "
            "AND CAST(strftime('%m', t.txn_date) AS INTEGER) = ? "
            "ORDER BY t.amount_aed DESC LIMIT ?",
            (dept_id, year, month, limit),
        ).fetchall()
        total = conn.execute(
            "SELECT COALESCE(SUM(amount_aed), 0) FROM fin_slv_transactions "
            "WHERE dept_id = ? "
            "AND CAST(strftime('%Y', txn_date) AS INTEGER) = ? "
            "AND CAST(strftime('%m', txn_date) AS INTEGER) = ?",
            (dept_id, year, month),
        ).fetchone()[0]
    return {
        "dept_id": dept_id,
        "year": year,
        "month": month,
        "total_aed": round(total, 2),
        "rows": [dict(r) for r in rows],
    }


def drill_vendor(vendor_id: str, limit: int = 50) -> dict:
    with connection() as conn:
        rows = conn.execute(
            "SELECT t.txn_id, t.source, e.full_name AS employee, "
            "d.dept_name AS department, t.category, t.txn_date, t.amount_aed, "
            "t.original_currency, t.original_amount "
            "FROM fin_slv_transactions t "
            "LEFT JOIN fin_dim_employee e ON e.employee_id = t.employee_id "
            "LEFT JOIN fin_dim_department d ON d.dept_id = t.dept_id "
            "WHERE t.vendor_id = ? "
            "ORDER BY t.amount_aed DESC LIMIT ?",
            (vendor_id, limit),
        ).fetchall()
        total_row = conn.execute(
            "SELECT canonical_name, total_aed, txn_count "
            "FROM fin_gld_top_vendors WHERE vendor_id = ?",
            (vendor_id,),
        ).fetchone()
    return {
        "vendor_id": vendor_id,
        "canonical_name": total_row["canonical_name"] if total_row else None,
        "total_aed": total_row["total_aed"] if total_row else 0.0,
        "txn_count": total_row["txn_count"] if total_row else 0,
        "rows": [dict(r) for r in rows],
    }


def daily_trend(window_days: int = 90) -> list[dict]:
    """Per-day total spend over the last `window_days`. Drives the area chart."""
    with connection() as conn:
        rows = conn.execute(
            "SELECT t.txn_date AS day, "
            "ROUND(SUM(t.amount_aed), 2) AS total_aed, "
            "COUNT(*) AS txn_count "
            "FROM fin_slv_transactions t "
            "WHERE date(t.txn_date) >= date((SELECT MAX(txn_date) FROM fin_slv_transactions), ?) "
            "GROUP BY t.txn_date "
            "ORDER BY day",
            (f"-{window_days} days",),
        ).fetchall()
    return [dict(r) for r in rows]


def currency_split() -> list[dict]:
    """Original-currency mix (AED vs USD vs ...) — donut input."""
    with connection() as conn:
        rows = conn.execute(
            "SELECT original_currency AS currency, "
            "ROUND(SUM(amount_aed), 2) AS total_aed, "
            "COUNT(*) AS txn_count "
            "FROM fin_slv_transactions "
            "GROUP BY original_currency "
            "ORDER BY total_aed DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def source_split() -> list[dict]:
    """Concur vs Corporate-card spend — donut input."""
    with connection() as conn:
        rows = conn.execute(
            "SELECT source, "
            "ROUND(SUM(amount_aed), 2) AS total_aed, "
            "COUNT(*) AS txn_count "
            "FROM fin_slv_transactions "
            "GROUP BY source "
            "ORDER BY total_aed DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def category_by_dept() -> dict:
    """Category × department spend — radar/heatmap input.

    Returns a flat list plus the unique categories and departments so the
    frontend can pivot it into a radar chart per dept.
    """
    with connection() as conn:
        rows = conn.execute(
            "SELECT d.dept_name, t.category, "
            "ROUND(SUM(t.amount_aed), 2) AS total_aed "
            "FROM fin_slv_transactions t "
            "JOIN fin_dim_department d ON d.dept_id = t.dept_id "
            "WHERE t.category IS NOT NULL "
            "GROUP BY d.dept_name, t.category "
            "ORDER BY d.dept_name, t.category"
        ).fetchall()
        cats = sorted({r["category"] for r in rows})
        depts = sorted({r["dept_name"] for r in rows})
    return {
        "rows": [dict(r) for r in rows],
        "categories": cats,
        "departments": depts,
    }


def kpis() -> dict:
    """Top-of-page numbers shown above the BI charts."""
    with connection() as conn:
        c = conn.cursor()
        total = c.execute(
            "SELECT COALESCE(SUM(amount_aed), 0) FROM fin_slv_transactions"
        ).fetchone()[0]
        n_txn = c.execute(
            "SELECT COUNT(*) FROM fin_slv_transactions"
        ).fetchone()[0]
        n_vendors = c.execute(
            "SELECT COUNT(*) FROM fin_gld_top_vendors"
        ).fetchone()[0]
        # Concentration: top-5 vendor share of total.
        top5_share = c.execute(
            "SELECT COALESCE(MAX(cumulative_pct), 0) FROM fin_gld_top_vendors WHERE pareto_rank <= 5"
        ).fetchone()[0]
        date_range = c.execute(
            "SELECT MIN(txn_date), MAX(txn_date) FROM fin_slv_transactions"
        ).fetchone()
    return {
        "total_aed": round(total, 2),
        "txn_count": n_txn,
        "vendor_count": n_vendors,
        "top5_concentration_pct": round(top5_share, 2),
        "date_min": date_range[0],
        "date_max": date_range[1],
    }
