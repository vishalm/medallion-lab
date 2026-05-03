"""Synthetic retail + banking + telecom data generator.

Retail is the default theme (matches slide 11: Ravi / Dubai Mall / iPhones).
Banking and telecom scenarios overlay the same medallion plumbing so Acts
5 and 6 can toggle industry without changing the pipeline code.

Seeded via RANDOM_SEED so every lecture boot produces identical data.
"""
from __future__ import annotations

import random
from datetime import date, timedelta

from faker import Faker

from .config import (
    RANDOM_SEED, SEED_BANKING, SEED_CUSTOMERS, SEED_OLTP, SEED_PRODUCTS,
    SEED_ROWS, SEED_STORES, SEED_TELECOM,
)
from .db import connection

PRODUCT_CATALOG = [
    ("Electronics", ["iPhone 15", "Galaxy S24", "Pixel 8", "iPad Air", "MacBook Air", "Surface Pro",
                     "AirPods Pro", "Sony WH-1000XM5", "Kindle Paperwhite", "Apple Watch"]),
    ("Apparel", ["Levi's 501", "Nike Air Force 1", "Adidas Ultraboost", "Uniqlo Airism Tee",
                 "Zara Blazer", "H&M Hoodie", "Puma Track Pants", "Gap Chinos"]),
    ("Grocery", ["Basmati Rice 5kg", "Olive Oil 1L", "Tata Tea Gold", "Parle-G 800g",
                 "Amul Butter 500g", "Haldiram Bhujia", "Lays Classic", "Coca-Cola 2L"]),
    ("Home", ["Philips Kettle", "Dyson V11", "IKEA Malm Desk", "Samsung 55in TV",
              "Bajaj Ceiling Fan", "Prestige Pressure Cooker", "Bosch Washing Machine"]),
    ("Beauty", ["Lakme Lipstick", "Nivea Cream", "Head & Shoulders", "Dove Soap",
                "Maybelline Mascara", "Old Spice Deodorant"]),
]

CITIES = [
    ("Dubai", "UAE"), ("Abu Dhabi", "UAE"), ("Sharjah", "UAE"),
    ("Mumbai", "India"), ("Delhi", "India"), ("Bangalore", "India"),
    ("Chennai", "India"), ("Hyderabad", "India"), ("Pune", "India"),
    ("Kolkata", "India"), ("Noida", "India"), ("Gurgaon", "India"),
]

STORE_FORMATS = ["Mall", "High Street", "Online", "Pop-up"]
TIERS = ["Bronze", "Silver", "Gold", "Platinum"]
CHANNELS = ["web", "mobile", "store", "partner"]


def _derive_brand(product_name: str) -> str:
    return product_name.split(" ", 1)[0]


