"""Act 2 demos: OLTP point reads vs OLAP aggregates on the same data.

The UI's 'run this on OLTP' button hits oltp_aggregate and watches the
latency climb — the 11am-crash war story, live but safe because
everything is ephemeral SQLite.
"""
from __future__ import annotations

import random
import time
from datetime import datetime, timezone

from .config import RANDOM_SEED
from .db import connection


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds")


def oltp_point_read() -> dict:
    """Simulates a typical OLTP transaction: single-row lookup by PK."""
    rng = random.Random()
    with connection() as conn:
        total = conn.execute("SELECT COUNT(*) FROM oltp_transactions").fetchone()[0]
        if total == 0:
            return {"mode": "oltp", "row": None, "latency_ms": 0, "rows_scanned": 0}

        offset = rng.randint(0, max(0, total - 1))
        pk_row = conn.execute(
            "SELECT txn_id FROM oltp_transactions LIMIT 1 OFFSET ?", (offset,)
        ).fetchone()
        t0 = time.perf_counter()
        row = conn.execute(
            "SELECT * FROM oltp_transactions WHERE txn_id = ?", (pk_row["txn_id"],)
        ).fetchone()
        latency_ms = (time.perf_counter() - t0) * 1000

    return {
        "mode": "oltp",
        "sql": "SELECT * FROM oltp_transactions WHERE txn_id = ?",
        "row": dict(row) if row else None,
        "latency_ms": round(latency_ms, 3),
        "rows_scanned": 1,
    }


def oltp_insert() -> dict:
    """A typical OLTP write."""
    rng = random.Random()
    txn_id = f"TXL{int(time.time()*1000)%10_000_000:07d}"
    row = {
        "txn_id": txn_id,
        "customer_id": f"C{rng.randint(1, 400):05d}",
        "amount": round(rng.uniform(5, 2500), 2),
        "ts": _now_iso(),
        "status": "ok",
    }
    with connection() as conn:
        t0 = time.perf_counter()
        conn.execute(
            "INSERT INTO oltp_transactions VALUES (:txn_id,:customer_id,:amount,:ts,:status)", row
        )
        latency_ms = (time.perf_counter() - t0) * 1000
    return {"mode": "oltp_insert", "row": row, "latency_ms": round(latency_ms, 3)}


def olap_on_oltp() -> dict:
    """Run an aggregate on the OLTP table. This is the 'intern crashed the bank'
    query from slide 8 — it works, but the latency is order-of-magnitude worse
    than the equivalent on Gold (see olap_on_gold).
    """
    with connection() as conn:
        t0 = time.perf_counter()
        row = conn.execute(
            "SELECT COUNT(*) AS txn_count, SUM(amount) AS total, "
            "AVG(amount) AS avg_amt, status FROM oltp_transactions GROUP BY status"
        ).fetchall()
        latency_ms = (time.perf_counter() - t0) * 1000
        total_rows = conn.execute("SELECT COUNT(*) FROM oltp_transactions").fetchone()[0]
    return {
        "mode": "olap_on_oltp",
        "sql": "SELECT COUNT(*), SUM(amount), AVG(amount), status FROM oltp_transactions GROUP BY status",
        "rows": [dict(r) for r in row],
        "latency_ms": round(latency_ms, 3),
        "rows_scanned": total_rows,
    }


def olap_on_gold() -> dict:
    """Same question, but answered against the Gold fact table.
    Indexed, pre-shaped, fast.
    """
    with connection() as conn:
        t0 = time.perf_counter()
        rows = conn.execute(
            "SELECT f.channel, COUNT(*) AS n, SUM(f.amount) AS total, AVG(f.amount) AS avg_amt "
            "FROM gold_fact_sales f GROUP BY f.channel ORDER BY total DESC"
        ).fetchall()
        latency_ms = (time.perf_counter() - t0) * 1000
        total_rows = conn.execute("SELECT COUNT(*) FROM gold_fact_sales").fetchone()[0]
    return {
        "mode": "olap_on_gold",
        "sql": "SELECT channel, COUNT(*), SUM(amount), AVG(amount) FROM gold_fact_sales GROUP BY channel",
        "rows": [dict(r) for r in rows],
        "latency_ms": round(latency_ms, 3),
        "rows_scanned": total_rows,
    }
