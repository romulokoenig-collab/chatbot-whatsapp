/** Kommo standard webhook payload types (x-www-form-urlencoded, nested keys) */

export interface KommoMessagePayload {
  id: string;
  chat_id: string;
  text?: string;
  type: "incoming" | "outgoing";
  created_at?: string;
  author?: {
    id?: string;
    type?: string;
  };
  contact_id?: string;
  lead_id?: string;
  element_type?: number;
  attachment?: {
    url?: string;
    type?: string;
  };
}

/** Normalized message format after parsing Kommo webhook */
export interface NormalizedMessage {
  kommoMessageId: string;
  kommoChatId: string;
  direction: "incoming" | "outgoing";
  senderType: "customer" | "agent" | "bot" | "system";
  senderId: string | null;
  contentType: "text" | "image" | "video" | "file" | "voice" | "location" | "sticker";
  textContent: string | null;
  mediaUrl: string | null;
  contactId: string | null;
  leadId: string | null;
  rawPayload: Record<string, unknown>;
  createdAt: string;
}
