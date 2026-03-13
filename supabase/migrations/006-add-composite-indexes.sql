-- Composite indexes for trigger queries (no-response, no-followup)
-- These queries filter by status='active' AND compare timestamp columns

-- getUnrespondedLeads: .eq("status", "active").lt("last_incoming_at", cutoff)
CREATE INDEX IF NOT EXISTS idx_conversations_status_last_incoming
  ON conversations(status, last_incoming_at DESC)
  WHERE status = 'active';

-- getUnfollowedLeads: .eq("status", "active").lt("last_outgoing_at", cutoff)
CREATE INDEX IF NOT EXISTS idx_conversations_status_last_outgoing
  ON conversations(status, last_outgoing_at DESC)
  WHERE status = 'active';

-- API filter by contact_id
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id
  ON conversations(kommo_contact_id)
  WHERE kommo_contact_id IS NOT NULL;
