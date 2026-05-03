"""Build rich responses for the text-to-SQL flow.

Two helpers:

  - infer_chart(rows, cols)  -> picks a chart type based on column shapes
  - build_narrative(...)     -> generates a markdown narrative summarising
                                the result, ready for ReactMarkdown rendering

Both are deterministic — no second LLM call, so we keep the demo fast on
stage. Narratives are intentionally chatty (bullets, bold, emoji-free,
short paragraphs) so they read well to college students.
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any


# ----- type detection -----------------------------------------------------

_DATE_RE = re.compile(r"^\d{4}-\d{2}(-\d{2})?(T\d{2}:\d{2})?")


def _is_number(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _looks_like_date(v: Any) -> bool:
    if not isinstance(v, str):
        return False
    return bool(_DATE_RE.match(v))


def _classify_columns(rows: list[dict], cols: list[str]) -> tuple[list[str], list[str], list[str]]:
    """Return (text_cols, numeric_cols, date_cols)."""
    if not rows:
        return [], [], []
    text_cols: list[str] = []
    num_cols: list[str] = []
    date_cols: list[str] = []
    sample = rows[0]
    for c in cols:
        v = sample.get(c)
        if _is_number(v):
            num_cols.append(c)
        elif _looks_like_date(v):
            date_cols.append(c)
        else:
            text_cols.append(c)
    return text_cols, num_cols, date_cols


# ----- chart inference ----------------------------------------------------


def infer_chart(rows: list[dict], cols: list[str]) -> dict:
    """Pick the best chart for the given result.

    Types we emit (frontend has a renderer for each):
      stat       single big number (optional label)
      bar        horizontal bars, top-N
      donut      few categories, share of total
      area       time-series with gradient fill
      composed   bars + secondary line (e.g. value + cumulative %)
      radar      multi-dimension comparison
      table      fallback when nothing visual fits
      empty      no rows
    """
    n = len(rows)
    if n == 0:
        return {"type": "empty"}

    text_cols, num_cols, date_cols = _classify_columns(rows, cols)

    # Single-row -> a big stat (with optional label).
    if n == 1:
        if num_cols:
            return {
                "type": "stat",
                "value_col": num_cols[0],
                "label_col": text_cols[0] if text_cols else None,
            }
        return {"type": "table"}

    # 1 date col + 1 numeric col -> time series.
    if len(date_cols) == 1 and len(num_cols) >= 1 and len(text_cols) == 0:
        return {
            "type": "area",
            "label_col": date_cols[0],
            "value_col": num_cols[0],
        }

    # 1 text col + 2 numeric cols -> composed (value + secondary %)
    if len(text_cols) == 1 and len(num_cols) >= 2:
        return {
            "type": "composed",
            "label_col": text_cols[0],
            "value_col": num_cols[0],
            "secondary_col": num_cols[1],
        }

    # 1 text col + 1 numeric col -> bar (or donut if few categories)
    if len(text_cols) == 1 and len(num_cols) == 1:
        chart_type = "donut" if 2 <= n <= 6 else "bar"
        return {
            "type": chart_type,
            "label_col": text_cols[0],
            "value_col": num_cols[0],
        }

    # Many cols -> just a table.
    return {"type": "table"}


# ----- narrative ---------------------------------------------------------


def _fmt_amount(v: float) -> str:
    if v >= 1_000_000:
        return f"{v/1_000_000:.2f}M AED"
    if v >= 1_000:
        return f"{v/1_000:.1f}K AED"
    return f"{v:,.0f} AED"


def _fmt_value(col: str, v: Any) -> str:
    if v is None:
        return "—"
    if _is_number(v):
        if "aed" in col.lower() or "amount" in col.lower() or "spend" in col.lower():
            return _fmt_amount(float(v))
        if isinstance(v, float):
            return f"{v:,.2f}"
        return f"{v:,}"
    return str(v)


def _looks_amount_col(col: str) -> bool:
    c = col.lower()
    return any(k in c for k in ("aed", "amount", "spend", "total", "sum"))


def build_narrative(question: str, rows: list[dict], cols: list[str]) -> str:
    """Generate a rich Markdown narrative.

    Intentionally chatty + bulleted so it renders well in ReactMarkdown.
    Avoids invention — only restates facts visible in the result set.
    """
    n = len(rows)
    if n == 0:
        return (
            "**No rows matched.**\n\n"
            "The SQL ran without errors but the result set is empty. "
            "Try widening the time window, relaxing the filter, "
            "or asking it differently."
        )

    text_cols, num_cols, date_cols = _classify_columns(rows, cols)
    primary_num = num_cols[0] if num_cols else None
    primary_text = text_cols[0] if text_cols else (date_cols[0] if date_cols else None)

    parts: list[str] = []

    # ----- Top-line ------------------------------------------------------

    if n == 1:
        r = rows[0]
        if primary_num and primary_text:
            parts.append(
                f"**{r[primary_text]}** → **{_fmt_value(primary_num, r[primary_num])}**"
            )
        elif primary_num:
            parts.append(f"**Result:** {_fmt_value(primary_num, r[primary_num])}")
        else:
            kvs = ", ".join(f"**{c}**: {r[c]}" for c in cols[:4])
            parts.append(kvs)
    else:
        parts.append(f"Found **{n}** rows.")

    # ----- Highlights bullets (only for multi-row + a numeric col) -------

    if n >= 2 and primary_num:
        try:
            sorted_rows = sorted(
                rows, key=lambda r: float(r.get(primary_num) or 0), reverse=True
            )
        except (TypeError, ValueError):
            sorted_rows = rows

        top = sorted_rows[: min(5, n)]
        bullets: list[str] = []
        for r in top:
            label = r[primary_text] if primary_text else "row"
            val = _fmt_value(primary_num, r[primary_num])
            extras = ""
            # Add a secondary numeric column if present.
            if len(num_cols) >= 2:
                sec = num_cols[1]
                extras = f" · {sec}: **{_fmt_value(sec, r[sec])}**"
            bullets.append(f"- **{label}** — {val}{extras}")
        if bullets:
            parts.append("**Top results**\n" + "\n".join(bullets))

        # Aggregate insight when the value column looks like money.
        if _looks_amount_col(primary_num):
            try:
                total = sum(float(r.get(primary_num) or 0) for r in rows)
                top_share = (
                    sum(float(r.get(primary_num) or 0) for r in top) / total * 100.0
                    if total else 0.0
                )
                if top_share and len(top) < n:
                    parts.append(
                        f"_The top {len(top)} account for **{top_share:.0f}%** "
                        f"of the total ({_fmt_amount(total)})._"
                    )
                elif total:
                    parts.append(f"_Total: **{_fmt_amount(total)}**._")
            except (TypeError, ValueError):
                pass

    # ----- Pattern call-outs --------------------------------------------

    if date_cols and primary_num and n >= 3:
        try:
            ds = [datetime.fromisoformat(str(r[date_cols[0]])) for r in rows]
            vs = [float(r.get(primary_num) or 0) for r in rows]
            if vs[-1] > vs[0] * 1.15:
                parts.append("_Trend: clearly **rising** over the window._")
            elif vs[-1] < vs[0] * 0.85:
                parts.append("_Trend: **falling** over the window._")
        except (TypeError, ValueError):
            pass

    return "\n\n".join(parts)
