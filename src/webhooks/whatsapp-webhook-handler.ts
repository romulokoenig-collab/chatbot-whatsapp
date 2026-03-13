import { Router } from "express";
import type { Request, Response } from "express";
import { timingSafeEqual } from "crypto";
import { logger } from "../config/logger.js";
import { env } from "../config/environment-config.js";
import { verifyWhatsAppSignature } from "../utils/hmac-signature.js";
import { logRawWebhook, markProcessed, markError } from "./webhook-raw-logger.js";
import { upsertConversation } from "../services/conversation-service.js";
import { insertMessage } from "../services/message-service.js";
import { bridgeWhatsAppToKommo } from "../services/message-bridge-service.js";
import { updateDeliveryStatus, findByWhatsAppId, createMapping } from "../services/message-mapping-service.js";
import { normalizePhone } from "../utils/normalize-phone.js";
import type { NormalizedMessage } from "../types/kommo-webhook-types.js";
import type { WhatsAppWebhookPayload, WhatsAppMessage, WhatsAppMessageEcho } from "../types/whatsapp-webhook-types.js";
import type { ContentType } from "../types/database-types.js";

export const whatsAppWebhookRouter = Router();

/** GET /webhooks/whatsapp — Meta verification challenge */
whatsAppWebhookRouter.get("/whatsapp", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"] as string | undefined;
  const token = req.query["hub.verify_token"] as string | undefined;
  const challenge = req.query["hub.challenge"] as string | undefined;

  const verifyToken = env.WHATSAPP_VERIFY_TOKEN;
  const tokenMatch = mode === "subscribe" && token && verifyToken
    && token.length === verifyToken.length
    && timingSafeEqual(Buffer.from(token), Buffer.from(verifyToken));

  if (tokenMatch) {
    logger.info("[WhatsApp] Verification challenge accepted");
    res.status(200).send(challenge);
    return;
  }

  logger.warn("[WhatsApp] Verification failed — wrong token");
  res.status(403).send("Forbidden");
});

/** POST /webhooks/whatsapp — receive messages, statuses, and echoes from WhatsApp Cloud API */
whatsAppWebhookRouter.post("/whatsapp", async (req: Request, res: Response) => {
  // Verify signature (WHATSAPP_APP_SECRET is required)
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  const rawBody = (req as unknown as Record<string, unknown>).rawBody as string | undefined;

  if (!rawBody || !signature || !verifyWhatsAppSignature(rawBody, env.WHATSAPP_APP_SECRET, signature)) {
    logger.warn("[WhatsApp] Invalid signature or missing rawBody, rejecting webhook");
    res.status(200).send(); // Silent reject (standard webhook practice)
    return;
  }

  let logId: string | undefined;

  try {
    logId = await logRawWebhook(
      "meta",
      req.body as Record<string, unknown>,
      req.headers as Record<string, unknown>,
      "whatsapp_message"
    );
    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[WhatsApp] Failed to log raw webhook");
    res.status(200).json({ ok: true });
    return;
  }

  // Process async after response
  try {
    const payload = req.body as WhatsAppWebhookPayload;
    let processedCount = 0;

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages" && change.field !== "smb_message_echoes") continue;
        const value = change.value;

        // Handle delivery status updates
        for (const status of value.statuses ?? []) {
          try {
            const existing = await findByWhatsAppId(status.id);

            if (existing) {
              await updateDeliveryStatus(status.id, status.status);
            } else {
              // No mapping — create one for future status tracking
              // Do NOT create a message record (no content available from status)
              const customerPhone = normalizePhone(status.recipient_id);
              await createMapping({
                whatsappMessageId: status.id,
                kommoConversationId: `wa_${customerPhone}`,
              });
              await updateDeliveryStatus(status.id, status.status);
            }

            // On first "sent" status, update conversation.last_outgoing_at
            // This enables no-response/no-followup triggers without outgoing message content
            if (status.status === "sent") {
              const customerPhone = normalizePhone(status.recipient_id);
              const statusTimestamp = status.timestamp
                ? new Date(Number(status.timestamp) * 1000).toISOString()
                : new Date().toISOString();

              await upsertConversation({
                kommoChatId: `wa_${customerPhone}`,
                contactId: null,
                leadId: null,
                direction: "outgoing",
                messageTimestamp: statusTimestamp,
              });
            }
          } catch (err) {
            logger.error({ err, statusId: status.id }, "[WhatsApp] Status processing error");
          }
        }

        // Handle incoming messages
        const contactName = value.contacts?.[0]?.profile?.name ?? null;
        const senderPhone = value.contacts?.[0]?.wa_id ?? null;

        for (const msg of value.messages ?? []) {
          const normalized = parseWhatsAppMessage(msg, contactName, senderPhone);
          if (!normalized) continue;

          const conversationId = await upsertConversation({
            kommoChatId: `wa_${normalizePhone(msg.from)}`,
            contactId: null,
            leadId: null,
            direction: "incoming",
            messageTimestamp: normalized.createdAt,
          });

          const inserted = await insertMessage(conversationId, normalized);

          // Only forward to Kommo if new message (dedup guard)
          if (inserted) {
            await bridgeWhatsAppToKommo(normalized, msg);
            processedCount++;
          }
        }

        // Handle message echoes (outgoing via Business App / Kommo)
        for (const echo of value.message_echoes ?? []) {
          try {
            const normalized = parseWhatsAppEcho(echo);
            if (!normalized) continue;

            const customerPhone = normalizePhone(echo.to);
            const conversationId = await upsertConversation({
              kommoChatId: `wa_${customerPhone}`,
              contactId: null,
              leadId: null,
              direction: "outgoing",
              messageTimestamp: normalized.createdAt,
            });

            const inserted = await insertMessage(conversationId, normalized);
            if (inserted) {
              // Create mapping for status tracking (dedup: echo arrived first)
              await createMapping({
                whatsappMessageId: echo.id,
                kommoConversationId: `wa_${customerPhone}`,
              });
              processedCount++;
            }
          } catch (err) {
            logger.error({ err, echoId: echo.id }, "[WhatsApp] Echo processing error");
          }
        }
      }
    }

    if (logId) await markProcessed(logId);
    if (processedCount > 0) {
      logger.info({ count: processedCount }, "[WhatsApp] Processed messages");
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "[WhatsApp] Processing error");
    if (logId) await markError(logId, errorMsg);
  }
});

