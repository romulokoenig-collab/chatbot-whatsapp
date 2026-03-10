import { Router } from "express";
import type { Request, Response } from "express";
import { logRawWebhook, markProcessed, markError } from "./webhook-raw-logger.js";
import { upsertConversation } from "../services/conversation-service.js";
import { insertMessage } from "../services/message-service.js";
import type { NormalizedMessage } from "../types/kommo-webhook-types.js";
import type { ContentType, SenderType } from "../types/database-types.js";

export const kommoWebhookRouter = Router();

/** POST /webhooks/kommo — receive Kommo standard webhooks */
kommoWebhookRouter.post("/kommo", async (req: Request, res: Response) => {
  let logId: string | undefined;

  try {
    // Write-ahead: save raw payload immediately
    logId = await logRawWebhook(
      "kommo_standard",
      req.body as Record<string, unknown>,
      req.headers as Record<string, unknown>,
      detectEventType(req.body)
    );

    // Respond 200 immediately — Kommo expects fast response
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[KommoHandler] Failed to log raw webhook:", err);
    res.status(200).json({ ok: true }); // Still 200 to prevent Kommo retries
    return;
  }

  // Process async after response sent
  try {
    const messages = parseKommoPayload(req.body);

    for (const msg of messages) {
      const conversationId = await upsertConversation({
        kommoChatId: msg.kommoChatId,
        contactId: msg.contactId,
        leadId: msg.leadId,
        direction: msg.direction,
        messageTimestamp: msg.createdAt,
      });

      await insertMessage(conversationId, msg);
    }

    if (logId) await markProcessed(logId);
    console.log(`[KommoHandler] Processed ${messages.length} message(s)`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[KommoHandler] Processing error:", errorMsg);
    if (logId) await markError(logId, errorMsg);
  }
});

/** Detect event type from Kommo webhook body */
function detectEventType(body: Record<string, unknown>): string {
  if (body["message"] && typeof body["message"] === "object") return "message";
  if (body["note"] && typeof body["note"] === "object") return "note";
  return "unknown";
}

/** Parse Kommo urlencoded webhook body into normalized messages */
function parseKommoPayload(body: Record<string, unknown>): NormalizedMessage[] {
  const messages: NormalizedMessage[] = [];

  // Kommo sends message[add][0], message[add][1], etc.
  const messageData = body["message"] as Record<string, unknown> | undefined;
  if (!messageData) return messages;

  const addData = messageData["add"] as Record<string, unknown>[] | undefined;
  if (!addData || !Array.isArray(addData)) return messages;

  for (const item of addData) {
    const raw = item as Record<string, unknown>;
    const id = String(raw["id"] ?? "");
    const chatId = String(raw["chat_id"] ?? "");

    if (!id || !chatId) continue;

    const type = String(raw["type"] ?? "incoming");
    const direction = type === "outgoing" ? "outgoing" : "incoming";

    const author = raw["author"] as Record<string, unknown> | undefined;
    const senderType = resolveSenderType(direction, author);

    const createdAtRaw = raw["created_at"];
    const createdAt = createdAtRaw
      ? new Date(Number(createdAtRaw) * 1000).toISOString()
      : new Date().toISOString();

    const attachment = raw["attachment"] as Record<string, unknown> | undefined;

    messages.push({
      kommoMessageId: id,
      kommoChatId: chatId,
      direction,
      senderType,
      senderId: author?.["id"] ? String(author["id"]) : null,
      contentType: resolveContentType(raw, attachment),
      textContent: raw["text"] ? String(raw["text"]) : null,
      mediaUrl: attachment?.["url"] ? String(attachment["url"]) : null,
      contactId: raw["contact_id"] ? String(raw["contact_id"]) : null,
      leadId: raw["lead_id"] ? String(raw["lead_id"]) : null,
      rawPayload: raw,
      createdAt,
    });
  }

  return messages;
}

/** Determine sender type based on direction and author info */
function resolveSenderType(
  direction: "incoming" | "outgoing",
  author?: Record<string, unknown>
): SenderType {
  if (direction === "incoming") return "customer";
  const authorType = author?.["type"] ? String(author["type"]) : "";
  if (authorType === "bot") return "bot";
  if (authorType === "system") return "system";
  return "agent";
}

/** Determine content type from message data */
function resolveContentType(
  raw: Record<string, unknown>,
  attachment?: Record<string, unknown>
): ContentType {
  if (!attachment) return "text";
  const type = String(attachment["type"] ?? "file");
  const validTypes: ContentType[] = ["image", "video", "file", "voice", "location", "sticker"];
  return validTypes.includes(type as ContentType) ? (type as ContentType) : "file";
}
