/*
  # Create mass_rfq_batches table

  1. New Tables
    - `mass_rfq_batches`
      - `id` (uuid, primary key)
      - `batch_name` (text, required)
      - `customer_name` (text, optional)
      - `branch_filter` (text, optional)
      - `sales_rep_filter` (text, optional)
      - `carrier_filter` (text, optional)
      - `date_range_start` (date, optional)
      - `date_range_end` (date, optional)
      - `shipment_count` (integer, default 0)
      - `total_quotes_received` (integer, default 0)
      - `best_total_price` (numeric, optional)
      - `total_profit` (numeric, optional)
      - `pricing_settings` (jsonb, required)
      - `selected_carriers` (jsonb, required)
      - `rfq_data` (jsonb, required)
      - `results_data` (jsonb, optional)
      - `created_at` (timestamptz, default now)
      - `updated_at` (timestamptz, default now)
      - `created_by` (text, default 'anonymous')

  2. Security
    - Enable RLS on `mass_rfq_batches` table
    - Add policy for authenticated users to manage their own batches

  3. Performance
    - Add indexes for created_at, created_by, and customer_name
*/

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS mass_rfq_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name text NOT NULL,
  customer_name text,
  branch_filter text,
  sales_rep_filter text,
  carrier_filter text,
  date_range_start date,
  date_range_end date,
  shipment_count integer DEFAULT 0 NOT NULL,
  total_quotes_received integer DEFAULT 0 NOT NULL,
  best_total_price numeric DEFAULT 0,
  total_profit numeric DEFAULT 0,
  pricing_settings jsonb NOT NULL,
  selected_carriers jsonb NOT NULL,
  rfq_data jsonb NOT NULL,
  results_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'anonymous'
);

-- Enable RLS only if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'mass_rfq_batches'
    AND n.nspname = 'public'
    AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE mass_rfq_batches ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop the policy if it exists, then create it
DROP POLICY IF EXISTS "Users can manage their own RFQ batches" ON mass_rfq_batches;

CREATE POLICY "Users can manage their own RFQ batches"
  ON mass_rfq_batches
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_mass_rfq_batches_created_at ON mass_rfq_batches (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mass_rfq_batches_created_by ON mass_rfq_batches (created_by);
CREATE INDEX IF NOT EXISTS idx_mass_rfq_batches_customer ON mass_rfq_batches (customer_name);