"""Five mining techniques (slide 21), each returning shapes ready for
direct visualization by the frontend. Kept deliberately simple — these
are teaching aids, not production models.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.preprocessing import StandardScaler
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder

from . import features


# -------- 1. CLUSTERING (k-means over customers) ---------------------

def clustering(k: int = 4) -> dict:
    df = features.customer_features()
    if df.empty:
        return {"error": "no data — seed first"}

    X = df[["txns", "total_spend", "avg_basket", "recency_days"]].fillna(0).values
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)

    km = KMeans(n_clusters=k, n_init=10, random_state=42)
    labels = km.fit_predict(Xs)
    df["cluster"] = labels

    # Project to 2D for the chart: spend x recency (real, interpretable axes).
    summary = (df.groupby("cluster")
                 .agg(n=("customer_id", "count"),
                      avg_spend=("total_spend", "mean"),
                      avg_txns=("txns", "mean"),
                      avg_recency=("recency_days", "mean"))
                 .reset_index())

    points = df[["customer_id", "total_spend", "recency_days", "txns", "cluster"]].to_dict("records")

    # Centroids back in real units (using 2D slice spend x recency).
    centroids_real = scaler.inverse_transform(km.cluster_centers_)
    centroids = [
        {"cluster": i, "total_spend": float(c[1]), "recency_days": float(c[3])}
        for i, c in enumerate(centroids_real)
    ]

    return {
        "k": k,
        "points": points,
        "centroids": centroids,
        "summary": summary.to_dict("records"),
    }


# -------- 2. CLASSIFICATION (churn proxy) ----------------------------

def classification(recency_threshold_days: int = 30) -> dict:
    """Predict 'churn risk' = recency > threshold. Logistic regression
    on (age, txns, total_spend). Returns decision boundary grid for the
    UI to draw.
    """
    df = features.customer_features()
    if df.empty:
        return {"error": "no data — seed first"}

    df = df[df["txns"] > 0].copy()
    if df.empty:
        return {"error": "no customers with transactions"}

    df["churned"] = (df["recency_days"] > recency_threshold_days).astype(int)

    X = df[["total_spend", "txns"]].values
    y = df["churned"].values

    if len(np.unique(y)) < 2:
        return {
            "error": f"all customers on same side of threshold ({recency_threshold_days}d)",
            "churned_count": int(y.sum()),
            "active_count": int(len(y) - y.sum()),
        }

    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    clf = LogisticRegression(max_iter=500)
    clf.fit(Xs, y)
    score = clf.score(Xs, y)

    # Build 30x30 grid for heatmap decision boundary (in real units).
    sp_min, sp_max = float(X[:, 0].min()), float(X[:, 0].max())
    tx_min, tx_max = float(X[:, 1].min()), float(X[:, 1].max())
    xs = np.linspace(sp_min, sp_max, 30)
    ys = np.linspace(tx_min, tx_max, 30)
    xx, yy = np.meshgrid(xs, ys)
    grid_real = np.column_stack([xx.ravel(), yy.ravel()])
    grid_s = scaler.transform(grid_real)
    probs = clf.predict_proba(grid_s)[:, 1]

    grid_cells = [
        {"total_spend": float(grid_real[i, 0]),
         "txns": float(grid_real[i, 1]),
         "churn_prob": float(probs[i])}
        for i in range(len(probs))
    ]

    return {
        "recency_threshold_days": recency_threshold_days,
        "accuracy": round(float(score), 3),
        "points": df[["customer_id", "total_spend", "txns", "churned"]].to_dict("records"),
        "grid": grid_cells,
        "counts": {"churned": int(y.sum()), "active": int(len(y) - y.sum())},
    }


# -------- 3. REGRESSION (daily revenue forecast) ---------------------

def regression(horizon: int = 30) -> dict:
    df = features.sales_daily()
    if df.empty or len(df) < 5:
        return {"error": "not enough data"}

    df = df.reset_index(drop=True)
    df["t"] = np.arange(len(df))
    X = df[["t"]].values
    y = df["revenue"].values

    model = LinearRegression()
    model.fit(X, y)
    pred = model.predict(X)
    resid = y - pred
    sigma = float(np.std(resid))

    future_t = np.arange(len(df), len(df) + horizon)
    future_pred = model.predict(future_t.reshape(-1, 1))

    last_date = pd.to_datetime(df["date_id"].iloc[-1])
    future_dates = pd.date_range(last_date + pd.Timedelta(days=1), periods=horizon).strftime("%Y-%m-%d")

    history = [
        {"date_id": row["date_id"], "revenue": float(row["revenue"]),
         "predicted": float(pred[i])}
        for i, row in df.iterrows()
    ]
    # widening prediction interval — PI grows with sqrt(forecast horizon).
    future = [
        {
            "date_id": future_dates[i],
            "predicted": float(future_pred[i]),
            "lo": float(future_pred[i] - 1.96 * sigma * np.sqrt(i + 1)),
            "hi": float(future_pred[i] + 1.96 * sigma * np.sqrt(i + 1)),
        }
        for i in range(horizon)
    ]
    return {
        "history": history,
        "future": future,
        "slope": float(model.coef_[0]),
        "intercept": float(model.intercept_),
        "sigma": sigma,
    }


# -------- 4. ASSOCIATION (Apriori) -----------------------------------

def association(min_support: float = 0.01, min_confidence: float = 0.2) -> dict:
    baskets = features.baskets()
    if not baskets:
        return {"error": "not enough multi-item baskets — seed first"}

    te = TransactionEncoder()
    te_ary = te.fit(baskets).transform(baskets)
    df_t = pd.DataFrame(te_ary, columns=te.columns_)

    freq = apriori(df_t, min_support=min_support, use_colnames=True, max_len=3)
    if freq.empty:
        return {"rules": [], "itemsets": 0, "basket_count": len(baskets)}

    rules = association_rules(freq, metric="confidence", min_threshold=min_confidence)
    rules = rules.sort_values("lift", ascending=False).head(25)

    def _fmt_set(fs):
        return sorted(list(fs))

    out = [
        {
            "antecedents": _fmt_set(r["antecedents"]),
            "consequents": _fmt_set(r["consequents"]),
            "support": round(float(r["support"]), 4),
            "confidence": round(float(r["confidence"]), 4),
            "lift": round(float(r["lift"]), 3),
        }
        for _, r in rules.iterrows()
    ]
    return {
        "rules": out,
        "itemsets": int(len(freq)),
        "basket_count": len(baskets),
        "min_support": min_support,
        "min_confidence": min_confidence,
    }


# -------- 5. ANOMALY (IsolationForest on banking txns) ---------------

def anomaly(contamination: float = 0.03) -> dict:
    df = features.banking_txns()
    if df.empty:
        return {"error": "no banking data"}

    df["hour"] = pd.to_datetime(df["ts"]).dt.hour
    df["is_night"] = ((df["hour"] >= 22) | (df["hour"] <= 5)).astype(int)
    df["is_unknown_merchant"] = df["merchant"].str.startswith("unknown").astype(int)

    X = df[["amount", "is_night", "is_unknown_merchant"]].values
    iso = IsolationForest(contamination=contamination, random_state=42)
    iso.fit(X)
    df["score"] = -iso.score_samples(X)  # higher = more anomalous
    df["flagged"] = (iso.predict(X) == -1).astype(int)

    top = df.sort_values("score", ascending=False).head(50)
    return {
        "points": df[["txn_id", "amount", "hour", "merchant",
                      "is_fraud", "flagged", "score"]].to_dict("records"),
        "top_flagged": top[["txn_id", "amount", "hour", "merchant",
                            "is_fraud", "score"]].to_dict("records"),
        "confusion": {
            "true_fraud_flagged": int(((df["is_fraud"] == 1) & (df["flagged"] == 1)).sum()),
            "true_fraud_missed": int(((df["is_fraud"] == 1) & (df["flagged"] == 0)).sum()),
            "false_positive": int(((df["is_fraud"] == 0) & (df["flagged"] == 1)).sum()),
            "true_negative": int(((df["is_fraud"] == 0) & (df["flagged"] == 0)).sum()),
        },
    }
