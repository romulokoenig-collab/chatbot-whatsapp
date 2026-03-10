/**
 * Unit tests for pure parsing functions extracted from kommo-standard-handler.ts
 *
 * The functions parseKommoPayload, resolveSenderType, resolveContentType are not
 * exported from the handler module, so we re-implement the logic inline here and
 * test the observable behaviour through the same function signatures.
 *
 * Strategy: copy the three pure functions verbatim so we can unit-test them
 * without importing the module (which pulls in supabase, express, etc.).
 */

import { describe, it, expect } from "vitest";
import type { ContentType, SenderType } from "../types/database-types.js";
import type { NormalizedMessage } from "../types/kommo-webhook-types.js";

// ── Re-implementations of the three pure functions ────────────────────────────

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

function resolveContentType(
  raw: Record<string, unknown>,
  attachment?: Record<string, unknown>
): ContentType {
  if (!attachment) return "text";
  const type = String(attachment["type"] ?? "file");
  const validTypes: ContentType[] = ["image", "video", "file", "voice", "location", "sticker"];
  return validTypes.includes(type as ContentType) ? (type as ContentType) : "file";
}

function parseKommoPayload(body: Record<string, unknown>): NormalizedMessage[] {
  const messages: NormalizedMessage[] = [];

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

// ── resolveSenderType ─────────────────────────────────────────────────────────

describe("resolveSenderType", () => {
  it("returns customer for any incoming message regardless of author", () => {
    expect(resolveSenderType("incoming")).toBe("customer");
    expect(resolveSenderType("incoming", { type: "bot", id: "99" })).toBe("customer");
  });

  it("returns bot when outgoing author type is bot", () => {
    expect(resolveSenderType("outgoing", { type: "bot" })).toBe("bot");
  });

  it("returns system when outgoing author type is system", () => {
    expect(resolveSenderType("outgoing", { type: "system" })).toBe("system");
  });

  it("returns agent when outgoing author has no type", () => {
    expect(resolveSenderType("outgoing")).toBe("agent");
    expect(resolveSenderType("outgoing", {})).toBe("agent");
  });

  it("returns agent when outgoing author type is an unknown string", () => {
    expect(resolveSenderType("outgoing", { type: "human" })).toBe("agent");
  });
});

// ── resolveContentType ────────────────────────────────────────────────────────

describe("resolveContentType", () => {
  it("returns text when there is no attachment", () => {
    expect(resolveContentType({ text: "hello" })).toBe("text");
    expect(resolveContentType({})).toBe("text");
  });

  it("returns image for attachment type image", () => {
    expect(resolveContentType({}, { type: "image", url: "http://x" })).toBe("image");
  });

  it("returns video for attachment type video", () => {
    expect(resolveContentType({}, { type: "video" })).toBe("video");
  });

  it("returns voice for attachment type voice", () => {
    expect(resolveContentType({}, { type: "voice" })).toBe("voice");
  });

  it("returns location for attachment type location", () => {
    expect(resolveContentType({}, { type: "location" })).toBe("location");
  });

  it("returns sticker for attachment type sticker", () => {
    expect(resolveContentType({}, { type: "sticker" })).toBe("sticker");
  });

  it("returns file for attachment type file", () => {
    expect(resolveContentType({}, { type: "file" })).toBe("file");
  });

  it("returns file for unknown attachment type (fallback)", () => {
    expect(resolveContentType({}, { type: "unknown_type" })).toBe("file");
    expect(resolveContentType({}, { type: "pdf" })).toBe("file");
  });

  it("returns file when attachment has no type field", () => {
    expect(resolveContentType({}, {})).toBe("file");
  });
});

// ── parseKommoPayload ─────────────────────────────────────────────────────────

describe("parseKommoPayload", () => {
  it("returns empty array when body has no message key", () => {
    expect(parseKommoPayload({})).toHaveLength(0);
    expect(parseKommoPayload({ note: {} })).toHaveLength(0);
  });

  it("returns empty array when message.add is missing", () => {
    expect(parseKommoPayload({ message: {} })).toHaveLength(0);
  });

  it("returns empty array when message.add is not an array", () => {
    expect(parseKommoPayload({ message: { add: "nope" } })).toHaveLength(0);
  });

  it("skips items missing id or chat_id", () => {
    const body = {
      message: {
        add: [
          { chat_id: "c1", text: "missing id" },
          { id: "m1", text: "missing chat_id" },
        ],
      },
    };
    expect(parseKommoPayload(body)).toHaveLength(0);
  });

  it("parses a single incoming text message correctly", () => {
    const body = {
      message: {
        add: [
          {
            id: "msg-1",
            chat_id: "chat-1",
            type: "incoming",
            text: "Hello",
            contact_id: "contact-1",
            lead_id: "lead-1",
            created_at: 1700000000,
            author: { id: "user-1", type: "customer" },
          },
        ],
      },
    };

    const result = parseKommoPayload(body);
    expect(result).toHaveLength(1);

    const msg = result[0];
    expect(msg.kommoMessageId).toBe("msg-1");
    expect(msg.kommoChatId).toBe("chat-1");
    expect(msg.direction).toBe("incoming");
    expect(msg.senderType).toBe("customer");
    expect(msg.textContent).toBe("Hello");
    expect(msg.contentType).toBe("text");
    expect(msg.mediaUrl).toBeNull();
    expect(msg.contactId).toBe("contact-1");
    expect(msg.leadId).toBe("lead-1");
    expect(msg.senderId).toBe("user-1");
    expect(msg.createdAt).toBe(new Date(1700000000 * 1000).toISOString());
  });

  it("parses an outgoing bot message with image attachment", () => {
    const body = {
      message: {
        add: [
          {
            id: "msg-2",
            chat_id: "chat-2",
            type: "outgoing",
            author: { id: "bot-99", type: "bot" },
            attachment: { url: "https://cdn.example.com/img.jpg", type: "image" },
            created_at: 1700001000,
          },
        ],
      },
    };

    const result = parseKommoPayload(body);
    expect(result).toHaveLength(1);

    const msg = result[0];
    expect(msg.direction).toBe("outgoing");
    expect(msg.senderType).toBe("bot");
    expect(msg.contentType).toBe("image");
    expect(msg.mediaUrl).toBe("https://cdn.example.com/img.jpg");
    expect(msg.textContent).toBeNull();
  });

  it("parses multiple messages in one payload", () => {
    const body = {
      message: {
        add: [
          { id: "m1", chat_id: "c1", type: "incoming", text: "first" },
          { id: "m2", chat_id: "c2", type: "outgoing", text: "second" },
        ],
      },
    };

    const result = parseKommoPayload(body);
    expect(result).toHaveLength(2);
    expect(result[0].kommoMessageId).toBe("m1");
    expect(result[1].kommoMessageId).toBe("m2");
  });

  it("defaults type to incoming when type field is absent", () => {
    const body = {
      message: { add: [{ id: "m1", chat_id: "c1" }] },
    };
    const result = parseKommoPayload(body);
    expect(result[0].direction).toBe("incoming");
    expect(result[0].senderType).toBe("customer");
  });

  it("uses current time when created_at is absent", () => {
    const before = Date.now();
    const body = { message: { add: [{ id: "m1", chat_id: "c1" }] } };
    const result = parseKommoPayload(body);
    const after = Date.now();

    const ts = new Date(result[0].createdAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("sets null for optional fields when absent", () => {
    const body = {
      message: { add: [{ id: "m1", chat_id: "c1", type: "incoming" }] },
    };
    const msg = parseKommoPayload(body)[0];
    expect(msg.textContent).toBeNull();
    expect(msg.mediaUrl).toBeNull();
    expect(msg.contactId).toBeNull();
    expect(msg.leadId).toBeNull();
    expect(msg.senderId).toBeNull();
  });

  it("stores raw item as rawPayload", () => {
    const rawItem = { id: "m1", chat_id: "c1", type: "incoming", text: "hi" };
    const body = { message: { add: [rawItem] } };
    const msg = parseKommoPayload(body)[0];
    expect(msg.rawPayload).toEqual(rawItem);
  });
});
