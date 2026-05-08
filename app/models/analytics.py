"""SQLAlchemy Core table definitions for analytical (dbt) tables.

These are read-only tables managed by dbt — no ORM mappings needed,
just Table objects for type-safe query building.
"""
from __future__ import annotations

from sqlalchemy import Column, MetaData, Numeric, String, Table, Boolean, Integer, Float

# dbt tables live in different schemas from app tables
analytics_meta = MetaData()

fct_jobs_daily = Table(
    "fct_jobs_daily",
    analytics_meta,
    Column("source", String),
    Column("source_job_id", String),
    Column("title", String),
    Column("job_category", String),
    Column("company_id", String),
    Column("company_name", String),
    Column("company_size_bucket", String),
    Column("salary_vnd_monthly_min", Numeric),
    Column("salary_vnd_monthly_max", Numeric),
    Column("salary_vnd_monthly_avg", Numeric),
    Column("job_level", String),
    Column("city_canonical", String),
    Column("region", String),
    Column("degree_label", String),
    Column("is_active", Boolean),
    Column("is_expired", Boolean),
    Column("num_of_views", Integer),
    Column("num_of_applications", Integer),
    Column("posted_at", String),
    Column("expired_at", String),
    Column("parsed_at", String),
    Column("snapshot_date", String),
    schema="dbt_dev_gold",
)

silver_job_detail = Table(
    "silver_job_detail",
    analytics_meta,
    Column("source", String),
    Column("source_job_id", String),
    Column("title", String),
    Column("company_name", String),
    Column("city_canonical", String),
    Column("job_level", String),
    Column("job_category", String),
    Column("salary_vnd_monthly_avg", Numeric),
    Column("source_url", String),
    Column("posted_at", String),
    Column("primary_address", String),
    Column("city_raw_vi", String),
    schema="dbt_dev_silver",
)

silver_skill_long = Table(
    "silver_skill_long",
    analytics_meta,
    Column("source", String),
    Column("source_job_id", String),
    Column("skill_name_norm", String),
    Column("skill_weight", Float),
    schema="dbt_dev_silver",
)
