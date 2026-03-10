-- Write-ahead log for raw webhook payloads (safety net against message loss)
CREATE TABLE webhook_raw_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source webhook_source NOT NULL,
  event_type TEXT,
  raw_payload JSONB NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}',
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index for reprocessing unprocessed webhooks
CREATE INDEX idx_webhook_raw_log_unprocessed ON webhook_raw_log(created_at)
  WHERE processed = FALSE;
