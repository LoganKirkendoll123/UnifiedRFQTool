/*
  # Simplify Margin Analyses Table

  1. Changes
    - Remove complex individual columns
    - Keep only essential fields: id, analysis_name, analysis_data, created_at, created_by
    - Store all analysis results as a single JSON payload

  2. Security
    - Maintain existing RLS policies
*/

-- Drop existing indexes first
DROP INDEX IF EXISTS idx_margin_analyses_carrier_group;
DROP INDEX IF EXISTS idx_margin_analyses_carrier_scac;
DROP INDEX IF EXISTS idx_margin_analyses_date_range;

-- Remove unnecessary columns, keeping only essential ones
ALTER TABLE margin_analyses DROP COLUMN IF EXISTS carrier_group_code;
ALTER TABLE margin_analyses DROP COLUMN IF EXISTS carrier_group_name;
ALTER TABLE margin_analyses DROP COLUMN IF EXISTS selected_carrier_id;
ALTER TABLE margin_analyses DROP COLUMN IF EXISTS selected_carrier_name;
ALTER TABLE margin_analyses DROP COLUMN IF EXISTS selected_carrier_scac;
ALTER TABLE margin_analyses DROP COLUMN IF EXISTS start_date;
ALTER TABLE margin_analyses DROP COLUMN IF EXISTS end_date;
ALTER TABLE margin_analyses DROP COLUMN IF EXISTS total_customers;
ALTER TABLE margin_analyses DROP COLUMN IF EXISTS customers_requiring_increase;
ALTER TABLE margin_analyses DROP COLUMN IF EXISTS customers_maintaining_margins;
ALTER TABLE margin_analyses DROP COLUMN IF EXISTS customers_allowing_decrease;
ALTER TABLE margin_analyses DROP COLUMN IF EXISTS customers_no_quotes;
ALTER TABLE margin_analyses DROP COLUMN IF EXISTS total_revenue_impact;

-- Rename analysis_results to analysis_data for clarity
ALTER TABLE margin_analyses RENAME COLUMN analysis_results TO analysis_data;

-- Ensure analysis_data has proper default
ALTER TABLE margin_analyses ALTER COLUMN analysis_data SET DEFAULT '{}'::jsonb;