/** Parse WhatsApp incoming message into NormalizedMessage */
export function parseWhatsAppMessage(
  msg: WhatsAppMessage,
  contactName: string | null,
  senderPhone: string | null
): NormalizedMessage | null {
  if (!msg.id) return null;

  const contentType = resolveContentType(msg.type);
  const textContent = extractTextContent(msg);
  const mediaUrl = extractMediaId(msg);

  const timestamp = msg.timestamp
    ? new Date(Number(msg.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  return {
    kommoMessageId: msg.id,
    kommoChatId: `wa_${normalizePhone(msg.from)}`,
    direction: "incoming",
    senderType: "customer",
    senderId: senderPhone ?? msg.from,
    contentType,
    textContent,
    mediaUrl,
    contactId: null,
    leadId: null,
    rawPayload: msg as unknown as Record<string, unknown>,
    createdAt: timestamp,
  };
}

/** Parse WhatsApp echo (outgoing via Business App) into NormalizedMessage */
export function parseWhatsAppEcho(echo: WhatsAppMessageEcho): NormalizedMessage | null {
  if (!echo.id) return null;

  const contentType = resolveContentType(echo.type);
  // Echo has same media sub-object structure as WhatsAppMessage
  const msgLike = echo as unknown as WhatsAppMessage;
  const textContent = extractTextContent(msgLike);
  const mediaUrl = extractMediaId(msgLike);

  const customerPhone = normalizePhone(echo.to);
  const timestamp = echo.timestamp
    ? new Date(Number(echo.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  return {
    kommoMessageId: echo.id,
    kommoChatId: `wa_${customerPhone}`,
    direction: "outgoing",
    senderType: "agent",
    senderId: echo.from,
    contentType,
    textContent,
    mediaUrl,
    contactId: null,
    leadId: null,
    rawPayload: echo as unknown as Record<string, unknown>,
    createdAt: timestamp,
  };
}

function resolveContentType(type: string): ContentType {
  const map: Record<string, ContentType> = {
    text: "text",
    image: "image",
    video: "video",
    audio: "voice",
    document: "file",
    location: "location",
    sticker: "sticker",
    contacts: "text",
  };
  return map[type] ?? "text";
}

function extractTextContent(msg: WhatsAppMessage): string | null {
  if (msg.text?.body) return msg.text.body;
  if (msg.image?.caption) return msg.image.caption;
  if (msg.video?.caption) return msg.video.caption;
  if (msg.document?.caption) return msg.document.caption;
  if (msg.location) {
    return `Location: ${msg.location.latitude},${msg.location.longitude}`;
  }
  return null;
}

function extractMediaId(msg: WhatsAppMessage): string | null {
  return msg.image?.id ?? msg.video?.id ?? msg.audio?.id
    ?? msg.document?.id ?? msg.sticker?.id ?? null;
}
