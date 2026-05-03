"""Text-to-SQL over the finance Silver + Gold layer.

Pipeline:
  1. Build prompt = (system schema chunk) + (few-shot examples) + (user Q).
  2. Call llm_client.chat().
  3. Strip code fences, extract single SQL statement.
  4. Validate (SELECT/WITH only, no DML/DDL) using the same regex as
     sql_playground.
  5. Execute against a read-only SQLite connection.
  6. Return {sql, rows, columns, latency_ms} or {error}.

The model's output is never trusted: every safety net of Act 7 applies.
"""
from __future__ import annotations

import re
import sqlite3
import time

from ..config import DB_PATH
from ..sql_playground import FORBIDDEN, MAX_ROWS, validate
from . import llm_client
from .rich_response import build_narrative, infer_chart

# Five canned demo questions, one per SQL concept.
PRESET_QUESTIONS = [
    "What did Marketing spend last month?",
    "Top 5 vendors by total spend.",
    "Which department's spend grew the most vs the previous month?",
    "Any expenses over 10,000 AED at restaurants?",
    "Show me Amazon spend by month.",
]

# The schema chunk: small, dense, includes joins + sample columns.
SCHEMA_PROMPT = """You translate finance questions into SQLite SELECT queries
over the schema below. Do not write INSERT/UPDATE/DELETE/DROP/ALTER. Output
ONLY the SQL inside a fenced ```sql block with no commentary.

Reporting currency is AED. All amount columns are already AED in Silver
and Gold tables.

TABLES:

fin_dim_department(dept_id TEXT, dept_name TEXT)
  -- 5 departments: Marketing, Sales, Engineering, HR, Operations.

fin_dim_employee(employee_id TEXT, full_name TEXT, dept_id TEXT)

fin_dim_vendor(vendor_id TEXT, canonical_name TEXT, category TEXT,
               aliases_json TEXT)
  -- categories: Travel, Meals, Software, Marketing, Utilities, Office

fin_slv_transactions(
    txn_id TEXT, source TEXT,           -- 'concur' or 'card'
    employee_id TEXT, dept_id TEXT, vendor_id TEXT,
    category TEXT, txn_date TEXT,       -- ISO yyyy-mm-dd
    amount_aed REAL,
    original_currency TEXT, original_amount REAL
)
  -- The unioned, normalised, AED-converted Silver layer.

fin_gld_spend_by_dept_month(
    dept_id TEXT, dept_name TEXT,
    year INTEGER, month INTEGER, month_label TEXT, -- e.g. '2026-04'
    total_aed REAL, txn_count INTEGER
)

fin_gld_top_vendors(
    vendor_id TEXT, canonical_name TEXT, category TEXT,
    total_aed REAL, txn_count INTEGER,
    pareto_rank INTEGER, cumulative_pct REAL
)

JOIN HINTS:
  - Use fin_gld_spend_by_dept_month for any dept x month aggregation.
  - Use fin_gld_top_vendors for "top vendor" or "biggest supplier" questions.
  - Use fin_slv_transactions when you need row-level detail (joining
    employees, vendors, categories).
  - Restaurant-style questions = category='Meals'.
  - Date math uses SQLite's strftime/date functions.
"""

# Few-shot examples cover: filter+sum, group+order+limit, time comparison,
# multi-condition, aliased vendor lookup. Same shape as the 5 presets.
FEW_SHOT = [
    {
        "q": "What did Marketing spend last month?",
        "sql": (
            "SELECT total_aed\n"
            "FROM fin_gld_spend_by_dept_month\n"
            "WHERE dept_name = 'Marketing'\n"
            "  AND month_label = strftime('%Y-%m', date('now', '-1 month'));"
        ),
    },
    {
        "q": "Top 5 vendors by total spend.",
        "sql": (
            "SELECT canonical_name, ROUND(total_aed, 2) AS spend_aed, txn_count\n"
            "FROM fin_gld_top_vendors\n"
            "ORDER BY pareto_rank\n"
            "LIMIT 5;"
        ),
    },
    {
        "q": "How much did Engineering spend on software in 2026?",
        "sql": (
            "SELECT ROUND(SUM(t.amount_aed), 2) AS spend_aed\n"
            "FROM fin_slv_transactions t\n"
            "JOIN fin_dim_department d ON d.dept_id = t.dept_id\n"
            "WHERE d.dept_name = 'Engineering'\n"
            "  AND t.category = 'Software'\n"
            "  AND strftime('%Y', t.txn_date) = '2026';"
        ),
    },
    {
        "q": "Any expenses over 10000 AED at restaurants?",
        "sql": (
            "SELECT t.txn_date, e.full_name, v.canonical_name, t.amount_aed\n"
            "FROM fin_slv_transactions t\n"
            "LEFT JOIN fin_dim_employee e ON e.employee_id = t.employee_id\n"
            "LEFT JOIN fin_dim_vendor v ON v.vendor_id = t.vendor_id\n"
            "WHERE t.category = 'Meals'\n"
            "  AND t.amount_aed > 10000\n"
            "ORDER BY t.amount_aed DESC;"
        ),
    },
    {
        "q": "Show me Amazon spend by month.",
        "sql": (
            "SELECT strftime('%Y-%m', t.txn_date) AS month_label,\n"
            "       ROUND(SUM(t.amount_aed), 2) AS spend_aed\n"
            "FROM fin_slv_transactions t\n"
            "JOIN fin_dim_vendor v ON v.vendor_id = t.vendor_id\n"
            "WHERE v.canonical_name = 'Amazon'\n"
            "GROUP BY month_label\n"
            "ORDER BY month_label;"
        ),
    },
    {
        "q": "Which department's spend grew the most vs last month?",
        "sql": (
            "WITH this_m AS (\n"
            "  SELECT dept_name, total_aed FROM fin_gld_spend_by_dept_month\n"
            "  WHERE month_label = strftime('%Y-%m', date('now'))\n"
            "), prev_m AS (\n"
            "  SELECT dept_name, total_aed FROM fin_gld_spend_by_dept_month\n"
            "  WHERE month_label = strftime('%Y-%m', date('now', '-1 month'))\n"
            ")\n"
            "SELECT t.dept_name,\n"
            "       ROUND(t.total_aed - COALESCE(p.total_aed, 0), 2) AS delta_aed\n"
            "FROM this_m t LEFT JOIN prev_m p ON p.dept_name = t.dept_name\n"
            "ORDER BY delta_aed DESC LIMIT 1;"
        ),
    },
]


