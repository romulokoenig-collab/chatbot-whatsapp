import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  generateHmacSha1,
  verifyHmacSha1,
  generateContentMd5,
  generateChatApiHeaders,
  verifyWhatsAppSignature,
} from "../utils/hmac-signature.js";

describe("generateHmacSha1", () => {
  it("generates correct HMAC-SHA1 hex digest", () => {
    const body = '{"test":"data"}';
    const secret = "my-secret";
    const expected = crypto.createHmac("sha1", secret).update(body).digest("hex");
    expect(generateHmacSha1(body, secret)).toBe(expected);
  });

  it("returns different hashes for different secrets", () => {
    const body = '{"test":"data"}';
    const hash1 = generateHmacSha1(body, "secret1");
    const hash2 = generateHmacSha1(body, "secret2");
    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyHmacSha1", () => {
  it("returns true for valid signature", () => {
    const body = '{"message":"hello"}';
    const secret = "channel-secret";
    const signature = generateHmacSha1(body, secret);
    expect(verifyHmacSha1(body, secret, signature)).toBe(true);
  });

  it("returns false for invalid signature", () => {
    const body = '{"message":"hello"}';
    const secret = "channel-secret";
    expect(verifyHmacSha1(body, secret, "invalid-signature-hex")).toBe(false);
  });

  it("returns false for tampered body", () => {
    const secret = "channel-secret";
    const signature = generateHmacSha1('{"original":"data"}', secret);
    expect(verifyHmacSha1('{"tampered":"data"}', secret, signature)).toBe(false);
  });

  it("returns false for wrong-length signature", () => {
    const body = '{"test":"data"}';
    const secret = "secret";
    expect(verifyHmacSha1(body, secret, "short")).toBe(false);
  });
});

describe("generateContentMd5", () => {
  it("generates correct MD5 hex digest", () => {
    const body = '{"test":"data"}';
    const expected = crypto.createHash("md5").update(body).digest("hex");
    expect(generateContentMd5(body)).toBe(expected);
  });
});

describe("generateChatApiHeaders", () => {
  it("returns all required headers", () => {
    const body = '{"test":"data"}';
    const secret = "my-secret";
    const headers = generateChatApiHeaders(body, secret);

    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Date"]).toBeTruthy();
    expect(headers["Content-MD5"]).toBe(generateContentMd5(body));
    expect(headers["X-Signature"]).toBe(generateHmacSha1(body, secret));
  });
});

describe("verifyWhatsAppSignature", () => {
  it("returns true for valid sha256 signature", () => {
    const body = '{"entry":[]}';
    const appSecret = "app-secret-123";
    const hash = crypto.createHmac("sha256", appSecret).update(body).digest("hex");
    const header = `sha256=${hash}`;
    expect(verifyWhatsAppSignature(body, appSecret, header)).toBe(true);
  });

  it("returns false for invalid signature", () => {
    const body = '{"entry":[]}';
    const appSecret = "app-secret-123";
    expect(verifyWhatsAppSignature(body, appSecret, "sha256=invalid")).toBe(false);
  });

  it("returns false for missing sha256= prefix", () => {
    const body = '{"entry":[]}';
    const appSecret = "app-secret-123";
    const hash = crypto.createHmac("sha256", appSecret).update(body).digest("hex");
    expect(verifyWhatsAppSignature(body, appSecret, hash)).toBe(false);
  });
});
