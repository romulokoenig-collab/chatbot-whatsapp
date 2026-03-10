/** Database enum types matching PostgreSQL enums */

export type ConversationStatus = "active" | "closed";
export type MessageDirection = "incoming" | "outgoing";
export type SenderType = "customer" | "agent" | "bot" | "system";
export type ContentType = "text" | "image" | "video" | "file" | "voice" | "location" | "sticker";
export type WebhookSource = "kommo_standard" | "kommo_chatapi" | "meta";

/** conversations table row */
export interface Conversation {
  id: string;
  kommo_chat_id: string;
  kommo_lead_id: string | null;
  kommo_contact_id: string | null;
  status: ConversationStatus;
  last_message_at: string;
  last_incoming_at: string | null;
  last_outgoing_at: string | null;
  created_at: string;
  updated_at: string;
}

/** messages table row */
export interface Message {
  id: string;
  conversation_id: string;
  kommo_message_id: string;
  direction: MessageDirection;
  sender_type: SenderType;
  sender_id: string | null;
  content_type: ContentType;
  text_content: string | null;
  media_url: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
}

/** webhook_raw_log table row */
export interface WebhookRawLog {
  id: string;
  source: WebhookSource;
  event_type: string | null;
  raw_payload: Record<string, unknown>;
  headers: Record<string, unknown>;
  processed: boolean;
  error_message: string | null;
  created_at: string;
}
