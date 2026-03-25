-- 2026 v1 actual source query
-- Source of truth:
--   SQL result internally confirmed equivalent to OBL All Historical Summary
-- Database:
--   postgres_staging
-- Notes:
--   - No schema changes
--   - Read-only only
--   - Native periods are sorted from enterprise cache start/end dates
--   - Deeptrade remains intentionally visible as unmapped

WITH program_sources AS (
  SELECT
    p.id::text AS program_id,
    p.name AS program_name,
    pds.table_name
  FROM programs p
  INNER JOIN program_data_sources pds
    ON p.id = pds.program_id
  WHERE pds.data_source_type = 'incentive_data'
    AND pds.table_name IN ('sui_incentives_cache', 'walrus_incentives_cache')
),
source_rows AS (
  SELECT
    'sui'::text AS source_key,
    ps.program_id,
    ps.program_name,
    c.id::text AS source_row_id,
    c.budget_program,
    c.incentive_program,
    c.protocol_name,
    c.parent_protocol_name,
    c.token_symbol,
    c.usd_value::numeric AS amount,
    c.start_timestamp::date AS period_start,
    c.end_timestamp::date AS period_end
  FROM sui_incentives_cache c
  INNER JOIN program_sources ps
    ON ps.table_name = 'sui_incentives_cache'
  WHERE c.start_timestamp >= DATE '2026-01-01'
    AND c.start_timestamp < DATE '2027-01-01'

  UNION ALL

  SELECT
    'walrus'::text AS source_key,
    ps.program_id,
    ps.program_name,
    c.id::text AS source_row_id,
    c.budget_program,
    c.incentive_program,
    c.protocol_name,
    c.parent_protocol_name,
    c.token_symbol,
    c.usd_value::numeric AS amount,
    c.start_timestamp::date AS period_start,
    c.end_timestamp::date AS period_end
  FROM walrus_incentives_cache c
  INNER JOIN program_sources ps
    ON ps.table_name = 'walrus_incentives_cache'
  WHERE c.start_timestamp >= DATE '2026-01-01'
    AND c.start_timestamp < DATE '2027-01-01'
),
mapped_protocols AS (
  SELECT
    'sui'::text AS source_key,
    program_id::text AS program_id,
    TRIM(parent_protocol_name) AS protocol_raw
  FROM sui_incentives_protocol_organization_mappings
  WHERE parent_protocol_name IS NOT NULL
    AND TRIM(parent_protocol_name) <> ''

  UNION ALL

  SELECT
    'walrus'::text AS source_key,
    program_id::text AS program_id,
    TRIM(parent_protocol_name) AS protocol_raw
  FROM walrus_incentives_protocol_organization_mappings
  WHERE parent_protocol_name IS NOT NULL
    AND TRIM(parent_protocol_name) <> ''
),
prepared_rows AS (
  SELECT
    sr.source_key,
    sr.program_id,
    sr.program_name,
    sr.source_row_id,
    COALESCE(NULLIF(TRIM(sr.token_symbol), ''), 'UNKNOWN') AS token_raw,
    sr.budget_program,
    sr.incentive_program,
    COALESCE(
      NULLIF(TRIM(sr.incentive_program), ''),
      NULLIF(TRIM(sr.budget_program), ''),
      'Unknown'
    ) AS program_raw,
    CASE
      WHEN sr.parent_protocol_name IS NOT NULL AND TRIM(sr.parent_protocol_name) <> ''
        THEN TRIM(sr.parent_protocol_name)
      WHEN sr.protocol_name IS NOT NULL AND TRIM(sr.protocol_name) <> ''
        THEN TRIM(sr.protocol_name)
      ELSE 'Unknown'
    END AS protocol_raw,
    CASE
      WHEN sr.protocol_name IS NOT NULL AND TRIM(sr.protocol_name) <> ''
        THEN TRIM(sr.protocol_name)
      WHEN sr.parent_protocol_name IS NOT NULL AND TRIM(sr.parent_protocol_name) <> ''
        THEN TRIM(sr.parent_protocol_name)
      ELSE 'Unknown'
    END AS pool_raw,
    sr.amount,
    sr.period_start,
    sr.period_end,
    TO_CHAR(sr.period_start, 'YYYY-MM-DD') || '_' || TO_CHAR(sr.period_end, 'YYYY-MM-DD') AS native_period,
    CASE UPPER(COALESCE(NULLIF(TRIM(sr.token_symbol), ''), 'UNKNOWN'))
      WHEN 'SUI' THEN 'SUI'
      WHEN 'DEEP' THEN 'DEEP'
      WHEN 'NS' THEN 'NS'
      WHEN 'SUINS' THEN 'NS'
      WHEN 'WAL' THEN 'Walrus'
      ELSE NULL
    END AS mapped_token
  FROM source_rows sr
),
period_calendar AS (
  SELECT
    native_period,
    period_start,
    period_end,
    'P' || LPAD(ROW_NUMBER() OVER (ORDER BY period_start, period_end)::text, 2, '0') AS period_id,
    TO_CHAR(period_start, 'Mon') AS month_label
  FROM (
    SELECT DISTINCT native_period, period_start, period_end
    FROM prepared_rows
  ) periods
),
actual_detail AS (
  SELECT
    pr.source_key,
    pr.program_name AS enterprise_program,
    pr.source_row_id,
    pr.token_raw,
    pr.program_raw,
    pr.protocol_raw,
    pr.pool_raw,
    pr.amount,
    pc.period_id,
    pr.period_start,
    pr.period_end,
    pc.month_label,
    pr.native_period,
    pr.mapped_token,
    COALESCE(NULLIF(TRIM(pr.budget_program), ''), 'Pending') AS mapped_budget_program,
    NULLIF(TRIM(pr.incentive_program), '') AS mapped_incentive_program,
    COALESCE(NULLIF(TRIM(pr.incentive_program), ''), pr.mapped_token, 'Unmapped') AS reporting_bucket,
    EXISTS (
      SELECT 1
      FROM mapped_protocols mp
      WHERE mp.source_key = pr.source_key
        AND mp.program_id = pr.program_id
        AND mp.protocol_raw = pr.protocol_raw
    ) AS is_protocol_mapped
  FROM prepared_rows pr
  INNER JOIN period_calendar pc
    ON pc.native_period = pr.native_period
)

