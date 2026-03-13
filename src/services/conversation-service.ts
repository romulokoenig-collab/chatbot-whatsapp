import { supabase } from "../config/supabase-client.js";
import { logger } from "../config/logger.js";
import type { MessageDirection } from "../types/database-types.js";

interface UpsertConversationData {
  kommoChatId: string;
  contactId: string | null;
  leadId: string | null;
  direction: MessageDirection;
  messageTimestamp: string;
}

/** Atomic upsert conversation — create if new, update timestamps if exists (race-safe) */
export async function upsertConversation(data: UpsertConversationData): Promise<string> {
  const now = new Date().toISOString();

  // Build upsert payload with direction-specific timestamps
  const payload: Record<string, unknown> = {
    kommo_chat_id: data.kommoChatId,
    kommo_contact_id: data.contactId,
    kommo_lead_id: data.leadId,
    status: "active",
    last_message_at: data.messageTimestamp,
    last_incoming_at: data.direction === "incoming" ? data.messageTimestamp : null,
    last_outgoing_at: data.direction === "outgoing" ? data.messageTimestamp : null,
    created_at: now,
    updated_at: now,
  };

  const { data: result, error } = await supabase
    .from("conversations")
    .upsert(payload, { onConflict: "kommo_chat_id" })
    .select("id")
    .single();

  if (error) {
    logger.error({ err: error }, "[ConversationService] Upsert failed");
    throw error;
  }

  // After upsert, update only the relevant timestamp + contact/lead if non-null
  // This handles the "existing conversation" case properly (avoids nullifying the other timestamp)
  const updates: Record<string, unknown> = {
    last_message_at: data.messageTimestamp,
    updated_at: now,
  };
  if (data.direction === "incoming") {
    updates.last_incoming_at = data.messageTimestamp;
  } else {
    updates.last_outgoing_at = data.messageTimestamp;
  }
  // Update contact/lead IDs if they were missing before (M3 fix)
  if (data.contactId) updates.kommo_contact_id = data.contactId;
  if (data.leadId) updates.kommo_lead_id = data.leadId;

  const { error: updateError } = await supabase
    .from("conversations")
    .update(updates)
    .eq("id", result.id);

  if (updateError) {
    logger.error({ err: updateError }, "[ConversationService] Update after upsert failed");
  }

  return result.id;
}
