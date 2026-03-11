import crypto from "crypto";
import { timingSafeEqual } from "crypto";

/** Generate HMAC-SHA1 hex digest (Kommo ChatAPI signing) */
export function generateHmacSha1(body: string, secret: string): string {
  return crypto.createHmac("sha1", secret).update(body).digest("hex");
}

/** Verify HMAC-SHA1 signature with timing-safe comparison */
export function verifyHmacSha1(
  body: string,
  secret: string,
  signature: string
): boolean {
  const computed = generateHmacSha1(body, secret);
  if (computed.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

/** Generate MD5 hex digest of body (Kommo ChatAPI Content-MD5 header) */
export function generateContentMd5(body: string): string {
  return crypto.createHash("md5").update(body).digest("hex");
}

/** Generate all required headers for Kommo ChatAPI outgoing requests */
export function generateChatApiHeaders(
  body: string,
  secret: string
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Date: new Date().toUTCString(),
    "Content-MD5": generateContentMd5(body),
    "X-Signature": generateHmacSha1(body, secret),
  };
}

/** Verify WhatsApp Cloud API X-Hub-Signature-256 header (SHA256) */
export function verifyWhatsAppSignature(
  body: string,
  appSecret: string,
  signatureHeader: string
): boolean {
  const expectedPrefix = "sha256=";
  if (!signatureHeader.startsWith(expectedPrefix)) return false;

  const signature = signatureHeader.slice(expectedPrefix.length);
  const computed = crypto
    .createHmac("sha256", appSecret)
    .update(body)
    .digest("hex");

  if (computed.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}