-- Query 1: raw actual detail rows used for export
SELECT
  source_key,
  enterprise_program,
  source_row_id,
  token_raw,
  program_raw,
  protocol_raw,
  pool_raw,
  amount,
  period_id,
  period_start,
  period_end,
  month_label,
  native_period,
  mapped_token,
  mapped_budget_program,
  mapped_incentive_program,
  CASE
    WHEN mapped_token IS NOT NULL AND is_protocol_mapped THEN reporting_bucket
    ELSE 'Unmapped'
  END AS reporting_bucket,
  CASE
    WHEN mapped_token IS NOT NULL AND is_protocol_mapped THEN 'mapped'
    ELSE 'unmapped'
  END AS mapping_status
FROM actual_detail
ORDER BY period_start, period_end, token_raw, protocol_raw, pool_raw, source_row_id;

-- Query 2: monthly actuals grouped by token + program
-- Replace the final SELECT above with:
-- SELECT
--   CASE
--     WHEN mapped_token IS NOT NULL AND is_protocol_mapped THEN mapped_token
--     ELSE 'Unmapped'
--   END AS token,
--   CASE
--     WHEN mapped_token IS NOT NULL AND is_protocol_mapped THEN reporting_bucket
--     ELSE 'Unmapped'
--   END AS program,
--   month_label,
--   CASE
--     WHEN mapped_token IS NOT NULL AND is_protocol_mapped THEN 'mapped'
--     ELSE 'unmapped'
--   END AS mapping_status,
--   SUM(amount) AS actual
-- FROM actual_detail
-- GROUP BY 1, 2, 3, 4
-- ORDER BY 1, 2, 3, 4;

-- Query 3: OBL period actuals grouped by token + program
-- Replace the final SELECT above with:
-- SELECT
--   CASE
--     WHEN mapped_token IS NOT NULL AND is_protocol_mapped THEN mapped_token
--     ELSE 'Unmapped'
--   END AS token,
--   CASE
--     WHEN mapped_token IS NOT NULL AND is_protocol_mapped THEN reporting_bucket
--     ELSE 'Unmapped'
--   END AS program,
--   period_id,
--   MIN(period_start) AS period_start,
--   MAX(period_end) AS period_end,
--   CASE
--     WHEN mapped_token IS NOT NULL AND is_protocol_mapped THEN 'mapped'
--     ELSE 'unmapped'
--   END AS mapping_status,
--   SUM(amount) AS actual
-- FROM actual_detail
-- GROUP BY 1, 2, 3, 6
-- ORDER BY 1, 2, 3, 6;

-- Query 4: YTD totals by token
-- Replace the final SELECT above with:
-- SELECT
--   CASE
--     WHEN mapped_token IS NOT NULL AND is_protocol_mapped THEN mapped_token
--     ELSE 'Unmapped'
--   END AS token,
--   CASE
--     WHEN mapped_token IS NOT NULL AND is_protocol_mapped THEN 'mapped'
--     ELSE 'unmapped'
--   END AS mapping_status,
--   SUM(amount) AS actual_ytd
-- FROM actual_detail
-- GROUP BY 1, 2
-- ORDER BY 1, 2;