def reset_schema(conn) -> None:
    c = conn.cursor()
    for table in [
        "gold_fact_sales", "gold_dim_customer", "gold_dim_product",
        "gold_dim_date", "gold_dim_store",
        "silver_sales", "bronze_sales_raw",
        "oltp_transactions",
        "telecom_calls", "banking_transactions",
        "data_quality_events",
    ]:
        c.execute(f"DROP TABLE IF EXISTS {table};")

    c.executescript(
        """
        CREATE TABLE bronze_sales_raw (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_system TEXT NOT NULL,
            ingested_at TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            is_dirty INTEGER NOT NULL DEFAULT 0,
            dirt_kind TEXT
        );

        CREATE TABLE silver_sales (
            sale_id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            store_id TEXT NOT NULL,
            sale_ts TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            amount REAL NOT NULL,
            channel TEXT NOT NULL,
            currency TEXT NOT NULL
        );

        CREATE TABLE gold_dim_date (
            date_id TEXT PRIMARY KEY,
            day INTEGER NOT NULL,
            day_of_week TEXT NOT NULL,
            month INTEGER NOT NULL,
            month_name TEXT NOT NULL,
            quarter INTEGER NOT NULL,
            year INTEGER NOT NULL,
            is_weekend INTEGER NOT NULL
        );

        CREATE TABLE gold_dim_customer (
            customer_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER NOT NULL,
            tier TEXT NOT NULL,
            city TEXT NOT NULL,
            country TEXT NOT NULL,
            signup_year INTEGER NOT NULL
        );

        CREATE TABLE gold_dim_product (
            product_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            brand TEXT NOT NULL,
            base_price REAL NOT NULL
        );

        CREATE TABLE gold_dim_store (
            store_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            format TEXT NOT NULL,
            city TEXT NOT NULL,
            country TEXT NOT NULL
        );

        CREATE TABLE gold_fact_sales (
            sale_id TEXT PRIMARY KEY,
            date_id TEXT NOT NULL,
            customer_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            store_id TEXT NOT NULL,
            channel TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            amount REAL NOT NULL,
            FOREIGN KEY (date_id) REFERENCES gold_dim_date(date_id),
            FOREIGN KEY (customer_id) REFERENCES gold_dim_customer(customer_id),
            FOREIGN KEY (product_id) REFERENCES gold_dim_product(product_id),
            FOREIGN KEY (store_id) REFERENCES gold_dim_store(store_id)
        );

        CREATE INDEX idx_fact_date ON gold_fact_sales(date_id);
        CREATE INDEX idx_fact_customer ON gold_fact_sales(customer_id);
        CREATE INDEX idx_fact_product ON gold_fact_sales(product_id);
        CREATE INDEX idx_fact_store ON gold_fact_sales(store_id);

        CREATE TABLE oltp_transactions (
            txn_id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            amount REAL NOT NULL,
            ts TEXT NOT NULL,
            status TEXT NOT NULL
        );

        CREATE INDEX idx_oltp_customer ON oltp_transactions(customer_id);
        CREATE INDEX idx_oltp_ts ON oltp_transactions(ts);

        CREATE TABLE banking_transactions (
            txn_id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            amount REAL NOT NULL,
            merchant TEXT NOT NULL,
            ts TEXT NOT NULL,
            is_fraud INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE telecom_calls (
            call_id TEXT PRIMARY KEY,
            subscriber_id TEXT NOT NULL,
            duration_sec INTEGER NOT NULL,
            data_mb REAL NOT NULL,
            dropped INTEGER NOT NULL DEFAULT 0,
            ts TEXT NOT NULL
        );

        CREATE TABLE data_quality_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            layer TEXT NOT NULL,
            kind TEXT NOT NULL,
            detail TEXT,
            rows_affected INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        """
    )


def _build_customers(faker: Faker, rng: random.Random) -> list[dict]:
    customers = []
    for i in range(SEED_CUSTOMERS):
        city, country = rng.choice(CITIES)
        customers.append({
            "customer_id": f"C{i+1:05d}",
            "name": faker.name(),
            "age": rng.randint(18, 72),
            "tier": rng.choices(TIERS, weights=[0.45, 0.30, 0.20, 0.05])[0],
            "city": city,
            "country": country,
            "signup_year": rng.randint(2018, 2025),
        })
    return customers


def _build_products(rng: random.Random) -> list[dict]:
    flat = []
    for category, names in PRODUCT_CATALOG:
        for name in names:
            flat.append((category, name))
    products = []
    for i, (category, name) in enumerate(flat[:SEED_PRODUCTS]):
        products.append({
            "product_id": f"P{i+1:04d}",
            "name": name,
            "category": category,
            "brand": _derive_brand(name),
            "base_price": round(rng.uniform(9.99, 2499.00), 2),
        })
    return products


def _build_stores(rng: random.Random) -> list[dict]:
    stores = []
    for i in range(SEED_STORES):
        city, country = rng.choice(CITIES)
        fmt = rng.choice(STORE_FORMATS)
        stores.append({
            "store_id": f"S{i+1:03d}",
            "name": f"{city} {fmt}",
            "format": fmt,
            "city": city,
            "country": country,
        })
    return stores


