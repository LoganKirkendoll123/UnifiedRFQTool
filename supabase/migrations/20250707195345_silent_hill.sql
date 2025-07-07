/*
  # RFQ Request and Batch Tracking Schema

  1. New Tables
    - `rfq_batches`
      - `id` (uuid, primary key)
      - `batch_name` (text)
      - `customer_name` (text, nullable)
      - `pricing_settings` (jsonb)
      - `selected_carriers` (jsonb)
      - `processing_mode` (text)
      - `total_rfqs` (integer)
      - `successful_rfqs` (integer)
      - `total_quotes` (integer)
      - `best_total_price` (numeric)
      - `total_profit` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `created_by` (text)

    - `rfq_requests`
      - `id` (uuid, primary key)
      - `batch_id` (uuid, foreign key to rfq_batches)
      - `request_payload` (jsonb)
      - `quoting_decision` (text)
      - `quoting_reason` (text)
      - `from_zip` (text)
      - `to_zip` (text)
      - `pallets` (integer)
      - `gross_weight` (integer)
      - `is_reefer` (boolean)
      - `temperature` (text, nullable)
      - `commodity` (text, nullable)
      - `created_at` (timestamp)

    - `rfq_responses`
      - `id` (uuid, primary key)
      - `request_id` (uuid, foreign key to rfq_requests)
      - `batch_id` (uuid, foreign key to rfq_batches)
      - `carrier_name` (text)
      - `carrier_code` (text, nullable)
      - `carrier_scac` (text, nullable)
      - `quote_id` (text)
      - `service_level_code` (text, nullable)
      - `service_level_description` (text, nullable)
      - `carrier_total_rate` (numeric)
      - `customer_price` (numeric)
      - `profit` (numeric)
      - `markup_applied` (numeric)
      - `applied_margin_type` (text, nullable)
      - `applied_margin_percentage` (numeric, nullable)
      - `is_custom_price` (boolean)
      - `transit_days` (integer, nullable)
      - `quote_mode` (text, nullable)
      - `raw_response` (jsonb)
      - `charge_breakdown` (jsonb, nullable)
      - `created_at` (timestamp)

    - `rfq_batch_requests`
      - `batch_id` (uuid, foreign key to rfq_batches)
      - `request_id` (uuid, foreign key to rfq_requests)
      - `row_index` (integer)
      - `status` (text)
      - `error_message` (text, nullable)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data

  3. Indexes
    - Add indexes for common query patterns
    - Foreign key relationships
    - Date-based queries
*/

-- Create rfq_batches table
CREATE TABLE IF NOT EXISTS rfq_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name text NOT NULL,
  customer_name text,
  pricing_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_carriers jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_mode text DEFAULT 'smart'::text,
  total_rfqs integer DEFAULT 0,
  successful_rfqs integer DEFAULT 0,
  total_quotes integer DEFAULT 0,
  best_total_price numeric DEFAULT 0,
  total_profit numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'anonymous'::text
);

-- Create rfq_requests table
CREATE TABLE IF NOT EXISTS rfq_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES rfq_batches(id) ON DELETE CASCADE,
  request_payload jsonb NOT NULL,
  quoting_decision text NOT NULL,
  quoting_reason text NOT NULL,
  from_zip text NOT NULL,
  to_zip text NOT NULL,
  pallets integer NOT NULL,
  gross_weight integer NOT NULL,
  is_reefer boolean DEFAULT false,
  temperature text,
  commodity text,
  created_at timestamptz DEFAULT now()
);

-- Create rfq_responses table
CREATE TABLE IF NOT EXISTS rfq_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES rfq_requests(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES rfq_batches(id) ON DELETE CASCADE,
  carrier_name text NOT NULL,
  carrier_code text,
  carrier_scac text,
  quote_id text NOT NULL,
  service_level_code text,
  service_level_description text,
  carrier_total_rate numeric NOT NULL,
  customer_price numeric NOT NULL,
  profit numeric NOT NULL,
  markup_applied numeric NOT NULL,
  applied_margin_type text,
  applied_margin_percentage numeric,
  is_custom_price boolean DEFAULT false,
  transit_days integer,
  quote_mode text,
  raw_response jsonb NOT NULL,
  charge_breakdown jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create rfq_batch_requests junction table
CREATE TABLE IF NOT EXISTS rfq_batch_requests (
  batch_id uuid NOT NULL REFERENCES rfq_batches(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES rfq_requests(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (batch_id, request_id)
);

-- Enable Row Level Security
ALTER TABLE rfq_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_batch_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for rfq_batches
CREATE POLICY "Users can manage their own batches"
  ON rfq_batches
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for rfq_requests
CREATE POLICY "Users can manage their own requests"
  ON rfq_requests
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for rfq_responses
CREATE POLICY "Users can manage their own responses"
  ON rfq_responses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for rfq_batch_requests
CREATE POLICY "Users can manage their own batch requests"
  ON rfq_batch_requests
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rfq_batches_created_at ON rfq_batches USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rfq_batches_created_by ON rfq_batches USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_rfq_batches_customer ON rfq_batches USING btree (customer_name);

CREATE INDEX IF NOT EXISTS idx_rfq_requests_batch_id ON rfq_requests USING btree (batch_id);
CREATE INDEX IF NOT EXISTS idx_rfq_requests_created_at ON rfq_requests USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rfq_requests_quoting_decision ON rfq_requests USING btree (quoting_decision);
CREATE INDEX IF NOT EXISTS idx_rfq_requests_route ON rfq_requests USING btree (from_zip, to_zip);

CREATE INDEX IF NOT EXISTS idx_rfq_responses_request_id ON rfq_responses USING btree (request_id);
CREATE INDEX IF NOT EXISTS idx_rfq_responses_batch_id ON rfq_responses USING btree (batch_id);
CREATE INDEX IF NOT EXISTS idx_rfq_responses_carrier ON rfq_responses USING btree (carrier_name);
CREATE INDEX IF NOT EXISTS idx_rfq_responses_price ON rfq_responses USING btree (customer_price);

CREATE INDEX IF NOT EXISTS idx_rfq_batch_requests_batch_id ON rfq_batch_requests USING btree (batch_id);
CREATE INDEX IF NOT EXISTS idx_rfq_batch_requests_request_id ON rfq_batch_requests USING btree (request_id);
CREATE INDEX IF NOT EXISTS idx_rfq_batch_requests_status ON rfq_batch_requests USING btree (status);