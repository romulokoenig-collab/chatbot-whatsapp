import { supabase } from "../config/supabase-client.js";
import { logger } from "../config/logger.js";
import type { DeliveryStatus } from "../types/database-types.js";

/** Create a message ID mapping between WhatsApp and Kommo */
export async function createMapping(data: {
  messageId?: string;
  whatsappMessageId?: string;
  kommoMessageId?: string;
  kommoConversationId?: string;
}): Promise<string> {
  const { data: result, error } = await supabase
    .from("message_id_mapping")
    .insert({
      message_id: data.messageId ?? null,
      whatsapp_message_id: data.whatsappMessageId ?? null,
      kommo_message_id: data.kommoMessageId ?? null,
      kommo_conversation_id: data.kommoConversationId ?? null,
      delivery_status: "sent",
    })
    .select("id")
    .single();

  if (error) {
    logger.error({ err: error }, "[MappingService] Failed to create mapping");
    throw error;
  }

  return result.id;
}

/** Update delivery status by WhatsApp message ID */
export async function updateDeliveryStatus(
  whatsappMessageId: string,
  status: string
): Promise<void> {
  const validStatuses: DeliveryStatus[] = ["sent", "delivered", "read", "failed"];
  const deliveryStatus = validStatuses.includes(status as DeliveryStatus)
    ? (status as DeliveryStatus)
    : "sent";

  const { error } = await supabase
    .from("message_id_mapping")
    .update({
      delivery_status: deliveryStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("whatsapp_message_id", whatsappMessageId);

  if (error) {
    logger.error({ err: error }, "[MappingService] Failed to update delivery status");
  }
}

/** Find mapping by WhatsApp message ID */
export async function findByWhatsAppId(whatsappMessageId: string) {
  const { data, error } = await supabase
    .from("message_id_mapping")
    .select("*")
    .eq("whatsapp_message_id", whatsappMessageId)
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, "[MappingService] Lookup by WhatsApp ID failed");
    return null;
  }

  return data;
}

/** Find mapping by Kommo message ID */
export async function findByKommoId(kommoMessageId: string) {
  const { data, error } = await supabase
    .from("message_id_mapping")
    .select("*")
    .eq("kommo_message_id", kommoMessageId)
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, "[MappingService] Lookup by Kommo ID failed");
    return null;
  }

  return data;
}
