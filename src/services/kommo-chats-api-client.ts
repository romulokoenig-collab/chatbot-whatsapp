import { generateHmacSha1, generateContentMd5 } from "../utils/hmac-signature.js";
import { logger } from "../config/logger.js";
import { env } from "../config/environment-config.js";

const KOMMO_CHAT_API_BASE = "https://amojo.kommo.com/v2/origin/custom";

export interface ChatHistoryMessage {
  id: string;
  text: string | null;
  direction: "incoming" | "outgoing";
  senderType: string;
  senderId: string | null;
  mediaUrl: string | null;
  timestamp: string; // ISO string
}

/** Raw message shape returned by Kommo Chat History API */
interface KommoRawMessage {
  id?: string;
  msgid?: string;
  message?: {
    text?: string;
    media?: string;
    type?: string;
  };
  author?: {
    id?: string;
    type?: string;
  };
  created_at?: number;
  timestamp?: number;
  // origin: "0" = incoming, "1" = outgoing (Kommo convention)
  origin?: string | number;
}

interface KommoHistoryResponse {
  items?: KommoRawMessage[];
  messages?: KommoRawMessage[];
  next?: string | null;
}

/**
 * Sign a GET request: HMAC-SHA1(secret, MD5(method + path))
 * Per Kommo Chats API authentication spec.
 */
function signGetRequest(method: string, path: string, secret: string): string {
  const checksum = generateContentMd5(method + path);
  return generateHmacSha1(checksum, secret);
}

function mapDirection(raw: KommoRawMessage): "incoming" | "outgoing" {
  const origin = raw.origin !== undefined ? String(raw.origin) : null;
  if (origin === "1") return "outgoing";
  return "incoming";
}

function mapMessage(raw: KommoRawMessage): ChatHistoryMessage {
  const epochSeconds = raw.created_at ?? raw.timestamp ?? 0;
  return {
    id: String(raw.id ?? raw.msgid ?? ""),
    text: raw.message?.text ?? null,
    direction: mapDirection(raw),
    senderType: raw.author?.type ?? "unknown",
    senderId: raw.author?.id ? String(raw.author.id) : null,
    mediaUrl: raw.message?.media ?? null,
    timestamp: new Date(epochSeconds * 1000).toISOString(),
  };
}

/**
 * Fetch full chat history for a given conversation from Kommo Chat History API.
 * Supports offset-based pagination, collecting all pages automatically.
 *
 * Throws if KOMMO_SCOPE_ID or KOMMO_CHANNEL_SECRET are not configured.
 * Returns an empty array on recoverable HTTP/network errors.
 */
export async function fetchChatHistory(
  conversationId: string,
  options: { limit?: number; offsetId?: string } = {}
): Promise<ChatHistoryMessage[]> {
  const scopeId = env.KOMMO_SCOPE_ID;
  const channelSecret = env.KOMMO_CHANNEL_SECRET;

  if (!scopeId || !channelSecret) {
    throw new Error(
      "[KommoChatsAPI] KOMMO_SCOPE_ID and KOMMO_CHANNEL_SECRET are required"
    );
  }

  const results: ChatHistoryMessage[] = [];
  const limit = options.limit ?? 100;
  let offsetId = options.offsetId ?? null;
  let page = 0;
  const MAX_PAGES = 20; // safety cap

  do {
    const params = new URLSearchParams({ limit: String(limit) });
    if (offsetId) params.set("offset_id", offsetId);

    const path = `/v2/origin/custom/${scopeId}/chats/${conversationId}/history?${params}`;
    const signature = signGetRequest("GET", path, channelSecret);

    try {
      const response = await fetch(`https://amojo.kommo.com${path}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signature,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        logger.error(
          { conversationId, status: response.status, body: text },
          "[KommoChatsAPI] History fetch failed"
        );
        return results.length > 0 ? results : [];
      }

      const data = (await response.json()) as KommoHistoryResponse;
      const items = data.items ?? data.messages ?? [];

      for (const item of items) {
        results.push(mapMessage(item));
      }

      // Advance pagination cursor
      offsetId = data.next ?? null;
      page++;
    } catch (err) {
      logger.error({ err }, "[KommoChatsAPI] Network error fetching history");
      return results.length > 0 ? results : [];
    }
  } while (offsetId && page < MAX_PAGES);

  logger.info({ count: results.length, conversationId }, "[KommoChatsAPI] Fetched chat history");
  return results;
}

export { KOMMO_CHAT_API_BASE };
