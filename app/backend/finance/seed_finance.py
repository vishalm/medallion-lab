"""Synthetic CFO data generator for Act 9.

Two intentionally messy raw "source" tables (Concur expense submissions
+ corporate-card statements), three reference dimensions (department,
employee, vendor with aliases), one Silver, two Gold marts.

Seeded via RANDOM_SEED for deterministic demos. Designed to fit on a
laptop and run a 60-minute lecture without the dataset feeling fake.
"""
from __future__ import annotations

import json
import random
from datetime import date, timedelta

from faker import Faker

from ..config import (
    RANDOM_SEED, SEED_FINANCE_EMPLOYEES, SEED_FINANCE_MONTHS, SEED_FINANCE_VENDORS,
)
from ..db import connection

# ----- Reference data ------------------------------------------------------

DEPARTMENTS = [
    ("D01", "Marketing"),
    ("D02", "Sales"),
    ("D03", "Engineering"),
    ("D04", "HR"),
    ("D05", "Operations"),
]

# 20 vendors with realistic aliases. Aliases drive Silver canonicalization.
VENDOR_CATALOG = [
    ("V01", "Amazon",          ["AMZN MKTPLACE", "Amazon.ae", "AMAZON DIGITAL", "AMZN*PRIME"]),
    ("V02", "Uber",            ["UBER *TRIP", "UBER EATS", "UBER BV"]),
    ("V03", "Emirates Airline",["EMIRATES AIRLINE", "EMIRATES.COM", "EK FLIGHT"]),
    ("V04", "Marriott",        ["MARRIOTT HOTELS", "JW MARRIOTT DUBAI", "MARRIOTT BONVOY"]),
    ("V05", "Microsoft",       ["MSFT*AZURE", "MICROSOFT 365", "MS AZURE", "MICROSOFT CORP"]),
    ("V06", "Slack",           ["SLACK TECHNOLOGIES", "SLACK.COM"]),
    ("V07", "Zoom",            ["ZOOM.US", "ZOOM VIDEO COMM"]),
    ("V08", "LinkedIn",        ["LINKEDIN ADS", "LNKD*PREMIUM"]),
    ("V09", "Google",          ["GOOGLE ADS", "GOOGLE WORKSPACE", "GOOGLE*CLOUD"]),
    ("V10", "Meta Ads",        ["FACEBOOK ADS", "META PLATFORMS"]),
    ("V11", "Starbucks",       ["STARBUCKS COFFEE", "SBUX DUBAI MALL"]),
    ("V12", "Carrefour",       ["CARREFOUR HYPER", "CARREFOUR MARKET"]),
    ("V13", "Etisalat",        ["ETISALAT UAE", "ETISALAT BUSINESS"]),
    ("V14", "DEWA",            ["DUBAI ELECTRICITY", "DEWA UTILITY"]),
    ("V15", "Talabat",         ["TALABAT ORDER", "TALABAT REST"]),
    ("V16", "Apple",           ["APPLE.COM/BILL", "APPLE STORE DUBAI"]),
    ("V17", "Adobe",           ["ADOBE CC", "ADOBE SYSTEMS"]),
    ("V18", "WeWork",          ["WEWORK BUR DUBAI", "WEWORK MEMBERSHIP"]),
    ("V19", "DHL",             ["DHL EXPRESS", "DHL ECOMMERCE"]),
    ("V20", "Salik",           ["SALIK TOLL", "RTA SALIK"]),
]

# Loose category map per vendor. Used by both raw sources.
VENDOR_CATEGORY = {
    "Amazon": "Software", "Uber": "Travel", "Emirates Airline": "Travel",
    "Marriott": "Travel", "Microsoft": "Software", "Slack": "Software",
    "Zoom": "Software", "LinkedIn": "Marketing", "Google": "Marketing",
    "Meta Ads": "Marketing", "Starbucks": "Meals", "Carrefour": "Meals",
    "Etisalat": "Utilities", "DEWA": "Utilities", "Talabat": "Meals",
    "Apple": "Software", "Adobe": "Software", "WeWork": "Office",
    "DHL": "Office", "Salik": "Travel",
}

