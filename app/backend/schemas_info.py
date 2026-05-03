"""Act 4 — static schema descriptions for the Star / Snowflake / Galaxy diagram.

Instead of reading this from SQLite (which is always a star here), we
describe the three arrangements symbolically so the frontend can morph
between them with animations.
"""

STAR = {
    "name": "Star",
    "facts": [
        {
            "id": "fact_sales",
            "name": "FACT_SALES",
            "measures": ["quantity", "amount"],
            "keys": ["sale_id", "date_id", "customer_id", "product_id", "store_id"],
        }
    ],
    "dims": [
        {"id": "dim_date", "name": "DIM_DATE",
         "attrs": ["day", "day_of_week", "month", "quarter", "year", "is_weekend"]},
        {"id": "dim_customer", "name": "DIM_CUSTOMER",
         "attrs": ["name", "age", "tier", "city", "country"]},
        {"id": "dim_product", "name": "DIM_PRODUCT",
         "attrs": ["name", "category", "brand", "base_price"]},
        {"id": "dim_store", "name": "DIM_STORE",
         "attrs": ["name", "format", "city", "country"]},
    ],
    "edges": [
        {"from": "fact_sales", "to": "dim_date"},
        {"from": "fact_sales", "to": "dim_customer"},
        {"from": "fact_sales", "to": "dim_product"},
        {"from": "fact_sales", "to": "dim_store"},
    ],
    "note": "One fact, dims fan out once. Fewest joins, simplest for BI tools.",
}

SNOWFLAKE = {
    "name": "Snowflake",
    "facts": STAR["facts"],
    "dims": STAR["dims"] + [
        {"id": "dim_category", "name": "DIM_CATEGORY", "attrs": ["category"]},
        {"id": "dim_brand", "name": "DIM_BRAND", "attrs": ["brand"]},
        {"id": "dim_city", "name": "DIM_CITY", "attrs": ["city"]},
        {"id": "dim_country", "name": "DIM_COUNTRY", "attrs": ["country"]},
    ],
    "edges": STAR["edges"] + [
        {"from": "dim_product", "to": "dim_category"},
        {"from": "dim_product", "to": "dim_brand"},
        {"from": "dim_store", "to": "dim_city"},
        {"from": "dim_city", "to": "dim_country"},
        {"from": "dim_customer", "to": "dim_city"},
    ],
    "note": "Normalize heavy dims into sub-dims. Saves storage, adds joins.",
}

GALAXY = {
    "name": "Galaxy",
    "facts": [
        *STAR["facts"],
        {
            "id": "fact_returns",
            "name": "FACT_RETURNS",
            "measures": ["quantity_returned", "refund_amount"],
            "keys": ["return_id", "date_id", "customer_id", "product_id", "store_id"],
        },
        {
            "id": "fact_inventory",
            "name": "FACT_INVENTORY",
            "measures": ["units_on_hand", "reorder_point"],
            "keys": ["date_id", "product_id", "store_id"],
        },
    ],
    "dims": STAR["dims"],
    "edges": STAR["edges"] + [
        {"from": "fact_returns", "to": "dim_date"},
        {"from": "fact_returns", "to": "dim_customer"},
        {"from": "fact_returns", "to": "dim_product"},
        {"from": "fact_returns", "to": "dim_store"},
        {"from": "fact_inventory", "to": "dim_date"},
        {"from": "fact_inventory", "to": "dim_product"},
        {"from": "fact_inventory", "to": "dim_store"},
    ],
    "note": "Multiple fact tables share conformed dims. Emerges as the business grows.",
}


ROLAP_MOLAP_HOLAP = [
    {
        "name": "ROLAP",
        "storage": "Relational DB (tables)",
        "pro": "Scales to huge data",
        "con": "Slower queries without caching",
        "today": "Snowflake, BigQuery, Redshift, Databricks",
        "winner": True,
    },
    {
        "name": "MOLAP",
        "storage": "Proprietary cube files",
        "pro": "Blazing-fast reads",
        "con": "Rebuilds, storage cost",
        "today": "SSAS, Essbase (mostly legacy)",
        "winner": False,
    },
    {
        "name": "HOLAP",
        "storage": "Cube for hot + DB for cold",
        "pro": "Best of both",
        "con": "Complex to run",
        "today": "Replaced by cloud warehouses + caching",
        "winner": False,
    },
]
