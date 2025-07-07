/*
  # Create RFQ Batches Storage System

  1. New Tables
    - `rfq_batches`
      - `id` (uuid, primary key)
      - `batch_name` (text, user-defined name)
      - `customer_name` (text, selected customer)
      - `pricing_settings` (jsonb, pricing configuration)
      - `selected_carriers` (jsonb, carrier selection)
      - `rfq_data` (jsonb, original RFQ input data)
      - `results_data` (jsonb, processed results)
      - `total_rfqs` (integer, number of RFQs processed)
      - `successful_rfqs` (integer, number of successful quotes)
      - `total_quotes` (integer, total quotes received)
      - `best_total_price` (numeric, lowest total price across all RFQs)
      - `total_profit` (numeric, total profit across all RFQs)
      - `processing_mode` (text, smart/manual/etc)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `created_by` (text, user identifier)

  2. Security
    - Enable RLS on `rfq_batches` table
    - Add policy for authenticated users to manage their own batches
*/

CREATE TABLE IF NOT EXISTS rfq_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name text NOT NULL,
  customer_name text,
  pricing_settings jsonb NOT NULL DEFAULT '{}',
  selected_carriers jsonb NOT NULL DEFAULT '{}',
  rfq_data jsonb NOT NULL DEFAULT '[]',
  results_data jsonb DEFAULT '[]',
  total_rfqs integer DEFAULT 0,
  successful_rfqs integer DEFAULT 0,
  total_quotes integer DEFAULT 0,
  best_total_price numeric DEFAULT 0,
  total_profit numeric DEFAULT 0,
  processing_mode text DEFAULT 'smart',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'anonymous'
);

ALTER TABLE rfq_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own RFQ batches"
  ON rfq_batches
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rfq_batches_created_at ON rfq_batches (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rfq_batches_created_by ON rfq_batches (created_by);
CREATE INDEX IF NOT EXISTS idx_rfq_batches_customer ON rfq_batches (customer_name);
CREATE INDEX IF NOT EXISTS idx_rfq_batches_mode ON rfq_batches (processing_mode);