EXPENSE_CATEGORIES = ["Travel", "Meals", "Software", "Marketing", "Utilities", "Office"]

# Currency mix: most rows AED. Concur has both; corporate card is USD-only.
USD_TO_AED = 3.6725  # pegged-rate, fixed for deterministic demo


def _first_name_pool() -> list[str]:
    return [
        "Aarav", "Vivaan", "Aditya", "Ishaan", "Krishna", "Arjun", "Reyansh",
        "Sai", "Aryan", "Vihaan", "Ananya", "Diya", "Aadhya", "Kavya",
        "Pari", "Anaya", "Riya", "Sara", "Hassan", "Omar", "Khalid",
        "Yusuf", "Ahmed", "Fatima", "Layla", "Noor", "Aisha", "Mariam",
        "Ravi", "Priya",
    ]


def _last_name_pool() -> list[str]:
    return [
        "Sharma", "Verma", "Iyer", "Nair", "Reddy", "Khan", "Al Mansouri",
        "Al Maktoum", "Al Falasi", "Mehta", "Shah", "Patel", "Khanna",
        "Bhatia", "Thakur", "Joshi", "Roy", "Bose", "Khoury", "Hassan",
    ]


# ----- Schema -------------------------------------------------------------

FINANCE_TABLES = [
    "fin_gld_top_vendors",
    "fin_gld_spend_by_dept_month",
    "fin_slv_transactions",
    "fin_dim_vendor",
    "fin_dim_employee",
    "fin_dim_department",
    "fin_src_corporate_card",
    "fin_src_concur_expenses",
]


def _reset_finance_schema(conn) -> None:
    c = conn.cursor()
    for t in FINANCE_TABLES:
        c.execute(f"DROP TABLE IF EXISTS {t};")

    c.executescript(
        """
        -- Bronze (raw): two intentionally inconsistent source tables.
        -- Concur is employee-submitted; corporate-card is bank export.
        CREATE TABLE fin_src_concur_expenses (
            row_id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT NOT NULL,
            category TEXT,
            merchant TEXT,        -- raw, unnormalized
            amount REAL NOT NULL,
            currency TEXT NOT NULL,  -- AED or USD
            submitted_date TEXT NOT NULL,  -- mixed formats on purpose
            receipt_url TEXT
        );

        CREATE TABLE fin_src_corporate_card (
            row_id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_last4 TEXT NOT NULL,
            employee_id TEXT,         -- nullable on purpose
            vendor_str TEXT NOT NULL, -- gnarly: 'AMZN MKTPLACE', 'UBER *TRIP'
            amount_usd REAL NOT NULL, -- USD always
            posted_date TEXT NOT NULL  -- ISO date
        );

        -- Reference dims.
        CREATE TABLE fin_dim_department (
            dept_id TEXT PRIMARY KEY,
            dept_name TEXT NOT NULL
        );

        CREATE TABLE fin_dim_employee (
            employee_id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            dept_id TEXT NOT NULL,
            FOREIGN KEY (dept_id) REFERENCES fin_dim_department(dept_id)
        );

        CREATE TABLE fin_dim_vendor (
            vendor_id TEXT PRIMARY KEY,
            canonical_name TEXT NOT NULL,
            category TEXT NOT NULL,
            aliases_json TEXT NOT NULL  -- JSON array of raw alias strings
        );

        -- Silver: unioned, deduped, FX-normalized to AED, vendor-canonical.
        CREATE TABLE fin_slv_transactions (
            txn_id TEXT PRIMARY KEY,
            source TEXT NOT NULL,        -- 'concur' or 'card'
            employee_id TEXT,
            dept_id TEXT,
            vendor_id TEXT,
            category TEXT,
            txn_date TEXT NOT NULL,      -- ISO date
            amount_aed REAL NOT NULL,    -- always AED
            original_currency TEXT NOT NULL,
            original_amount REAL NOT NULL,
            FOREIGN KEY (employee_id) REFERENCES fin_dim_employee(employee_id),
            FOREIGN KEY (dept_id) REFERENCES fin_dim_department(dept_id),
            FOREIGN KEY (vendor_id) REFERENCES fin_dim_vendor(vendor_id)
        );

        CREATE INDEX idx_fin_slv_dept ON fin_slv_transactions(dept_id);
        CREATE INDEX idx_fin_slv_vendor ON fin_slv_transactions(vendor_id);
        CREATE INDEX idx_fin_slv_date ON fin_slv_transactions(txn_date);

        -- Gold marts.
        CREATE TABLE fin_gld_spend_by_dept_month (
            dept_id TEXT NOT NULL,
            dept_name TEXT NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            month_label TEXT NOT NULL,
            total_aed REAL NOT NULL,
            txn_count INTEGER NOT NULL,
            PRIMARY KEY (dept_id, year, month)
        );

        CREATE TABLE fin_gld_top_vendors (
            vendor_id TEXT PRIMARY KEY,
            canonical_name TEXT NOT NULL,
            category TEXT NOT NULL,
            total_aed REAL NOT NULL,
            txn_count INTEGER NOT NULL,
            pareto_rank INTEGER NOT NULL,
            cumulative_pct REAL NOT NULL
        );
        """
    )


