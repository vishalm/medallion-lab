"""Centralised, env-driven config.

Reads `.env` if present (project root). Every setting has a sensible
default so a fresh clone runs with zero edits — except the LLM provider,
which defaults to local Ollama and needs Ollama running for Act 9.
"""
from __future__ import annotations

import os
from pathlib import Path

# Load .env from the project root (two levels up from this file:
# app/backend/config.py -> app/backend -> app -> project_root).
try:
    from dotenv import load_dotenv
    _PROJECT_ROOT = Path(__file__).resolve().parents[2]
    _ENV_PATH = _PROJECT_ROOT / ".env"
    if _ENV_PATH.exists():
        load_dotenv(_ENV_PATH, override=False)
except ImportError:
    # dotenv is optional; fall back to plain os.environ if not installed.
    pass


# ----- Server / data paths -------------------------------------------------

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).parent / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "medallion.db"

STATIC_DIR = Path(
    os.environ.get("STATIC_DIR", Path(__file__).parent.parent / "frontend" / "dist")
)


# ----- Seed scale (Acts 1-8) ----------------------------------------------

SEED_ROWS = int(os.environ.get("SEED_ROWS", 18000))
SEED_CUSTOMERS = int(os.environ.get("SEED_CUSTOMERS", 1200))
SEED_PRODUCTS = int(os.environ.get("SEED_PRODUCTS", 80))
SEED_STORES = int(os.environ.get("SEED_STORES", 24))
SEED_OLTP = int(os.environ.get("SEED_OLTP", 6000))
SEED_BANKING = int(os.environ.get("SEED_BANKING", 5000))
SEED_TELECOM = int(os.environ.get("SEED_TELECOM", 7500))


# ----- Seed scale (Act 9 — CFO Finance Lab) -------------------------------

SEED_FINANCE_MONTHS = int(os.environ.get("SEED_FINANCE_MONTHS", 12))
SEED_FINANCE_EMPLOYEES = int(os.environ.get("SEED_FINANCE_EMPLOYEES", 30))
SEED_FINANCE_VENDORS = int(os.environ.get("SEED_FINANCE_VENDORS", 20))


# ----- LLM / AI configuration --------------------------------------------
#
# Provider-agnostic, env-driven. Default points at local Ollama via its
# OpenAI-compatible /v1 endpoint so a fresh clone works offline.
# Swap providers by changing .env only — no code changes.

LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "ollama").lower()
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_MODEL = os.environ.get("LLM_MODEL", "qwen2.5-coder:1.5b")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "ollama")
LLM_TIMEOUT_SECONDS = float(os.environ.get("LLM_TIMEOUT_SECONDS", 30))
LLM_TEMPERATURE = float(os.environ.get("LLM_TEMPERATURE", 0.1))

# Azure-specific (only read when LLM_PROVIDER == "azure")
LLM_AZURE_DEPLOYMENT = os.environ.get("LLM_AZURE_DEPLOYMENT", "")
LLM_AZURE_API_VERSION = os.environ.get("LLM_AZURE_API_VERSION", "")


# ----- Reproducibility ----------------------------------------------------

RANDOM_SEED = 20260421
