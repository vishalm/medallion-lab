"""Shared feature builders across the five mining techniques."""
from __future__ import annotations

import pandas as pd

from ..db import connection


def customer_features() -> pd.DataFrame:
    """Build a per-customer feature frame from Gold. Used by clustering,
    classification (churn proxy), and anomaly.
    """
    with connection() as conn:
        df = pd.read_sql_query(
            """
            SELECT
                c.customer_id,
                c.age,
                c.tier,
                c.country,
                COALESCE(stats.txns, 0) AS txns,
                COALESCE(stats.total_spend, 0.0) AS total_spend,
                COALESCE(stats.avg_basket, 0.0) AS avg_basket,
                COALESCE(stats.last_day, 0) AS recency_days
            FROM gold_dim_customer c
            LEFT JOIN (
                SELECT
                    customer_id,
                    COUNT(*) AS txns,
                    SUM(amount) AS total_spend,
                    AVG(amount) AS avg_basket,
                    CAST(julianday('2026-04-21') - julianday(MAX(date_id)) AS INTEGER) AS last_day
                FROM gold_fact_sales
                GROUP BY customer_id
            ) stats ON stats.customer_id = c.customer_id
            """,
            conn,
        )
    return df


def sales_daily() -> pd.DataFrame:
    """Daily revenue series — used by regression (forecast)."""
    with connection() as conn:
        df = pd.read_sql_query(
            """
            SELECT date_id, SUM(amount) AS revenue, COUNT(*) AS txns
            FROM gold_fact_sales
            GROUP BY date_id
            ORDER BY date_id
            """,
            conn,
        )
    return df


def baskets() -> list[list[str]]:
    """One basket = all products a customer bought in one day.
    Used by association rules.
    """
    with connection() as conn:
        df = pd.read_sql_query(
            """
            SELECT customer_id, date_id, product_id
            FROM gold_fact_sales
            """,
            conn,
        )
    if df.empty:
        return []
    df = df.merge(
        _product_names(),
        on="product_id",
    )
    grouped = df.groupby(["customer_id", "date_id"])["name"].apply(list)
    return [b for b in grouped if len(b) >= 2]


def _product_names() -> pd.DataFrame:
    with connection() as conn:
        return pd.read_sql_query("SELECT product_id, name FROM gold_dim_product", conn)


def banking_txns() -> pd.DataFrame:
    with connection() as conn:
        return pd.read_sql_query(
            "SELECT txn_id, account_id, amount, merchant, ts, is_fraud FROM banking_transactions",
            conn,
        )
