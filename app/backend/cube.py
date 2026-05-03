"""Act 3 — the data cube. Runs OLAP operations on Gold.

Students press Slice / Dice / Drill / Roll-up / Pivot and we return both
the resulting data AND the equivalent SQL so they see the connection.
"""
from __future__ import annotations

from .db import connection

DIMENSIONS = {
    "country": ("gold_dim_customer", "country", "customer_id"),
    "city": ("gold_dim_customer", "city", "customer_id"),
    "tier": ("gold_dim_customer", "tier", "customer_id"),
    "category": ("gold_dim_product", "category", "product_id"),
    "brand": ("gold_dim_product", "brand", "product_id"),
    "store_format": ("gold_dim_store", "format", "store_id"),
    "quarter": ("gold_dim_date", "quarter", "date_id"),
    "month_name": ("gold_dim_date", "month_name", "date_id"),
    "year": ("gold_dim_date", "year", "date_id"),
    "channel": (None, "channel", None),
}

MEASURES = {
    "amount": "SUM(f.amount)",
    "quantity": "SUM(f.quantity)",
    "txn_count": "COUNT(*)",
    "avg_basket": "AVG(f.amount)",
}


def _build_sql(group_by: list[str], measure: str, filters: dict | None = None) -> tuple[str, list]:
    if measure not in MEASURES:
        raise ValueError(f"unknown measure: {measure}")

    joins: list[str] = []
    seen: set[str] = set()
    select_cols: list[str] = []
    group_cols: list[str] = []

    for dim in group_by:
        if dim not in DIMENSIONS:
            raise ValueError(f"unknown dimension: {dim}")
        table, col, fk = DIMENSIONS[dim]
        if table and table not in seen:
            joins.append(f"JOIN {table} {_alias(table)} ON {_alias(table)}.{fk} = f.{fk}")
            seen.add(table)
        ref = f"{_alias(table)}.{col}" if table else f"f.{col}"
        select_cols.append(f"{ref} AS {dim}")
        group_cols.append(ref)

    select_cols.append(f"{MEASURES[measure]} AS value")

    where_clauses: list[str] = []
    params: list = []
    if filters:
        for dim, val in filters.items():
            if dim not in DIMENSIONS or val is None or val == "":
                continue
            table, col, fk = DIMENSIONS[dim]
            if table and table not in seen:
                joins.append(f"JOIN {table} {_alias(table)} ON {_alias(table)}.{fk} = f.{fk}")
                seen.add(table)
            ref = f"{_alias(table)}.{col}" if table else f"f.{col}"
            where_clauses.append(f"{ref} = ?")
            params.append(val)

    sql = f"SELECT {', '.join(select_cols)} FROM gold_fact_sales f"
    if joins:
        sql += " " + " ".join(joins)
    if where_clauses:
        sql += " WHERE " + " AND ".join(where_clauses)
    if group_cols:
        sql += " GROUP BY " + ", ".join(group_cols)
    sql += " ORDER BY value DESC LIMIT 200"
    return sql, params


def _alias(table: str | None) -> str:
    if not table:
        return ""
    return "".join(part[0] for part in table.split("_"))


def run_cube(group_by: list[str], measure: str = "amount", filters: dict | None = None) -> dict:
    sql, params = _build_sql(group_by, measure, filters)
    with connection() as conn:
        rows = conn.execute(sql, params).fetchall()
    return {"sql": sql, "rows": [dict(r) for r in rows], "measure": measure, "group_by": group_by}


def available() -> dict:
    return {
        "dimensions": list(DIMENSIONS.keys()),
        "measures": list(MEASURES.keys()),
    }
