/*
  # Add batch_id column to rfq_requests table

  1. Changes
    - Add batch_id column to rfq_requests table
    - Add foreign key constraint to rfq_batches
    - Add index for performance
    - Update existing records to have null batch_id (they'll be cleaned up)

  2. Security
    - Maintains existing RLS policies
*/

-- Add batch_id column to rfq_requests table
ALTER TABLE rfq_requests 
ADD COLUMN batch_id uuid REFERENCES rfq_batches(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX idx_rfq_requests_batch_id ON rfq_requests (batch_id);