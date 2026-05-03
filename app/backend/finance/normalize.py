"""Normalisation helpers shared by the finance medallion pipeline.

Three teaching points wrapped here:
1. Vendor canonicalization via alias lookup (no fuzzy ML — just data).
2. Currency normalization to a single reporting currency (AED).
3. Date parsing across the messy formats the Concur source emits.
"""
from __future__ import annotations

import json
from datetime import date, datetime

from .seed_finance import USD_TO_AED


def parse_messy_date(s: str) -> str | None:
    """Parse the three formats Concur emits, return ISO yyyy-mm-dd."""
    if not s:
        return None
    s = s.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m-%d-%Y", "%d-%m-%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    # Last resort: ISO with time component.
    try:
        return datetime.fromisoformat(s).date().isoformat()
    except ValueError:
        return None


def to_aed(amount: float, currency: str) -> float:
    """FX-normalise to AED. Demo uses a fixed peg for determinism."""
    if currency == "AED":
        return round(float(amount), 2)
    if currency == "USD":
        return round(float(amount) * USD_TO_AED, 2)
    # Unknown currency -> treat as already-AED but flag upstream.
    return round(float(amount), 2)


def build_alias_index(vendor_rows: list[dict]) -> dict[str, str]:
    """Lowercase alias -> vendor_id index.

    Includes the canonical name as a self-alias so 'Amazon' -> V01 works
    even when Concur uses the canonical name directly.
    """
    idx: dict[str, str] = {}
    for v in vendor_rows:
        idx[v["canonical_name"].lower()] = v["vendor_id"]
        for alias in json.loads(v["aliases_json"]):
            idx[alias.lower()] = v["vendor_id"]
    return idx


def canonicalize_vendor(raw: str, alias_idx: dict[str, str]) -> str | None:
    """Map a raw merchant string to a vendor_id via case-insensitive
    substring or exact match. Returns None on miss."""
    if not raw:
        return None
    needle = raw.strip().lower()
    if needle in alias_idx:
        return alias_idx[needle]
    # Loose contains-match: pick the longest alias contained in the raw string.
    best: tuple[int, str] | None = None
    for alias, vid in alias_idx.items():
        if alias in needle or needle in alias:
            score = len(alias)
            if best is None or score > best[0]:
                best = (score, vid)
    return best[1] if best else None


def month_label(d: date | str) -> str:
    if isinstance(d, str):
        d = datetime.fromisoformat(d).date()
    return d.strftime("%b %Y")
