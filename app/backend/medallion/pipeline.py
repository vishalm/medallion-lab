"""Bronze -> Silver -> Gold transforms and the validators that catch
the three slide-24 war stories: schema drift, silent dupes, null flood.

The pipeline is re-runnable. Each transform truncates its target table
and rebuilds from the layer above, so the UI can show 'replay' without
state drift.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from ..db import connection


def _now() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds")


def _log_dq(conn, layer: str, kind: str, detail: str, rows_affected: int) -> None:
    conn.execute(
        "INSERT INTO data_quality_events (layer, kind, detail, rows_affected, created_at) "
        "VALUES (?,?,?,?,?)",
        (layer, kind, detail, rows_affected, _now()),
    )


def transform_bronze_to_silver() -> dict:
    """Parse Bronze JSON payloads, cast types, drop malformed rows.

    Returns counts + validation summary. Quarantines dirty rows instead
    of dropping silently — so Act 5's 'Silent Dupes' injector produces a
    visible data-quality event.
    """
    with connection() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM silver_sales;")

        raw = c.execute(
            "SELECT id, payload_json, is_dirty, dirt_kind FROM bronze_sales_raw"
        ).fetchall()

        parsed_ok = 0
        dropped_schema = 0
        quarantined_dupes = 0
        quarantined_nulls = 0
        seen_sale_ids: set[str] = set()

        for row in raw:
            try:
                p = json.loads(row["payload_json"])
            except json.JSONDecodeError:
                dropped_schema += 1
                continue

            required = {"sale_id", "customer_id", "product_id", "store_id",
                        "sale_ts", "quantity", "unit_price", "amount", "channel", "currency"}
            if not required.issubset(p.keys()):
                dropped_schema += 1
                continue

            if any(p.get(k) in (None, "") for k in ("customer_id", "product_id", "store_id", "sale_ts")):
                quarantined_nulls += 1
                continue

            if p["sale_id"] in seen_sale_ids:
                quarantined_dupes += 1
                continue
            seen_sale_ids.add(p["sale_id"])

            c.execute(
                "INSERT INTO silver_sales VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    p["sale_id"], p["customer_id"], p["product_id"], p["store_id"],
                    p["sale_ts"], int(p["quantity"]), float(p["unit_price"]),
                    float(p["amount"]), p["channel"], p["currency"],
                ),
            )
            parsed_ok += 1

        if dropped_schema:
            _log_dq(conn, "silver", "schema_drift",
                    f"dropped {dropped_schema} rows with malformed/missing keys", dropped_schema)
        if quarantined_nulls:
            _log_dq(conn, "silver", "null_flood",
                    f"quarantined {quarantined_nulls} rows with NULL keys", quarantined_nulls)
        if quarantined_dupes:
            _log_dq(conn, "silver", "dupes",
                    f"quarantined {quarantined_dupes} duplicate sale_id rows", quarantined_dupes)

        return {
            "parsed_ok": parsed_ok,
            "dropped_schema": dropped_schema,
            "quarantined_nulls": quarantined_nulls,
            "quarantined_dupes": quarantined_dupes,
            "bronze_total": len(raw),
        }


def transform_silver_to_gold() -> dict:
    """Rebuild gold_fact_sales from silver_sales.

    Gold dimensions are seeded separately and assumed stable for this
    teaching demo (in a real platform you'd SCD Type 2 them).
    """
    with connection() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM gold_fact_sales;")

        rows = c.execute(
            "SELECT sale_id, sale_ts, customer_id, product_id, store_id, channel, "
            "quantity, amount FROM silver_sales"
        ).fetchall()

        inserted = 0
        orphaned = 0

        # Valid dim keys for referential integrity.
        valid_customers = {r["customer_id"] for r in c.execute(
            "SELECT customer_id FROM gold_dim_customer").fetchall()}
        valid_products = {r["product_id"] for r in c.execute(
            "SELECT product_id FROM gold_dim_product").fetchall()}
        valid_stores = {r["store_id"] for r in c.execute(
            "SELECT store_id FROM gold_dim_store").fetchall()}
        valid_dates = {r["date_id"] for r in c.execute(
            "SELECT date_id FROM gold_dim_date").fetchall()}

        for r in rows:
            date_id = r["sale_ts"][:10]
            if (r["customer_id"] not in valid_customers
                    or r["product_id"] not in valid_products
                    or r["store_id"] not in valid_stores
                    or date_id not in valid_dates):
                orphaned += 1
                continue
            c.execute(
                "INSERT INTO gold_fact_sales VALUES (?,?,?,?,?,?,?,?)",
                (r["sale_id"], date_id, r["customer_id"], r["product_id"],
                 r["store_id"], r["channel"], r["quantity"], r["amount"]),
            )
            inserted += 1

        if orphaned:
            _log_dq(conn, "gold", "orphaned_fk",
                    f"rejected {orphaned} rows with unknown dim keys", orphaned)

        return {"gold_inserted": inserted, "orphaned_fk": orphaned, "silver_total": len(rows)}


def replay_all() -> dict:
    """Run the full Bronze -> Silver -> Gold refresh."""
    silver = transform_bronze_to_silver()
    gold = transform_silver_to_gold()
    return {"silver": silver, "gold": gold}


def layer_counts() -> dict:
    with connection() as conn:
        c = conn.cursor()
        return {
            "bronze": c.execute("SELECT COUNT(*) FROM bronze_sales_raw").fetchone()[0],
            "silver": c.execute("SELECT COUNT(*) FROM silver_sales").fetchone()[0],
            "gold_fact": c.execute("SELECT COUNT(*) FROM gold_fact_sales").fetchone()[0],
            "gold_dim_customer": c.execute("SELECT COUNT(*) FROM gold_dim_customer").fetchone()[0],
            "gold_dim_product": c.execute("SELECT COUNT(*) FROM gold_dim_product").fetchone()[0],
            "gold_dim_store": c.execute("SELECT COUNT(*) FROM gold_dim_store").fetchone()[0],
            "gold_dim_date": c.execute("SELECT COUNT(*) FROM gold_dim_date").fetchone()[0],
        }


def recent_dq_events(limit: int = 20) -> list[dict]:
    with connection() as conn:
        rows = conn.execute(
            "SELECT layer, kind, detail, rows_affected, created_at "
            "FROM data_quality_events ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
