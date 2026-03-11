import { describe, it, expect, beforeAll } from "vitest";
import type { WhatsAppMessageEcho } from "../types/whatsapp-webhook-types.js";
import type { WhatsAppMessage } from "../types/whatsapp-webhook-types.js";

// Set env vars BEFORE importing modules that trigger environment-config.ts
beforeAll(() => {
  process.env.SUPABASE_URL = "https://fake.supabase.co";
  process.env.SUPABASE_ANON_KEY = "fake-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
  process.env.API_KEY = "test-api-key";
  process.env.WHATSAPP_APP_SECRET = "test-app-secret";
  process.env.NODE_ENV = "test";
});

// Dynamic import after env vars are set — used in tests below
let parseWhatsAppEcho: typeof import("../webhooks/whatsapp-webhook-handler.js").parseWhatsAppEcho;
let parseWhatsAppMessage: typeof import("../webhooks/whatsapp-webhook-handler.js").parseWhatsAppMessage;

beforeAll(async () => {
  const mod = await import("../webhooks/whatsapp-webhook-handler.js");
  parseWhatsAppEcho = mod.parseWhatsAppEcho;
  parseWhatsAppMessage = mod.parseWhatsAppMessage;
});

describe("parseWhatsAppEcho", () => {
  it("parses text echo into outgoing NormalizedMessage", () => {
    const echo: WhatsAppMessageEcho = {
      from: "+5551999999999",
      to: "5551988888888",
      id: "wamid.echo123",
      timestamp: "1700000000",
      type: "text",
      text: { body: "Hello from agent" },
    };
    const result = parseWhatsAppEcho(echo);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("outgoing");
    expect(result!.senderType).toBe("agent");
    expect(result!.kommoChatId).toBe("wa_5551988888888");
    expect(result!.textContent).toBe("Hello from agent");
    expect(result!.senderId).toBe("+5551999999999");
  });

  it("parses image echo with caption", () => {
    const echo: WhatsAppMessageEcho = {
      from: "+5551999999999",
      to: "5551988888888",
      id: "wamid.echo456",
      timestamp: "1700000000",
      type: "image",
      image: { id: "media_123", caption: "Check this" },
    };
    const result = parseWhatsAppEcho(echo);
    expect(result!.contentType).toBe("image");
    expect(result!.textContent).toBe("Check this");
    expect(result!.mediaUrl).toBe("media_123");
  });

  it("returns null for echo without id", () => {
    const echo: WhatsAppMessageEcho = {
      from: "x", to: "y", id: "", timestamp: "0", type: "text",
    };
    const result = parseWhatsAppEcho(echo);
    expect(result).toBeNull();
  });

  it("defaults timestamp to now when missing", () => {
    const echo: WhatsAppMessageEcho = {
      from: "x", to: "y", id: "abc", timestamp: "", type: "text",
      text: { body: "hi" },
    };
    const result = parseWhatsAppEcho(echo);
    expect(result).not.toBeNull();
    const diff = Date.now() - new Date(result!.createdAt).getTime();
    expect(diff).toBeLessThan(2000);
  });

  it("normalizes phone number with + prefix in to field", () => {
    const echo: WhatsAppMessageEcho = {
      from: "5551999999999",
      to: "+5551988888888",
      id: "wamid.echo789",
      timestamp: "1700000000",
      type: "text",
      text: { body: "test" },
    };
    const result = parseWhatsAppEcho(echo);
    expect(result!.kommoChatId).toBe("wa_5551988888888");
  });
});

describe("parseWhatsAppMessage", () => {
  it("parses incoming text message", () => {
    const msg = {
      from: "5551988888888",
      id: "wamid.msg123",
      timestamp: "1700000000",
      type: "text",
      text: { body: "Hello" },
    } as WhatsAppMessage;
    const result = parseWhatsAppMessage(msg, "John", "5551988888888");
    expect(result!.direction).toBe("incoming");
    expect(result!.senderType).toBe("customer");
    expect(result!.textContent).toBe("Hello");
  });

  it("returns null for message without id", () => {
    const msg = {
      from: "x", id: "", timestamp: "0", type: "text",
    } as WhatsAppMessage;
    const result = parseWhatsAppMessage(msg, null, null);
    expect(result).toBeNull();
  });

  it("normalizes phone in kommoChatId", () => {
    const msg = {
      from: "+5551988888888",
      id: "wamid.msg456",
      timestamp: "1700000000",
      type: "text",
      text: { body: "Hi" },
    } as WhatsAppMessage;
    const result = parseWhatsAppMessage(msg, null, null);
    expect(result!.kommoChatId).toBe("wa_5551988888888");
  });
});
