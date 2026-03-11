import { Router } from "express";
import type { Request, Response } from "express";
import { env } from "../config/environment-config.js";
import { verifyHmacSha1 } from "../utils/hmac-signature.js";
import { logRawWebhook, markProcessed, markError } from "./webhook-raw-logger.js";
import { upsertConversation } from "../services/conversation-service.js";
import { insertMessage } from "../services/message-service.js";
import { bridgeKommoToWhatsApp } from "../services/message-bridge-service.js";
import type { NormalizedMessage } from "../types/kommo-webhook-types.js";
import type { ChatApiWebhookPayload } from "../types/chatapi-webhook-types.js";
import type { ContentType } from "../types/database-types.js";

export const chatApiWebhookRouter = Router();

/** POST /webhooks/chatapi/:scopeId — receive outgoing messages from Kommo ChatAPI */
chatApiWebhookRouter.post("/chatapi/:scopeId", async (req: Request, res: Response) => {
  const channelSecret = env.KOMMO_CHANNEL_SECRET;

  if (!channelSecret) {
    console.warn("[ChatAPI] KOMMO_CHANNEL_SECRET not configured, rejecting webhook");
    res.status(503).json({ error: "ChatAPI not configured" });
    return;
  }

  // Verify X-Signature using raw body (not re-serialized)
  const signature = req.headers["x-signature"] as string | undefined;
  const rawBody = (req as unknown as Record<string, unknown>).rawBody as string
    ?? JSON.stringify(req.body);

  if (!signature || !verifyHmacSha1(rawBody, channelSecret, signature)) {
    console.warn("[ChatAPI] Invalid signature, rejecting webhook");
    res.status(200).send(); // Silent reject per Kommo docs
    return;
  }

  let logId: string | undefined;

  try {
    logId = await logRawWebhook(
      "kommo_chatapi",
      req.body as Record<string, unknown>,
      req.headers as Record<string, unknown>,
      "outgoing_message"
    );
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[ChatAPI] Failed to log raw webhook:", err);
    res.status(200).json({ ok: true });
    return;
  }

  // Process async after response
  try {
    const parsed = parseChatApiPayload(req.body as ChatApiWebhookPayload);
    if (!parsed) {
      if (logId) await markProcessed(logId);
      return;
    }

    const conversationId = await upsertConversation({
      kommoChatId: parsed.kommoChatId,
      contactId: null,
      leadId: null,
      direction: "outgoing",
      messageTimestamp: parsed.createdAt,
    });

    const inserted = await insertMessage(conversationId, parsed);

    // Only forward to WhatsApp if this is a new message (dedup guard)
    if (inserted) {
      await bridgeKommoToWhatsApp(parsed, req.body as Record<string, unknown>);
    }

    if (logId) await markProcessed(logId);
    console.log("[ChatAPI] Processed outgoing message:", parsed.kommoMessageId);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[ChatAPI] Processing error:", errorMsg);
    if (logId) await markError(logId, errorMsg);
  }
});

/** Parse ChatAPI webhook payload into NormalizedMessage */
function parseChatApiPayload(body: ChatApiWebhookPayload): NormalizedMessage | null {
  const msg = body?.message;
  if (!msg?.message?.id) return null;

  const messageType = msg.message.type ?? "text";
  const contentType = resolveContentType(messageType);

  const timestamp = msg.timestamp
    ? new Date(msg.timestamp * 1000).toISOString()
    : new Date().toISOString();

  return {
    kommoMessageId: msg.message.id,
    kommoChatId: msg.conversation?.id ?? "",
    direction: "outgoing",
    senderType: "agent",
    senderId: msg.sender?.id ?? null,
    contentType,
    textContent: msg.message.text ?? null,
    mediaUrl: msg.message.media ?? null,
    contactId: null,
    leadId: null,
    rawPayload: body as unknown as Record<string, unknown>,
    createdAt: timestamp,
  };
}

function resolveContentType(type: string): ContentType {
  const map: Record<string, ContentType> = {
    text: "text",
    picture: "image",
    file: "file",
    video: "video",
    voice: "voice",
    audio: "voice",
    sticker: "sticker",
    location: "location",
  };
  return map[type] ?? "text";
}
