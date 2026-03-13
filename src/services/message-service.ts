import { supabase } from "../config/supabase-client.js";
import { logger } from "../config/logger.js";
import type { NormalizedMessage } from "../types/kommo-webhook-types.js";

/** Insert message with dedup on kommo_message_id. Returns true if inserted, false if duplicate. */
export async function insertMessage(
  conversationId: string,
  msg: NormalizedMessage
): Promise<boolean> {
  const { data, error } = await supabase
    .from("messages")
    .upsert(
      {
        conversation_id: conversationId,
        kommo_message_id: msg.kommoMessageId,
        direction: msg.direction,
        sender_type: msg.senderType,
        sender_id: msg.senderId,
        content_type: msg.contentType,
        text_content: msg.textContent,
        media_url: msg.mediaUrl,
        raw_payload: msg.rawPayload,
        created_at: msg.createdAt,
      },
      { onConflict: "kommo_message_id", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    logger.error({ err: error }, "[MessageService] Failed to insert message");
    throw error;
  }

  // If data array is empty, it was a duplicate (ignoreDuplicates: true)
  return (data?.length ?? 0) > 0;
}
