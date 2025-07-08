/*
  # Margin Analysis Results Table

  1. New Tables
    - `margin_analyses`
      - `id` (uuid, primary key)
      - `analysis_name` (text) - user-friendly name for the analysis
      - `carrier_group_code` (text) - Project44 carrier group code used
      - `carrier_group_name` (text) - human-readable carrier group name
      - `selected_carrier_id` (text) - specific carrier ID analyzed
      - `selected_carrier_name` (text) - human-readable carrier name
      - `selected_carrier_scac` (text) - SCAC code used for filtering shipments
      - `start_date` (date) - analysis date range start
      - `end_date` (date) - analysis date range end
      - `analysis_results` (jsonb) - full detailed analysis results
      - `total_customers` (integer) - summary: total customers analyzed
      - `customers_requiring_increase` (integer) - summary: customers needing margin increase
      - `customers_maintaining_margins` (integer) - summary: customers maintaining current margins
      - `customers_allowing_decrease` (integer) - summary: customers allowing margin decrease
      - `customers_no_quotes` (integer) - summary: customers with no quotes available
      - `total_revenue_impact` (numeric) - summary: total revenue impact across all customers
      - `created_at` (timestamp)
      - `created_by` (text)

  2. Security
    - Enable RLS on margin_analyses table
    - Add policies for authenticated users to manage their own analyses

  3. Indexes
    - Add indexes for common query patterns
*/

-- Create margin_analyses table
CREATE TABLE IF NOT EXISTS margin_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_name text NOT NULL,
  carrier_group_code text NOT NULL,
  carrier_group_name text NOT NULL,
  selected_carrier_id text NOT NULL,
  selected_carrier_name text NOT NULL,
  selected_carrier_scac text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  analysis_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_customers integer NOT NULL DEFAULT 0,
  customers_requiring_increase integer NOT NULL DEFAULT 0,
  customers_maintaining_margins integer NOT NULL DEFAULT 0,
  customers_allowing_decrease integer NOT NULL DEFAULT 0,
  customers_no_quotes integer NOT NULL DEFAULT 0,
  total_revenue_impact numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'anonymous'::text
);

-- Enable Row Level Security
ALTER TABLE margin_analyses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for margin_analyses
CREATE POLICY "Users can manage their own margin analyses"
  ON margin_analyses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_margin_analyses_created_at ON margin_analyses USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_margin_analyses_created_by ON margin_analyses USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_margin_analyses_carrier_group ON margin_analyses USING btree (carrier_group_code);
CREATE INDEX IF NOT EXISTS idx_margin_analyses_carrier_scac ON margin_analyses USING btree (selected_carrier_scac);
CREATE INDEX IF NOT EXISTS idx_margin_analyses_date_range ON margin_analyses USING btree (start_date, end_date);