# ----- Builders -----------------------------------------------------------


def _build_employees(rng: random.Random) -> list[dict]:
    firsts = _first_name_pool()
    lasts = _last_name_pool()
    employees = []
    for i in range(SEED_FINANCE_EMPLOYEES):
        dept = rng.choice(DEPARTMENTS)
        employees.append({
            "employee_id": f"E{i+1:03d}",
            "full_name": f"{rng.choice(firsts)} {rng.choice(lasts)}",
            "dept_id": dept[0],
        })
    return employees


def _build_vendors() -> list[dict]:
    out = []
    for vid, name, aliases in VENDOR_CATALOG[:SEED_FINANCE_VENDORS]:
        out.append({
            "vendor_id": vid,
            "canonical_name": name,
            "category": VENDOR_CATEGORY[name],
            "aliases_json": json.dumps(aliases),
        })
    return out


def _date_range_months(months: int) -> tuple[date, date]:
    """Return (start, end) for `months` ending at the most recent full month.

    Anchored to a fixed end so the demo is deterministic.
    """
    end = date(2026, 4, 30)
    # Walk back `months` months.
    y, m = end.year, end.month
    m -= (months - 1)
    while m <= 0:
        m += 12
        y -= 1
    start = date(y, m, 1)
    return start, end


def _random_date_in(start: date, end: date, rng: random.Random) -> date:
    delta = (end - start).days
    return start + timedelta(days=rng.randint(0, delta))


def _format_date_concur(d: date, rng: random.Random) -> str:
    """Concur is employee-submitted: mixed date formats on purpose."""
    fmt = rng.choices(["iso", "dmy", "mdy"], weights=[0.5, 0.35, 0.15])[0]
    if fmt == "iso":
        return d.isoformat()
    if fmt == "dmy":
        return d.strftime("%d/%m/%Y")
    return d.strftime("%m-%d-%Y")


def _build_concur(
    employees: list[dict], vendors: list[dict], rng: random.Random,
    start: date, end: date,
) -> list[dict]:
    rows = []
    n_rows = int(SEED_FINANCE_EMPLOYEES * SEED_FINANCE_MONTHS * 3.3)
    for _ in range(n_rows):
        emp = rng.choice(employees)
        vendor = rng.choice(vendors)
        canonical_aliases = json.loads(vendor["aliases_json"])
        # Concur sometimes uses canonical, sometimes alias.
        merchant_str = rng.choice([vendor["canonical_name"]] + canonical_aliases)
        category = vendor["category"]
        # Marketing dept skews high on marketing/travel; engineering on software.
        d = _random_date_in(start, end, rng)
        if rng.random() < 0.15:
            currency = "USD"
            amount = round(rng.uniform(8, 1200), 2)
        else:
            currency = "AED"
            amount = round(rng.uniform(15, 4500), 2)
        # Sprinkle a few large outliers to make anomaly detection visible.
        if rng.random() < 0.012:
            amount = round(rng.uniform(15000, 55000), 2)
        rows.append({
            "employee_id": emp["employee_id"],
            "category": category,
            "merchant": merchant_str,
            "amount": amount,
            "currency": currency,
            "submitted_date": _format_date_concur(d, rng),
            "receipt_url": f"https://expense.local/r/{rng.randint(1000, 99999)}.pdf",
        })
    return rows