def _build_date_dim(start: date, end: date) -> list[dict]:
    dates = []
    d = start
    while d <= end:
        dates.append({
            "date_id": d.isoformat(),
            "day": d.day,
            "day_of_week": d.strftime("%A"),
            "month": d.month,
            "month_name": d.strftime("%B"),
            "quarter": (d.month - 1) // 3 + 1,
            "year": d.year,
            "is_weekend": 1 if d.weekday() >= 5 else 0,
        })
        d += timedelta(days=1)
    return dates


def _build_sales(
    customers: list[dict], products: list[dict], stores: list[dict],
    dates: list[dict], rng: random.Random, n_rows: int,
) -> list[dict]:
    sales = []
    for i in range(n_rows):
        c = rng.choice(customers)
        p = rng.choice(products)
        s = rng.choice(stores)
        d = rng.choice(dates)
        qty = rng.choices([1, 2, 3, 4, 5], weights=[0.5, 0.25, 0.15, 0.07, 0.03])[0]
        tier_bump = {"Bronze": 0.0, "Silver": 0.02, "Gold": 0.05, "Platinum": 0.10}[c["tier"]]
        unit = round(p["base_price"] * (1 - tier_bump) * rng.uniform(0.85, 1.15), 2)
        sales.append({
            "sale_id": f"T{i+1:07d}",
            "customer_id": c["customer_id"],
            "product_id": p["product_id"],
            "store_id": s["store_id"],
            "sale_ts": f"{d['date_id']}T{rng.randint(8, 22):02d}:{rng.randint(0, 59):02d}:00",
            "quantity": qty,
            "unit_price": unit,
            "amount": round(qty * unit, 2),
            "channel": rng.choice(CHANNELS),
            "currency": "AED" if c["country"] == "UAE" else "INR",
        })
    return sales


def _build_oltp(customers: list[dict], rng: random.Random, n: int = SEED_OLTP) -> list[dict]:
    txns = []
    for i in range(n):
        c = rng.choice(customers)
        txns.append({
            "txn_id": f"TX{i+1:07d}",
            "customer_id": c["customer_id"],
            "amount": round(rng.uniform(5, 4200), 2),
            "ts": f"2026-04-{rng.randint(1, 21):02d}T{rng.randint(0, 23):02d}:{rng.randint(0, 59):02d}:{rng.randint(0, 59):02d}",
            "status": rng.choices(["ok", "pending", "reversed"], weights=[0.94, 0.04, 0.02])[0],
        })
    return txns


def _build_banking(customers: list[dict], rng: random.Random, n: int = SEED_BANKING) -> list[dict]:
    merchants = ["Amazon", "Swiggy", "Uber", "Starbucks", "Carrefour", "Apple", "Netflix",
                 "BookMyShow", "Jio", "Airtel", "unknown-overseas", "unknown-night-atm"]
    txns = []
    for i in range(n):
        c = rng.choice(customers)
        is_fraud = 1 if rng.random() < 0.03 else 0
        if is_fraud:
            amount = round(rng.uniform(2500, 12000), 2)
            merchant = rng.choice(["unknown-overseas", "unknown-night-atm"])
        else:
            amount = round(rng.uniform(2, 800), 2)
            merchant = rng.choice(merchants[:-2])
        txns.append({
            "txn_id": f"BT{i+1:07d}",
            "account_id": c["customer_id"],
            "amount": amount,
            "merchant": merchant,
            "ts": f"2026-04-{rng.randint(1, 21):02d}T{rng.randint(0, 23):02d}:{rng.randint(0, 59):02d}:{rng.randint(0, 59):02d}",
            "is_fraud": is_fraud,
        })
    return txns


def _build_telecom(customers: list[dict], rng: random.Random, n: int = SEED_TELECOM) -> list[dict]:
    calls = []
    for i in range(n):
        c = rng.choice(customers)
        dropped = 1 if rng.random() < 0.06 else 0
        duration = rng.randint(5, 900) if not dropped else rng.randint(1, 30)
        calls.append({
            "call_id": f"CL{i+1:07d}",
            "subscriber_id": c["customer_id"],
            "duration_sec": duration,
            "data_mb": round(rng.uniform(0.0, 350.0), 2),
            "dropped": dropped,
            "ts": f"2026-04-{rng.randint(1, 21):02d}T{rng.randint(0, 23):02d}:{rng.randint(0, 59):02d}:{rng.randint(0, 59):02d}",
        })
    return calls


