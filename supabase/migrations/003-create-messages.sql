-- Messages table — individual WhatsApp messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  kommo_message_id TEXT NOT NULL UNIQUE,
  direction message_direction NOT NULL,
  sender_type sender_type NOT NULL DEFAULT 'customer',
  sender_id TEXT,
  content_type content_type NOT NULL DEFAULT 'text',
  text_content TEXT,
  media_url TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for message queries
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_direction ON messages(direction);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
