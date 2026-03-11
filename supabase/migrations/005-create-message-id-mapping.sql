-- Phase A: Message ID mapping between WhatsApp and Kommo
-- Tracks correlation for delivery status updates and deduplication

CREATE TABLE IF NOT EXISTS message_id_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  whatsapp_message_id TEXT,
  kommo_message_id TEXT,
  kommo_conversation_id TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'sent'
    CHECK (delivery_status IN ('sent', 'delivered', 'read', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lookup indexes for both directions
CREATE INDEX IF NOT EXISTS idx_mapping_whatsapp_id ON message_id_mapping(whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mapping_kommo_id ON message_id_mapping(kommo_message_id) WHERE kommo_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mapping_message_id ON message_id_mapping(message_id);
