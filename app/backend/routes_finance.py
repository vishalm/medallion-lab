"""Act 9 — CFO Finance Lab routes.

All endpoints live under /api/finance/*. Mounted by main.py.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .finance import (
    analytics, llm_client, marts, medallion_finance, seed_finance, text_to_sql,
)

router = APIRouter(prefix="/api/finance", tags=["finance"])


# ----- Stage: MESS (raw sources) -----------------------------------------

@router.get("/raw/{source}")
def raw_source(source: str, limit: int = 25):
    source = source.lower()
    if source not in {"concur", "card"}:
        raise HTTPException(status_code=404, detail="unknown source")
    return {
        "source": source,
        "rows": medallion_finance.sample_layer(source, limit=limit),
    }


# ----- Stage: TRUST (medallion) ------------------------------------------

@router.get("/counts")
def counts():
    return medallion_finance.layer_counts()


@router.post("/reseed")
def reseed():
    """Wipe + rebuild the finance Bronze tables. Silver/Gold rebuild via /run."""
    counts = seed_finance.run_finance_seed()
    return {"reseed": True, "counts": counts}


@router.post("/transform/silver")
def run_silver():
    return medallion_finance.transform_to_silver()


@router.post("/transform/gold")
def run_gold():
    return medallion_finance.transform_to_gold()


@router.post("/run")
def run_all():
    """Full Bronze -> Silver -> Gold rebuild — the big TRUST button."""
    return medallion_finance.replay()


@router.get("/sample/{layer}")
def sample(layer: str, limit: int = 25):
    try:
        return {"layer": layer, "rows": medallion_finance.sample_layer(layer, limit=limit)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ----- Stage: DECIDE (BI) ------------------------------------------------

@router.get("/marts/kpis")
def mart_kpis():
    return marts.kpis()


@router.get("/marts/spend-by-dept-month")
def mart_spend():
    return {"rows": marts.spend_by_dept_month()}


@router.get("/marts/top-vendors")
def mart_top_vendors(limit: int = 20):
    return {"rows": marts.top_vendors(limit=limit)}


@router.get("/marts/drill/dept")
def drill_dept(dept_id: str, year: int, month: int, limit: int = 50):
    return marts.drill_dept(dept_id, year, month, limit=limit)


@router.get("/marts/drill/vendor")
def drill_vendor(vendor_id: str, limit: int = 50):
    return marts.drill_vendor(vendor_id, limit=limit)


# ----- Extra DECIDE dashboards -------------------------------------------

@router.get("/marts/daily-trend")
def mart_daily_trend(window_days: int = 90):
    return {"rows": marts.daily_trend(window_days=window_days)}


@router.get("/marts/currency-split")
def mart_currency_split():
    return {"rows": marts.currency_split()}


@router.get("/marts/source-split")
def mart_source_split():
    return {"rows": marts.source_split()}


@router.get("/marts/category-by-dept")
def mart_category_by_dept():
    return marts.category_by_dept()


# ----- Stage: PREDICT (anomalies + new predictions) ----------------------

@router.get("/anomalies")
def anomalies(sensitivity: float = 0.05, top_k: int = 25):
    return analytics.detect_anomalies(sensitivity=sensitivity, top_k=top_k)


@router.get("/predict/dow-pattern")
def predict_dow_pattern():
    return analytics.dow_pattern()


@router.get("/predict/forecast")
def predict_forecast():
    return {"rows": analytics.next_month_forecast()}


@router.get("/predict/concentration")
def predict_concentration():
    return analytics.vendor_concentration()


# ----- Stage: ASK (text-to-SQL) ------------------------------------------

class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=400)


@router.get("/ask/presets")
def ask_presets():
    return {"presets": text_to_sql.PRESET_QUESTIONS}


@router.post("/ask")
def ask(req: AskRequest):
    return text_to_sql.ask(req.question)


@router.get("/llm/health")
def llm_health():
    return llm_client.health()


@router.post("/llm/warmup")
def llm_warmup():
    return llm_client.warmup()