def _build_corporate_card(
    employees: list[dict], vendors: list[dict], rng: random.Random,
    start: date, end: date,
) -> list[dict]:
    rows = []
    n_rows = int(SEED_FINANCE_EMPLOYEES * SEED_FINANCE_MONTHS * 2.0)
    for _ in range(n_rows):
        emp = rng.choice(employees)
        vendor = rng.choice(vendors)
        # Corporate card always uses an alias string (gnarly).
        aliases = json.loads(vendor["aliases_json"])
        vendor_str = rng.choice(aliases)
        # 5% of card rows have null employee_id (orphan — Silver step
        # recovers via card_last4 mapping or quarantines).
        emp_id = None if rng.random() < 0.05 else emp["employee_id"]
        d = _random_date_in(start, end, rng)
        amount_usd = round(rng.uniform(5, 800), 2)
        if rng.random() < 0.008:
            amount_usd = round(rng.uniform(3000, 12000), 2)
        rows.append({
            "card_last4": f"{rng.randint(1000, 9999)}",
            "employee_id": emp_id,
            "vendor_str": vendor_str,
            "amount_usd": amount_usd,
            "posted_date": d.isoformat(),
        })
    return rows


# ----- Public entry point -------------------------------------------------


def run_finance_seed() -> dict:
    """Idempotent: drops + rebuilds finance tables. Returns counts.

    Seeds Bronze (the two raw source tables) and reference dims only.
    Silver and Gold marts are built by the medallion pipeline so the
    demo can show the transform live.
    """
    Faker.seed(RANDOM_SEED)
    rng = random.Random(RANDOM_SEED)

    employees = _build_employees(rng)
    vendors = _build_vendors()
    start, end = _date_range_months(SEED_FINANCE_MONTHS)
    concur = _build_concur(employees, vendors, rng, start, end)
    card = _build_corporate_card(employees, vendors, rng, start, end)

    with connection() as conn:
        _reset_finance_schema(conn)
        c = conn.cursor()
        c.execute("BEGIN;")

        c.executemany(
            "INSERT INTO fin_dim_department VALUES (?, ?)",
            DEPARTMENTS,
        )
        c.executemany(
            "INSERT INTO fin_dim_employee VALUES (:employee_id, :full_name, :dept_id)",
            employees,
        )
        c.executemany(
            "INSERT INTO fin_dim_vendor VALUES (:vendor_id, :canonical_name, :category, :aliases_json)",
            vendors,
        )
        c.executemany(
            "INSERT INTO fin_src_concur_expenses "
            "(employee_id, category, merchant, amount, currency, submitted_date, receipt_url) "
            "VALUES (:employee_id, :category, :merchant, :amount, :currency, :submitted_date, :receipt_url)",
            concur,
        )
        c.executemany(
            "INSERT INTO fin_src_corporate_card "
            "(card_last4, employee_id, vendor_str, amount_usd, posted_date) "
            "VALUES (:card_last4, :employee_id, :vendor_str, :amount_usd, :posted_date)",
            card,
        )
        c.execute("COMMIT;")

    return {
        "departments": len(DEPARTMENTS),
        "employees": len(employees),
        "vendors": len(vendors),
        "concur_rows": len(concur),
        "card_rows": len(card),
        "silver_rows": 0,    # built by pipeline
        "spend_mart_rows": 0,
        "vendor_mart_rows": 0,
    }


def is_seeded() -> bool:
    """Cheap check used by main.py to decide if we re-seed on boot."""
    try:
        with connection() as conn:
            row = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='fin_src_concur_expenses'"
            ).fetchone()
            if not row:
                return False
            n = conn.execute("SELECT COUNT(*) FROM fin_src_concur_expenses").fetchone()[0]
            return n > 0
    except Exception:
        return False
