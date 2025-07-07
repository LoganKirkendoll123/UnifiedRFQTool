/*
  # Remove mass_rfq_batches table

  1. Changes
    - Drop mass_rfq_batches table completely
    - All RFQ batch operations now use the unified relational structure:
      - rfq_batches (batch metadata)
      - rfq_requests (individual RFQ payloads)
      - rfq_responses (quote responses)
      - rfq_batch_requests (linking table)

  2. Impact
    - Simplifies data model to single storage approach
    - Past RFQ mode will use same tables as new RFQ processing
    - All batch operations unified under relational structure
*/

-- Drop the mass_rfq_batches table completely
DROP TABLE IF EXISTS mass_rfq_batches CASCADE;