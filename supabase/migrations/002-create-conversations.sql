-- Conversations table — one per WhatsApp chat
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kommo_chat_id TEXT NOT NULL UNIQUE,
  kommo_lead_id TEXT,
  kommo_contact_id TEXT,
  status conversation_status NOT NULL DEFAULT 'active',
  last_message_at TIMESTAMPTZ NOT NULL,
  last_incoming_at TIMESTAMPTZ,
  last_outgoing_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_conversations_lead_id ON conversations(kommo_lead_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