def run_full_seed() -> dict:
    """Idempotent: drops + rebuilds every table. Returns counts."""
    faker = Faker()
    Faker.seed(RANDOM_SEED)
    rng = random.Random(RANDOM_SEED)

    customers = _build_customers(faker, rng)
    products = _build_products(rng)
    stores = _build_stores(rng)
    dates = _build_date_dim(date(2026, 1, 1), date(2026, 4, 21))
    sales = _build_sales(customers, products, stores, dates, rng, SEED_ROWS)
    oltp = _build_oltp(customers, rng)
    banking = _build_banking(customers, rng)
    telecom = _build_telecom(customers, rng)

    with connection() as conn:
        reset_schema(conn)
        c = conn.cursor()
        c.execute("BEGIN;")

        c.executemany(
            "INSERT INTO gold_dim_customer VALUES (:customer_id,:name,:age,:tier,:city,:country,:signup_year)",
            customers,
        )
        c.executemany(
            "INSERT INTO gold_dim_product VALUES (:product_id,:name,:category,:brand,:base_price)",
            products,
        )
        c.executemany(
            "INSERT INTO gold_dim_store VALUES (:store_id,:name,:format,:city,:country)",
            stores,
        )
        c.executemany(
            "INSERT INTO gold_dim_date VALUES (:date_id,:day,:day_of_week,:month,:month_name,:quarter,:year,:is_weekend)",
            dates,
        )
        c.executemany(
            "INSERT INTO oltp_transactions VALUES (:txn_id,:customer_id,:amount,:ts,:status)",
            oltp,
        )
        c.executemany(
            "INSERT INTO banking_transactions VALUES (:txn_id,:account_id,:amount,:merchant,:ts,:is_fraud)",
            banking,
        )
        c.executemany(
            "INSERT INTO telecom_calls VALUES (:call_id,:subscriber_id,:duration_sec,:data_mb,:dropped,:ts)",
            telecom,
        )

        # Bronze = raw JSON payloads, Silver = typed rows, Gold = star schema fact.
        # We seed all three layers so the UI has data on first load.
        import json
        bronze_rows = [
            {
                "source_system": "pos-retail-v1",
                "ingested_at": "2026-04-21T00:00:00",
                "payload_json": json.dumps(s),
                "is_dirty": 0,
                "dirt_kind": None,
            }
            for s in sales
        ]
        c.executemany(
            "INSERT INTO bronze_sales_raw (source_system, ingested_at, payload_json, is_dirty, dirt_kind) "
            "VALUES (:source_system,:ingested_at,:payload_json,:is_dirty,:dirt_kind)",
            bronze_rows,
        )

        c.executemany(
            "INSERT INTO silver_sales VALUES "
            "(:sale_id,:customer_id,:product_id,:store_id,:sale_ts,:quantity,:unit_price,:amount,:channel,:currency)",
            sales,
        )

        fact_rows = [
            {
                "sale_id": s["sale_id"],
                "date_id": s["sale_ts"][:10],
                "customer_id": s["customer_id"],
                "product_id": s["product_id"],
                "store_id": s["store_id"],
                "channel": s["channel"],
                "quantity": s["quantity"],
                "amount": s["amount"],
            }
            for s in sales
        ]
        c.executemany(
            "INSERT INTO gold_fact_sales VALUES "
            "(:sale_id,:date_id,:customer_id,:product_id,:store_id,:channel,:quantity,:amount)",
            fact_rows,
        )
        c.execute("COMMIT;")

    return {
        "customers": len(customers),
        "products": len(products),
        "stores": len(stores),
        "dates": len(dates),
        "bronze": len(sales),
        "silver": len(sales),
        "gold_fact": len(sales),
        "oltp": len(oltp),
        "banking": len(banking),
        "telecom": len(telecom),
    }
