import { sendMessageToKommo } from "./kommo-chatapi-client.js";
import { sendTextToWhatsApp, sendMediaToWhatsApp } from "./whatsapp-api-client.js";
import { createMapping } from "./message-mapping-service.js";
import type { NormalizedMessage } from "../types/kommo-webhook-types.js";
import type { WhatsAppMessage } from "../types/whatsapp-webhook-types.js";

/** Bridge: WhatsApp incoming → Kommo ChatAPI (so agent sees it in CRM) */
export async function bridgeWhatsAppToKommo(
  normalized: NormalizedMessage,
  rawWhatsApp: WhatsAppMessage
): Promise<void> {
  try {
    const result = await sendMessageToKommo({
      conversationId: normalized.kommoChatId,
      senderId: normalized.senderId ?? rawWhatsApp.from,
      senderName: normalized.senderId ?? rawWhatsApp.from,
      receiverId: "system",
      messageId: rawWhatsApp.id,
      messageType: mapContentTypeToKommo(normalized.contentType),
      text: normalized.textContent ?? undefined,
      mediaUrl: normalized.mediaUrl ?? undefined,
    });

    if (result) {
      await createMapping({
        whatsappMessageId: rawWhatsApp.id,
        kommoMessageId: result.kommoMessageId,
        kommoConversationId: normalized.kommoChatId,
      });
    }
  } catch (err) {
    console.error("[Bridge] WhatsApp→Kommo failed:", err instanceof Error ? err.message : err);
  }
}

/** Bridge: Kommo ChatAPI outgoing → WhatsApp (so customer receives it) */
export async function bridgeKommoToWhatsApp(
  normalized: NormalizedMessage,
  rawKommo: Record<string, unknown>
): Promise<void> {
  try {
    // Extract receiver phone from ChatAPI payload
    const message = rawKommo.message as Record<string, unknown> | undefined;
    const receiver = message?.receiver as Record<string, unknown> | undefined;
    const phone = receiver?.phone as string | undefined;

    if (!phone) {
      console.warn("[Bridge] No receiver phone in ChatAPI payload, skipping WhatsApp send");
      return;
    }

    // Clean phone number (remove spaces, dashes, plus sign prefix)
    const cleanPhone = phone.replace(/[\s\-+]/g, "");

    let result: { whatsappMessageId: string } | null = null;

    if (normalized.contentType === "text" && normalized.textContent) {
      result = await sendTextToWhatsApp(cleanPhone, normalized.textContent);
    } else if (normalized.mediaUrl) {
      const mediaType = mapContentTypeToWhatsApp(normalized.contentType);
      result = await sendMediaToWhatsApp(
        cleanPhone,
        mediaType,
        normalized.mediaUrl,
        normalized.textContent ?? undefined
      );
    } else if (normalized.textContent) {
      result = await sendTextToWhatsApp(cleanPhone, normalized.textContent);
    }

    if (result) {
      await createMapping({
        whatsappMessageId: result.whatsappMessageId,
        kommoMessageId: normalized.kommoMessageId,
        kommoConversationId: normalized.kommoChatId,
      });
    }
  } catch (err) {
    console.error("[Bridge] Kommo→WhatsApp failed:", err instanceof Error ? err.message : err);
  }
}

function mapContentTypeToKommo(type: string): string {
  const map: Record<string, string> = {
    text: "text",
    image: "picture",
    video: "video",
    file: "file",
    voice: "voice",
    location: "location",
    sticker: "sticker",
  };
  return map[type] ?? "text";
}

function mapContentTypeToWhatsApp(
  type: string
): "image" | "video" | "audio" | "document" {
  const map: Record<string, "image" | "video" | "audio" | "document"> = {
    image: "image",
    video: "video",
    voice: "audio",
    file: "document",
    sticker: "image",
  };
  return map[type] ?? "document";
}
