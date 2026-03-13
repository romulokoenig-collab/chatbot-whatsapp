import { logger } from "../config/logger.js";
import { env } from "../config/environment-config.js";
import { generateChatApiHeaders } from "../utils/hmac-signature.js";

const KOMMO_CHAT_API_BASE = "https://amojo.kommo.com/v2/origin/custom";

interface SendMessagePayload {
  event_type: string;
  payload: {
    timestamp: number;
    msgid: string;
    conversation_id: string;
    sender: { id: string; name: string };
    receiver: { id: string };
    message: { type: string; text?: string; media?: string };
    silent?: boolean;
  };
}

/** Send a message to Kommo ChatAPI (incoming WhatsApp → Kommo CRM) */
export async function sendMessageToKommo(data: {
  conversationId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  messageId: string;
  messageType: string;
  text?: string;
  mediaUrl?: string;
}): Promise<{ kommoMessageId: string } | null> {
  const scopeId = env.KOMMO_SCOPE_ID;
  const channelSecret = env.KOMMO_CHANNEL_SECRET;

  if (!scopeId || !channelSecret) {
    logger.warn("[KommoChatAPI] Missing KOMMO_SCOPE_ID or KOMMO_CHANNEL_SECRET");
    return null;
  }

  const payload: SendMessagePayload = {
    event_type: "new_message",
    payload: {
      timestamp: Math.floor(Date.now() / 1000),
      msgid: data.messageId,
      conversation_id: data.conversationId,
      sender: { id: data.senderId, name: data.senderName },
      receiver: { id: data.receiverId },
      message: {
        type: data.messageType,
        ...(data.text && { text: data.text }),
        ...(data.mediaUrl && { media: data.mediaUrl }),
      },
      silent: false,
    },
  };

  const body = JSON.stringify(payload);
  const headers = generateChatApiHeaders(body, channelSecret);
  const url = `${KOMMO_CHAT_API_BASE}/${scopeId}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, body: text }, "[KommoChatAPI] Send failed");
      return null;
    }

    const result = (await response.json()) as Record<string, unknown>;
    logger.info({ messageId: data.messageId }, "[KommoChatAPI] Message sent");

    return {
      kommoMessageId: String(
        (result.new_message as Record<string, unknown> | undefined)?.msgid ?? data.messageId
      ),
    };
  } catch (err) {
    logger.error({ err }, "[KommoChatAPI] Send error");
    return null;
  }
}
