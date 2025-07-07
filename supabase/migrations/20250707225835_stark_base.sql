/*
  # Batch Analysis Tracking Schema

  1. New Tables
    - `batch_analyses`
      - `id` (uuid, primary key)
      - `original_batch_id` (uuid, foreign key to rfq_batches)
      - `comparison_batch_id` (uuid, foreign key to rfq_batches)
      - `analysis_name` (text)
      - `analysis_settings` (jsonb) - stores the settings used for comparison
      - `overall_stats` (jsonb) - stores summary statistics
      - `shipment_analyses` (jsonb) - stores detailed per-shipment analysis
      - `created_at` (timestamp)
      - `created_by` (text)

  2. Security
    - Enable RLS on batch_analyses table
    - Add policies for authenticated users to manage their own analyses

  3. Indexes
    - Add indexes for common query patterns
*/

-- Create batch_analyses table
CREATE TABLE IF NOT EXISTS batch_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_batch_id uuid NOT NULL REFERENCES rfq_batches(id) ON DELETE CASCADE,
  comparison_batch_id uuid NOT NULL REFERENCES rfq_batches(id) ON DELETE CASCADE,
  analysis_name text NOT NULL,
  analysis_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  overall_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  shipment_analyses jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'anonymous'::text
);

-- Enable Row Level Security
ALTER TABLE batch_analyses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for batch_analyses
CREATE POLICY "Users can manage their own analyses"
  ON batch_analyses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_batch_analyses_original_batch ON batch_analyses USING btree (original_batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_analyses_comparison_batch ON batch_analyses USING btree (comparison_batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_analyses_created_at ON batch_analyses USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_analyses_created_by ON batch_analyses USING btree (created_by);