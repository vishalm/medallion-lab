"""FastAPI app for the DataAI_Amity student visualizer.

Single service: serves JSON API under /api/* and the built React SPA
for every other path. Designed to run on a single Railway container.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import cube as cube_mod
from . import oltp_olap, schemas_info, sql_playground
from .config import DB_PATH, STATIC_DIR
from .db import connection
from .finance import medallion_finance as finance_pipeline
from .finance import seed_finance
from .medallion import injectors, pipeline
from .mining import techniques
from .routes_finance import router as finance_router
from .seed import run_full_seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not _db_exists_and_seeded():
        run_full_seed()
    if not seed_finance.is_seeded():
        seed_finance.run_finance_seed()
        # Build Silver+Gold so Act 9's BI panel has data on first paint.
        finance_pipeline.replay()
    yield


app = FastAPI(
    title="Medallion Lab — hands-on Data & AI",
    description=(
        "Browser-based playground for data warehousing and AI. "
        "Nine interactive acts cover OLTP vs OLAP, cubes, star schemas, "
        "the Medallion pipeline (Bronze → Silver → Gold), mining "
        "techniques, a SQL playground, and a CFO Finance Lab with "
        "text-to-SQL over a local LLM."
    ),
    version="1.1.0",
    lifespan=lifespan,
)
app.include_router(finance_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # student demo, public by design
    allow_methods=["*"],
    allow_headers=["*"],
)


def _db_exists_and_seeded() -> bool:
    if not DB_PATH.exists():
        return False
    try:
        with connection() as conn:
            row = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='gold_fact_sales'"
            ).fetchone()
            if not row:
                return False
            n = conn.execute("SELECT COUNT(*) FROM gold_fact_sales").fetchone()[0]
            return n > 0
    except Exception:
        return False


# ----- infrastructure -------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok", "seeded": _db_exists_and_seeded()}


@app.post("/api/reset")
def reset():
    """Nuclear option for the lecture: wipe + reseed. Idempotent."""
    counts = run_full_seed()
    fin_counts = seed_finance.run_finance_seed()
    finance_pipeline.replay()
    return {"reset": True, "counts": counts, "finance": fin_counts}


# ----- Act 2: OLTP vs OLAP -------------------------------------------

@app.get("/api/act2/oltp/read")
def act2_oltp_read():
    return oltp_olap.oltp_point_read()


@app.post("/api/act2/oltp/insert")
def act2_oltp_insert():
    return oltp_olap.oltp_insert()


@app.get("/api/act2/olap/on-oltp")
def act2_olap_on_oltp():
    return oltp_olap.olap_on_oltp()


@app.get("/api/act2/olap/on-gold")
def act2_olap_on_gold():
    return oltp_olap.olap_on_gold()


# ----- Act 3: Cube ---------------------------------------------------

class CubeRequest(BaseModel):
    group_by: list[str] = Field(default_factory=list)
    measure: str = "amount"
    filters: dict[str, str | None] | None = None


@app.get("/api/act3/meta")
def act3_meta():
    return cube_mod.available()


@app.post("/api/act3/query")
def act3_query(req: CubeRequest):
    try:
        return cube_mod.run_cube(req.group_by, req.measure, req.filters)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ----- Act 4: Star/Snowflake/Galaxy ----------------------------------

@app.get("/api/act4/{shape}")
def act4_shape(shape: str):
    shape = shape.lower()
    if shape == "star":
        return schemas_info.STAR
    if shape == "snowflake":
        return schemas_info.SNOWFLAKE
    if shape == "galaxy":
        return schemas_info.GALAXY
    raise HTTPException(status_code=404, detail="unknown shape")


@app.get("/api/act4/storage/models")
def act4_storage_models():
    return {"models": schemas_info.ROLAP_MOLAP_HOLAP}


# ----- Act 5: Medallion (HERO) ---------------------------------------

@app.get("/api/act5/counts")
def act5_counts():
    return pipeline.layer_counts()


@app.get("/api/act5/dq")
def act5_dq(limit: int = 20):
    return {"events": pipeline.recent_dq_events(limit)}


@app.get("/api/act5/sample/{layer}")
def act5_sample(layer: str, limit: int = 20):
    layer = layer.lower()
    queries = {
        "bronze": "SELECT id, source_system, ingested_at, is_dirty, dirt_kind, "
                  "substr(payload_json, 1, 140) AS payload_preview FROM bronze_sales_raw "
                  "ORDER BY id DESC LIMIT ?",
        "silver": "SELECT * FROM silver_sales ORDER BY sale_ts DESC LIMIT ?",
        "gold_fact": "SELECT * FROM gold_fact_sales ORDER BY date_id DESC LIMIT ?",
        "gold_dim_customer": "SELECT * FROM gold_dim_customer LIMIT ?",
        "gold_dim_product": "SELECT * FROM gold_dim_product LIMIT ?",
        "gold_dim_store": "SELECT * FROM gold_dim_store LIMIT ?",
        "gold_dim_date": "SELECT * FROM gold_dim_date ORDER BY date_id DESC LIMIT ?",
    }
    if layer not in queries:
        raise HTTPException(status_code=404, detail="unknown layer")
    with connection() as conn:
        rows = conn.execute(queries[layer], (limit,)).fetchall()
    return {"layer": layer, "rows": [dict(r) for r in rows]}


@app.post("/api/act5/inject/{kind}")
def act5_inject(kind: str):
    kind = kind.lower()
    if kind == "drift":
        return injectors.inject_schema_drift()
    if kind == "dupes":
        return injectors.inject_dupes()
    if kind == "nulls":
        return injectors.inject_nulls()
    if kind == "stream":
        return injectors.stream_clean(1)
    raise HTTPException(status_code=404, detail="unknown injector")


@app.post("/api/act5/stream/tick")
def act5_stream_tick(n: int = 1):
    """One streaming-ingest tick. Appends N valid rows to Bronze."""
    if n < 1 or n > 50:
        raise HTTPException(status_code=400, detail="n must be between 1 and 50")
    return injectors.stream_clean(n)


@app.post("/api/act5/transform/silver")
def act5_transform_silver():
    return pipeline.transform_bronze_to_silver()


@app.post("/api/act5/transform/gold")
def act5_transform_gold():
    return pipeline.transform_silver_to_gold()


@app.post("/api/act5/replay")
def act5_replay():
    return pipeline.replay_all()


# ----- Act 6: Mining -------------------------------------------------

@app.get("/api/act6/clustering")
def act6_clustering(k: int = 4):
    return techniques.clustering(k)


@app.get("/api/act6/classification")
def act6_classification(threshold: int = 30):
    return techniques.classification(threshold)


@app.get("/api/act6/regression")
def act6_regression(horizon: int = 30):
    return techniques.regression(horizon)


@app.get("/api/act6/association")
def act6_association(min_support: float = 0.005, min_confidence: float = 0.15):
    return techniques.association(min_support, min_confidence)


@app.get("/api/act6/anomaly")
def act6_anomaly(contamination: float = 0.03):
    return techniques.anomaly(contamination)


# ----- Act 7: SQL playground -----------------------------------------

class SqlRequest(BaseModel):
    sql: str


@app.get("/api/act7/examples")
def act7_examples():
    return {"examples": sql_playground.EXAMPLES}


@app.post("/api/act7/run")
def act7_run(req: SqlRequest):
    return sql_playground.run_select(req.sql)


@app.post("/api/act7/explain")
def act7_explain(req: SqlRequest):
    return sql_playground.explain(req.sql)


# ----- Static SPA (last so API routes win) ---------------------------

_static_path = Path(STATIC_DIR)
if _static_path.exists() and (_static_path / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=_static_path / "assets"), name="assets")

    @app.get("/")
    def root():
        return FileResponse(_static_path / "index.html")

    @app.get("/{path:path}")
    def spa_catchall(path: str):
        # Never intercept API routes (FastAPI already dispatched them if matched).
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="not found")
        candidate = _static_path / path
        if candidate.exists() and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_static_path / "index.html")
else:
    @app.get("/")
    def root_dev():
        return JSONResponse({
            "app": "Medallion Lab",
            "note": "frontend not built yet — run `npm run build` in app/frontend or `npm run dev` for a dev server",
            "api_docs": "/docs",
        })
