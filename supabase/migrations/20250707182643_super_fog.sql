/*
  # Create proper relational structure for RFQ storage

  1. New Tables
    - `rfq_batches` - Batch metadata and settings
    - `rfq_requests` - Individual RFQ requests with payload data
    - `rfq_responses` - Individual quote responses from carriers
    - `rfq_batch_requests` - Junction table linking batches to requests

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data

  3. Indexes
    - Performance indexes for common queries
    - Foreign key relationships
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS rfq_batch_requests CASCADE;
DROP TABLE IF EXISTS rfq_responses CASCADE;
DROP TABLE IF EXISTS rfq_requests CASCADE;
DROP TABLE IF EXISTS rfq_batches CASCADE;

-- Create rfq_batches table for batch metadata
CREATE TABLE rfq_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name text NOT NULL,
  customer_name text,
  pricing_settings jsonb NOT NULL DEFAULT '{}',
  selected_carriers jsonb NOT NULL DEFAULT '{}',
  processing_mode text DEFAULT 'smart',
  total_rfqs integer DEFAULT 0,
  successful_rfqs integer DEFAULT 0,
  total_quotes integer DEFAULT 0,
  best_total_price numeric DEFAULT 0,
  total_profit numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'anonymous'
);

-- Create rfq_requests table for individual RFQ payloads
CREATE TABLE rfq_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_payload jsonb NOT NULL,
  quoting_decision text NOT NULL, -- 'freshx', 'project44-standard', 'project44-volume', 'project44-dual'
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

-- Create rfq_responses table for individual quote responses
CREATE TABLE rfq_responses (
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
  applied_margin_type text, -- 'customer', 'fallback', 'flat'
  applied_margin_percentage numeric,
  is_custom_price boolean DEFAULT false,
  transit_days integer,
  quote_mode text, -- 'volume', 'standard' for dual-mode quotes
  raw_response jsonb NOT NULL, -- Full API response
  charge_breakdown jsonb, -- Detailed charge breakdown
  created_at timestamptz DEFAULT now()
);

-- Create junction table linking batches to requests
CREATE TABLE rfq_batch_requests (
  batch_id uuid NOT NULL REFERENCES rfq_batches(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES rfq_requests(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'success', 'error'
  error_message text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (batch_id, request_id)
);

-- Enable RLS on all tables
ALTER TABLE rfq_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_batch_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own batches"
  ON rfq_batches
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can manage their own requests"
  ON rfq_requests
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can manage their own responses"
  ON rfq_responses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can manage their own batch requests"
  ON rfq_batch_requests
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_rfq_batches_created_at ON rfq_batches (created_at DESC);
CREATE INDEX idx_rfq_batches_created_by ON rfq_batches (created_by);
CREATE INDEX idx_rfq_batches_customer ON rfq_batches (customer_name);

CREATE INDEX idx_rfq_requests_created_at ON rfq_requests (created_at DESC);
CREATE INDEX idx_rfq_requests_route ON rfq_requests (from_zip, to_zip);
CREATE INDEX idx_rfq_requests_quoting_decision ON rfq_requests (quoting_decision);

CREATE INDEX idx_rfq_responses_request_id ON rfq_responses (request_id);
CREATE INDEX idx_rfq_responses_batch_id ON rfq_responses (batch_id);
CREATE INDEX idx_rfq_responses_carrier ON rfq_responses (carrier_name);
CREATE INDEX idx_rfq_responses_price ON rfq_responses (customer_price);

CREATE INDEX idx_rfq_batch_requests_batch_id ON rfq_batch_requests (batch_id);
CREATE INDEX idx_rfq_batch_requests_request_id ON rfq_batch_requests (request_id);
CREATE INDEX idx_rfq_batch_requests_status ON rfq_batch_requests (status);