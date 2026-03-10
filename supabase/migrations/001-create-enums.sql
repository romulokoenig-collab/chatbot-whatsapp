-- Enum types for WhatsApp message monitoring
CREATE TYPE conversation_status AS ENUM ('active', 'closed');
CREATE TYPE message_direction AS ENUM ('incoming', 'outgoing');
CREATE TYPE sender_type AS ENUM ('customer', 'agent', 'bot', 'system');
CREATE TYPE content_type AS ENUM ('text', 'image', 'video', 'file', 'voice', 'location', 'sticker');
CREATE TYPE webhook_source AS ENUM ('kommo_standard', 'kommo_chatapi', 'meta');
