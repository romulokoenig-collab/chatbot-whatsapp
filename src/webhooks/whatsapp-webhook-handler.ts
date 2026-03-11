import { Router } from "express";
import type { Request, Response } from "express";
import { timingSafeEqual } from "crypto";
import { env } from "../config/environment-config.js";
import { verifyWhatsAppSignature } from "../utils/hmac-signature.js";
import { logRawWebhook, markProcessed, markError } from "./webhook-raw-logger.js";
import { upsertConversation } from "../services/conversation-service.js";
import { insertMessage } from "../services/message-service.js";
import { bridgeWhatsAppToKommo } from "../services/message-bridge-service.js";
import { updateDeliveryStatus } from "../services/message-mapping-service.js";
import type { NormalizedMessage } from "../types/kommo-webhook-types.js";
import type { WhatsAppWebhookPayload, WhatsAppMessage } from "../types/whatsapp-webhook-types.js";
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
    console.log("[WhatsApp] Verification challenge accepted");
    res.status(200).send(challenge);
    return;
  }

  console.warn("[WhatsApp] Verification failed — wrong token");
  res.status(403).send("Forbidden");
});

/** POST /webhooks/whatsapp — receive incoming messages from WhatsApp Cloud API */
whatsAppWebhookRouter.post("/whatsapp", async (req: Request, res: Response) => {
  // Verify signature if app secret is configured
  if (env.WHATSAPP_APP_SECRET) {
    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    const rawBody = (req as unknown as Record<string, unknown>).rawBody as string
      ?? JSON.stringify(req.body);

    if (!signature || !verifyWhatsAppSignature(rawBody, env.WHATSAPP_APP_SECRET, signature)) {
      console.warn("[WhatsApp] Invalid signature, rejecting webhook");
      res.status(200).send(); // Silent reject
      return;
    }
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
    console.error("[WhatsApp] Failed to log raw webhook:", err);
    res.status(200).json({ ok: true });
    return;
  }

  // Process async after response
  try {
    const payload = req.body as WhatsAppWebhookPayload;
    let processedCount = 0;

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;
        const value = change.value;

        // Handle delivery status updates
        for (const status of value.statuses ?? []) {
          await updateDeliveryStatus(status.id, status.status);
        }

        // Handle incoming messages
        const contactName = value.contacts?.[0]?.profile?.name ?? null;
        const senderPhone = value.contacts?.[0]?.wa_id ?? null;

        for (const msg of value.messages ?? []) {
          const normalized = parseWhatsAppMessage(msg, contactName, senderPhone);
          if (!normalized) continue;

          const conversationId = await upsertConversation({
            kommoChatId: `wa_${msg.from}`,
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
      }
    }

    if (logId) await markProcessed(logId);
    if (processedCount > 0) {
      console.log(`[WhatsApp] Processed ${processedCount} incoming message(s)`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[WhatsApp] Processing error:", errorMsg);
    if (logId) await markError(logId, errorMsg);
  }
});

/** Parse WhatsApp message into NormalizedMessage */
function parseWhatsAppMessage(
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
    kommoChatId: `wa_${msg.from}`,
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
