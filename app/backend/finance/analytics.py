"""Anomaly detection on Silver transactions.

One model: Isolation Forest. Sensitivity slider in the UI maps to the
`contamination` parameter. Returns the top-K most anomalous rows with
human-readable reasons so a student can immediately see why each is
flagged.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from ..db import connection


def _load_silver_df() -> pd.DataFrame:
    with connection() as conn:
        rows = conn.execute(
            "SELECT t.txn_id, t.source, t.employee_id, t.dept_id, t.vendor_id, "
            "t.category, t.txn_date, t.amount_aed, "
            "e.full_name AS employee, d.dept_name AS department, "
            "v.canonical_name AS vendor "
            "FROM fin_slv_transactions t "
            "LEFT JOIN fin_dim_employee e ON e.employee_id = t.employee_id "
            "LEFT JOIN fin_dim_department d ON d.dept_id = t.dept_id "
            "LEFT JOIN fin_dim_vendor v ON v.vendor_id = t.vendor_id "
        ).fetchall()
    return pd.DataFrame([dict(r) for r in rows])


def detect_anomalies(sensitivity: float = 0.05, top_k: int = 25) -> dict:
    """Isolation Forest on (amount_aed, day_of_week, dept, category).

    `sensitivity` ~= contamination (expected fraction of outliers).
    Clamped to [0.005, 0.30] so the model always converges.
    """
    sensitivity = max(0.005, min(0.30, float(sensitivity)))
    df = _load_silver_df()
    if df.empty:
        return {"flagged": [], "total_rows": 0, "sensitivity": sensitivity}

    # Numeric features.
    df["dt"] = pd.to_datetime(df["txn_date"])
    df["dow"] = df["dt"].dt.dayofweek
    df["log_amount"] = np.log1p(df["amount_aed"].clip(lower=0))

    # One-hot encode dept + category (small cardinality, safe).
    feats = pd.concat(
        [
            df[["log_amount", "dow"]].fillna(0),
            pd.get_dummies(df["department"].fillna("UNK"), prefix="dept"),
            pd.get_dummies(df["category"].fillna("UNK"), prefix="cat"),
        ],
        axis=1,
    )

    model = IsolationForest(
        contamination=sensitivity, random_state=20260421, n_estimators=120,
    )
    model.fit(feats)
    df["anomaly_score"] = -model.decision_function(feats)  # higher = weirder
    df["is_outlier"] = model.predict(feats) == -1

    # Build human-readable reasons. Within the flagged set we rank by
    # amount first — a 47k AED weekend hotel charge tells the story
    # better than a 95 AED weekend coffee, even if both are outliers.
    median_amt = df["amount_aed"].median() or 1.0
    flagged = (
        df[df["is_outlier"]]
        .sort_values(["amount_aed", "anomaly_score"], ascending=[False, False])
        .head(top_k)
        .copy()
    )
    flagged["amount_multiple_of_median"] = (
        flagged["amount_aed"] / median_amt
    ).round(1)

    out = []
    for _, r in flagged.iterrows():
        reasons = []
        if r["amount_multiple_of_median"] >= 5:
            reasons.append(f"{r['amount_multiple_of_median']:.1f}x the median txn")
        if r["dow"] >= 5:
            reasons.append("posted on a weekend")
        if r["amount_aed"] >= 10000:
            reasons.append("amount above 10,000 AED")
        if not reasons:
            reasons.append("unusual combination of dept + category + amount")
        out.append({
            "txn_id": r["txn_id"],
            "source": r["source"],
            "employee": r["employee"],
            "department": r["department"],
            "vendor": r["vendor"],
            "category": r["category"],
            "txn_date": r["txn_date"],
            "amount_aed": float(round(r["amount_aed"], 2)),
            "anomaly_score": float(round(r["anomaly_score"], 4)),
            "reasons": reasons,
        })

    return {
        "flagged": out,
        "total_rows": int(len(df)),
        "outlier_count": int(df["is_outlier"].sum()),
        "sensitivity": sensitivity,
        "median_amount_aed": float(round(median_amt, 2)),
    }


# ----- Day-of-week pattern -----------------------------------------------


def dow_pattern() -> dict:
    """Average and total spend per day-of-week. Tells students 'when do
    expenses really happen?' Surprises usually live on weekends.
    """
    df = _load_silver_df()
    if df.empty:
        return {"rows": [], "weekend_share_pct": 0.0}
    df["dt"] = pd.to_datetime(df["txn_date"])
    df["dow"] = df["dt"].dt.dayofweek
    df["dow_name"] = df["dt"].dt.day_name().str[:3]
    grouped = df.groupby(["dow", "dow_name"]).agg(
        total_aed=("amount_aed", "sum"),
        avg_aed=("amount_aed", "mean"),
        txn_count=("amount_aed", "size"),
    ).reset_index().sort_values("dow")
    total = float(df["amount_aed"].sum()) or 1.0
    weekend_share = float(df[df["dow"] >= 5]["amount_aed"].sum()) / total * 100.0
    return {
        "rows": [
            {
                "dow": int(r.dow),
                "day": str(r.dow_name),
                "total_aed": float(round(r.total_aed, 2)),
                "avg_aed": float(round(r.avg_aed, 2)),
                "txn_count": int(r.txn_count),
            }
            for r in grouped.itertuples()
        ],
        "weekend_share_pct": float(round(weekend_share, 2)),
    }


# ----- Next-month forecast (per-dept linear trend) -----------------------


def next_month_forecast() -> list[dict]:
    """Simple linear forecast for each department's next-month spend.

    Uses ordinary least squares on the last 6 months of dept × month
    spend. Pedagogically clean — students can see exactly what the
    model is doing. Not production-grade.
    """
    from numpy.polynomial import polynomial as P

    with connection() as conn:
        rows = conn.execute(
            "SELECT dept_name, year, month, total_aed "
            "FROM fin_gld_spend_by_dept_month ORDER BY dept_name, year, month"
        ).fetchall()
    if not rows:
        return []

    df = pd.DataFrame([dict(r) for r in rows])
    df["period"] = df["year"] * 12 + df["month"]
    out: list[dict] = []
    for dept, g in df.groupby("dept_name"):
        # Last 6 months only — recent trend, not lifetime average.
        g_recent = g.sort_values("period").tail(6)
        if len(g_recent) < 3:
            continue
        x = g_recent["period"].to_numpy()
        y = g_recent["total_aed"].to_numpy()
        # Fit y = a + b*x (linear).
        coeffs = P.polyfit(x, y, 1)  # [a, b]
        next_period = int(g_recent["period"].max()) + 1
        forecast = float(coeffs[0] + coeffs[1] * next_period)
        last_actual = float(g_recent.iloc[-1]["total_aed"])
        delta_pct = (forecast - last_actual) / last_actual * 100.0 if last_actual else 0.0
        out.append({
            "dept_name": str(dept),
            "last_actual_aed": round(last_actual, 2),
            "forecast_next_aed": round(max(forecast, 0.0), 2),
            "delta_pct": round(delta_pct, 1),
            "history": [
                {"period": int(p), "amount_aed": round(float(v), 2)}
                for p, v in zip(g_recent["period"], g_recent["total_aed"])
            ],
        })
    return sorted(out, key=lambda r: r["forecast_next_aed"], reverse=True)


# ----- Vendor concentration / Gini-style risk ----------------------------


def vendor_concentration() -> dict:
    """Vendor spend concentration risk.

    Returns Gini-coefficient-ish stats and the top-3 / top-5 / top-10
    cumulative shares so we can render a 'how concentrated is your
    supplier base?' radial gauge.
    """
    with connection() as conn:
        rows = conn.execute(
            "SELECT canonical_name, total_aed, pareto_rank, cumulative_pct "
            "FROM fin_gld_top_vendors ORDER BY pareto_rank"
        ).fetchall()
    if not rows:
        return {"top_3_pct": 0, "top_5_pct": 0, "top_10_pct": 0, "gini": 0, "vendor_count": 0}

    rows_d = [dict(r) for r in rows]
    n = len(rows_d)
    total = sum(r["total_aed"] for r in rows_d) or 1.0
    sorted_amounts = sorted([r["total_aed"] for r in rows_d])
    # Gini coefficient (area-between-Lorenz-and-equality).
    cum = 0.0
    gini_num = 0.0
    for i, x in enumerate(sorted_amounts, start=1):
        cum += x
        gini_num += (2 * i - n - 1) * x
    gini = gini_num / (n * cum) if cum else 0.0

    by_rank = {r["pareto_rank"]: r["cumulative_pct"] for r in rows_d}
    return {
        "vendor_count": n,
        "total_aed": round(total, 2),
        "top_3_pct": float(round(by_rank.get(min(3, n), by_rank[max(by_rank)]), 2)),
        "top_5_pct": float(round(by_rank.get(min(5, n), by_rank[max(by_rank)]), 2)),
        "top_10_pct": float(round(by_rank.get(min(10, n), by_rank[max(by_rank)]), 2)),
        "gini": round(float(gini), 3),
        "leaders": [
            {"name": r["canonical_name"], "share_pct": round(r["total_aed"] / total * 100, 2)}
            for r in rows_d[:5]
        ],
    }
