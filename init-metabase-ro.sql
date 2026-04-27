-- Init script for postgres container — runs ONCE on first boot.
-- Creates read-only user for backend + grants on dbt schemas.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metabase_ro') THEN
        CREATE USER metabase_ro WITH PASSWORD 'metabase_ro';
    END IF;
END
$$;

-- Schemas created later by dbt — grant default privileges so future tables auto-readable.
-- (The schemas themselves are created by dbt, not here.)

-- After dbt build runs for the first time, manually execute:
-- GRANT USAGE ON SCHEMA dbt_dev_gold, dbt_dev_silver, dbt_dev_bronze,
--                       dbt_dev_feature, dbt_dev_seeds TO metabase_ro;
-- GRANT SELECT ON ALL TABLES IN SCHEMA dbt_dev_gold, dbt_dev_silver,
--                                       dbt_dev_bronze, dbt_dev_feature,
--                                       dbt_dev_seeds TO metabase_ro;
