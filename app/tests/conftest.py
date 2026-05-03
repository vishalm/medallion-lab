"""Shared fixtures. We run seed once per test session against a throwaway
DB path so tests don't nuke a dev database.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest


@pytest.fixture(scope="session", autouse=True)
def isolated_db(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("data")
    os.environ["DATA_DIR"] = str(tmp)

    # Reduce seed sizes so tests are fast but still meaningful.
    os.environ.setdefault("SEED_ROWS", "800")
    os.environ.setdefault("SEED_CUSTOMERS", "120")
    os.environ.setdefault("SEED_PRODUCTS", "40")

    # Re-import config so the new DATA_DIR takes effect.
    import importlib
    from backend import config as cfg
    importlib.reload(cfg)

    from backend.seed import run_full_seed
    run_full_seed()

    yield tmp