_FENCE_RE = re.compile(r"```(?:sql)?\s*(.*?)```", re.IGNORECASE | re.DOTALL)


def _build_messages(question: str) -> list[dict[str, str]]:
    msgs: list[dict[str, str]] = [
        {"role": "system", "content": SCHEMA_PROMPT},
    ]
    for ex in FEW_SHOT:
        msgs.append({"role": "user", "content": ex["q"]})
        msgs.append({
            "role": "assistant",
            "content": f"```sql\n{ex['sql']}\n```",
        })
    msgs.append({"role": "user", "content": question})
    return msgs


def _extract_sql(text: str) -> str:
    """Pull the SQL out of a fenced block; fall back to raw text."""
    if not text:
        return ""
    m = _FENCE_RE.search(text)
    body = m.group(1) if m else text
    body = body.strip().rstrip(";").strip()
    # Many models prepend "SQL:" or similar — strip it.
    body = re.sub(r"^(sql|sqlite)\s*:\s*", "", body, flags=re.IGNORECASE)
    return body + ";"


def _run_readonly(sql: str) -> dict:
    """Execute against a read-only URI connection (defence in depth)."""
    conn = sqlite3.connect(
        f"file:{DB_PATH}?mode=ro", uri=True, check_same_thread=False
    )
    conn.row_factory = sqlite3.Row
    try:
        t0 = time.perf_counter()
        rows = conn.execute(sql).fetchmany(MAX_ROWS)
        latency_ms = (time.perf_counter() - t0) * 1000
        return {
            "rows": [dict(r) for r in rows],
            "columns": list(rows[0].keys()) if rows else [],
            "row_count": len(rows),
            "truncated": len(rows) == MAX_ROWS,
            "latency_ms": round(latency_ms, 3),
        }
    except sqlite3.Error as e:
        return {"error": f"SQL execution error: {e}"}
    finally:
        conn.close()


def ask(question: str) -> dict:
    """End-to-end: question -> SQL -> rows."""
    if not question or not question.strip():
        return {"error": "empty question"}

    try:
        raw = llm_client.chat(_build_messages(question), max_tokens=400)
    except llm_client.LLMError as e:
        return {"error": str(e), "stage": "llm"}

    sql = _extract_sql(raw)
    ok, err = validate(sql)
    if not ok:
        # Some models output trailing comments; try one more strip.
        sql_clean = FORBIDDEN.sub("", sql)
        ok, err = validate(sql_clean)
        if ok:
            sql = sql_clean
    if not ok:
        return {
            "error": f"generated SQL failed safety check: {err}",
            "sql": sql,
            "raw_model_output": raw,
            "stage": "guard",
        }

    result = _run_readonly(sql)
    result["sql"] = sql
    result["question"] = question
    result["model"] = _model_label()

    # Augment with a Markdown narrative + an inferred chart hint so the
    # frontend can render rich, dynamic responses without a second LLM call.
    rows = result.get("rows", []) if isinstance(result, dict) else []
    cols = result.get("columns", []) if isinstance(result, dict) else []
    if isinstance(result, dict) and "error" not in result:
        result["narrative_md"] = build_narrative(question, rows, cols)
        result["chart_hint"] = infer_chart(rows, cols)
    return result


def _model_label() -> str:
    from .. import config
    return f"{config.LLM_PROVIDER}:{config.LLM_MODEL}"
