import { supabase } from "../config/supabase-client.js";
import type { MessageDirection } from "../types/database-types.js";

interface UpsertConversationData {
  kommoChatId: string;
  contactId: string | null;
  leadId: string | null;
  direction: MessageDirection;
  messageTimestamp: string;
}

/** Upsert conversation — create if new, update timestamps if exists */
export async function upsertConversation(data: UpsertConversationData): Promise<string> {
  const now = new Date().toISOString();

  // Build timestamp updates based on direction
  const timestampUpdates: Record<string, string> = {
    last_message_at: data.messageTimestamp,
    updated_at: now,
  };
  if (data.direction === "incoming") {
    timestampUpdates.last_incoming_at = data.messageTimestamp;
  } else {
    timestampUpdates.last_outgoing_at = data.messageTimestamp;
  }

  // Try to find existing conversation by kommo_chat_id
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("kommo_chat_id", data.kommoChatId)
    .single();

  if (existing) {
    // Update existing conversation timestamps
    await supabase
      .from("conversations")
      .update(timestampUpdates)
      .eq("id", existing.id);
    return existing.id;
  }

  // Create new conversation
  const { data: inserted, error } = await supabase
    .from("conversations")
    .insert({
      kommo_chat_id: data.kommoChatId,
      kommo_contact_id: data.contactId,
      kommo_lead_id: data.leadId,
      status: "active",
      last_message_at: data.messageTimestamp,
      last_incoming_at: data.direction === "incoming" ? data.messageTimestamp : null,
      last_outgoing_at: data.direction === "outgoing" ? data.messageTimestamp : null,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[ConversationService] Failed to insert conversation:", error.message);
    throw error;
  }

  return inserted.id;
}
