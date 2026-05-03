"""Dirty-data injectors — the slide-24 war stories, live.

Each injector pushes rows into Bronze with a specific failure mode,
then a Silver replay catches it (or doesn't). Students see the quality
event emitted into the DQ log.
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timezone

from ..config import RANDOM_SEED
from ..db import connection


def _now() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds")


def inject_schema_drift(n: int = 30) -> dict:
    """Upstream team renames `amount` to `amt` and drops `currency`."""
    rng = random.Random(RANDOM_SEED + 1)
    rows = []
    for i in range(n):
        rows.append(json.dumps({
            "sale_id": f"DRIFT{rng.randint(10000, 99999)}-{i}",
            "customer_id": f"C{rng.randint(1, 400):05d}",
            "product_id": f"P{rng.randint(1, 80):04d}",
            "store_id": f"S{rng.randint(1, 12):03d}",
            "sale_ts": "2026-04-21T10:15:00",
            "quantity": rng.randint(1, 3),
            "unit_price": round(rng.uniform(10, 500), 2),
            # NOTE: 'amount' renamed to 'amt', 'currency' removed
            "amt": round(rng.uniform(10, 1500), 2),
            "channel": "web",
        }))

    with connection() as conn:
        c = conn.cursor()
        c.executemany(
            "INSERT INTO bronze_sales_raw (source_system, ingested_at, payload_json, is_dirty, dirt_kind) "
            "VALUES ('pos-retail-v2-BROKEN', ?, ?, 1, 'schema_drift')",
            [(_now(), r) for r in rows],
        )
    return {"injected": n, "kind": "schema_drift"}


def inject_dupes(n: int = 40) -> dict:
    """Source feed doubles records — slide 24 'silent quality' scene."""
    rng = random.Random(RANDOM_SEED + 2)
    with connection() as conn:
        existing = conn.execute(
            "SELECT payload_json FROM bronze_sales_raw "
            "WHERE is_dirty = 0 ORDER BY RANDOM() LIMIT ?",
            (n,),
        ).fetchall()
        payloads = [r["payload_json"] for r in existing]
        c = conn.cursor()
        c.executemany(
            "INSERT INTO bronze_sales_raw (source_system, ingested_at, payload_json, is_dirty, dirt_kind) "
            "VALUES ('pos-retail-v1-replay', ?, ?, 1, 'dupes')",
            [(_now(), p) for p in payloads],
        )
    return {"injected": len(payloads), "kind": "dupes"}


def stream_clean(n: int = 1) -> dict:
    """Simulate one tick of a streaming ingest: N valid rows into Bronze.

    Used by Act 5's streaming toggle. Sale IDs are time-based so they never
    collide with the seed or with each other across ticks.
    """
    rng = random.Random()
    ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    rows = []
    for i in range(n):
        rows.append(json.dumps({
            "sale_id": f"STREAM-{ms}-{i}-{rng.randint(1000, 9999)}",
            "customer_id": f"C{rng.randint(1, 400):05d}",
            "product_id": f"P{rng.randint(1, 39):04d}",
            "store_id": f"S{rng.randint(1, 12):03d}",
            "sale_ts": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds"),
            "quantity": rng.choices([1, 2, 3], weights=[0.65, 0.25, 0.10])[0],
            "unit_price": round(rng.uniform(15, 899), 2),
            "amount": round(rng.uniform(15, 1800), 2),
            "channel": rng.choice(["web", "mobile", "store"]),
            "currency": "AED",
        }))
    with connection() as conn:
        c = conn.cursor()
        c.executemany(
            "INSERT INTO bronze_sales_raw (source_system, ingested_at, payload_json, is_dirty, dirt_kind) "
            "VALUES ('pos-stream-v1', ?, ?, 0, NULL)",
            [(_now(), r) for r in rows],
        )
    return {"injected": n, "kind": "stream_clean"}


def inject_nulls(n: int = 25) -> dict:
    """A feed starts writing NULL customer_id — the 'null flood'."""
    rng = random.Random(RANDOM_SEED + 3)
    rows = []
    for i in range(n):
        rows.append(json.dumps({
            "sale_id": f"NULLFLOOD{rng.randint(10000, 99999)}-{i}",
            "customer_id": None,
            "product_id": f"P{rng.randint(1, 80):04d}",
            "store_id": f"S{rng.randint(1, 12):03d}",
            "sale_ts": "2026-04-21T11:00:00",
            "quantity": rng.randint(1, 3),
            "unit_price": round(rng.uniform(10, 500), 2),
            "amount": round(rng.uniform(10, 1500), 2),
            "channel": "web",
            "currency": "AED",
        }))
    with connection() as conn:
        c = conn.cursor()
        c.executemany(
            "INSERT INTO bronze_sales_raw (source_system, ingested_at, payload_json, is_dirty, dirt_kind) "
            "VALUES ('crm-customer-feed', ?, ?, 1, 'null_flood')",
            [(_now(), r) for r in rows],
        )
    return {"injected": n, "kind": "null_flood"}
