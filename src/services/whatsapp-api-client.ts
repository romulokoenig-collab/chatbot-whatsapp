import { env } from "../config/environment-config.js";

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

/** Send a text message via WhatsApp Cloud API */
export async function sendTextToWhatsApp(
  to: string,
  text: string
): Promise<{ whatsappMessageId: string } | null> {
  return sendToWhatsApp(to, {
    type: "text",
    text: { preview_url: false, body: text },
  });
}

/** Send a media message via WhatsApp Cloud API */
export async function sendMediaToWhatsApp(
  to: string,
  type: "image" | "video" | "audio" | "document",
  mediaUrl: string,
  caption?: string
): Promise<{ whatsappMessageId: string } | null> {
  const mediaPayload: Record<string, unknown> = { link: mediaUrl };
  if (caption) mediaPayload.caption = caption;

  return sendToWhatsApp(to, { type, [type]: mediaPayload });
}

/** Core send function for WhatsApp Cloud API */
async function sendToWhatsApp(
  to: string,
  messagePayload: Record<string, unknown>
): Promise<{ whatsappMessageId: string } | null> {
  const accessToken = env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    console.warn("[WhatsAppAPI] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
    return null;
  }

  const body = JSON.stringify({
    messaging_product: "whatsapp",
    to,
    ...messagePayload,
  });

  const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[WhatsAppAPI] Send failed (${response.status}):`, text);
      return null;
    }

    const result = (await response.json()) as Record<string, unknown>;
    const messages = result.messages as Array<{ id: string }> | undefined;
    const whatsappMessageId = messages?.[0]?.id ?? "";

    console.log("[WhatsAppAPI] Message sent to", to, "id:", whatsappMessageId);
    return { whatsappMessageId };
  } catch (err) {
    console.error("[WhatsAppAPI] Send error:", err instanceof Error ? err.message : err);
    return null;
  }
}
