# Code Standards - Kommo WhatsApp Backend

## File Organization

### Directory Structure

```
src/
├── server.ts                    # Entry point (starts app)
├── app.ts                       # Express app setup
├── config/
│   ├── environment-config.ts    # Zod schema, env validation (Phase B + A + A2 + A3)
│   ├── logger.ts                # Pino structured logger (Phase A3)
│   └── supabase-client.ts       # Supabase instance
├── types/
│   ├── database-types.ts        # Database enums and types
│   ├── kommo-webhook-types.ts   # Kommo standard webhook payload types
│   ├── chatapi-webhook-types.ts # Phase A: Kommo ChatAPI webhook types
│   └── whatsapp-webhook-types.ts # Phase A + A2: WhatsApp Cloud API types
├── utils/
│   ├── app-error.ts             # Structured error class (Phase A3)
│   ├── hmac-signature.ts        # HMAC-SHA1 & SHA256 signature verification
│   └── normalize-phone.ts       # Phase A2: Phone number normalization
├── webhooks/
│   ├── kommo-standard-handler.ts # Phase B: Kommo standard webhook handler
│   ├── chatapi-webhook-handler.ts # Phase A: Kommo ChatAPI webhook handler
│   ├── whatsapp-webhook-handler.ts # Phase A + A2: WhatsApp Cloud API handler with echo support
│   └── webhook-raw-logger.ts    # Write-ahead log service (all phases)
├── services/
│   ├── conversation-service.ts  # Upsert, query conversations
│   ├── message-service.ts       # Insert, query messages
│   ├── trigger-service.ts       # Automation triggers (no-response, no-followup)
│   ├── message-bridge-service.ts # Phase A: Bidirectional message forwarding
│   ├── message-mapping-service.ts # Phase A: Message ID correlation tracking
│   ├── kommo-chatapi-client.ts  # Phase A: Kommo ChatAPI HTTP client
│   ├── kommo-chats-api-client.ts # Phase A3: Kommo Chat History API HMAC client
│   └── whatsapp-api-client.ts   # Phase A: WhatsApp Cloud API HTTP client
├── api/
│   ├── conversation-routes.ts   # GET /api/conversations*
│   ├── trigger-routes.ts        # GET /api/triggers/*
│   └── health-routes.ts         # GET /health
├── middleware/
│   ├── api-auth-middleware.ts   # x-api-key validation
│   └── error-handler.ts         # Global error handling (Phase A3)
└── __tests__/                   # Unit + integration tests
    ├── *.test.ts
    ├── hmac-signature.test.ts    # Phase A3: HMAC utilities tests
    └── fixtures/
```

### File Naming Conventions

- **TS/JS Files**: kebab-case (e.g., `api-auth-middleware.ts`)
- **Components**: Describe purpose explicitly
  - Service files: `{entity}-service.ts`
  - Routes: `{entity}-routes.ts`
  - Middleware: `{name}-middleware.ts`
  - Types: `{domain}-types.ts`
  - Config: `{aspect}-config.ts`
  - Utilities: `{purpose}.ts` or `{purpose}-utility.ts`

### Size Limits

- **Max 200 lines per file** (excluding comments, blanks)
- **If exceeding limit**: Split into smaller modules
- **Example**: If `conversation-service.ts` grows > 200 lines, extract into:
  - `conversation-service.ts` (upsert, basic queries)
  - `conversation-queries.ts` (complex filters, joins)

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Key Settings:**
- `strict: true` — Enables all strict type checks
- `ES2022` — Supports latest JavaScript features
- `NodeNext` — Proper Node.js module resolution with .js extensions

## Naming Conventions

### Variables & Functions

- **camelCase** for all JS/TS identifiers
  ```typescript
  const apiKey = process.env.API_KEY;
  function parseKommoPayload(body: Record<string, unknown>) { ... }
  function normalizePhone(phone: string): string { ... }
  ```

- **UPPER_SNAKE_CASE** for constants
  ```typescript
  const MAX_WEBHOOK_PAYLOAD_SIZE = 50000;
  const DEFAULT_HOURS = 24;
  const PHONE_REGEX = /[\s\-+]/g;
  const MAX_PAGES = 20;
  ```

- **PascalCase** for types and interfaces
  ```typescript
  type NormalizedMessage = { ... };
  interface ConversationRow { ... };
  enum ConversationStatus { ... }
  type WhatsAppMessageEcho = { ... };
  type ChatHistoryMessage = { ... };
  ```

### Database References

- **Snake_case** for table/column names in SQL
  ```sql
  SELECT kommo_chat_id, contact_id FROM conversations
  ```

- **Match database case exactly in code comments**
  ```typescript
  // kommo_chat_id — maps to conversations.kommo_chat_id
  // smb_message_echoes — WhatsApp message_echoes field
  // delivery_status — Message delivery tracking column
  ```

## Code Patterns

### Environment Configuration

All env vars validated at startup with Zod:

```typescript
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  API_KEY: z.string().min(1),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  WHATSAPP_APP_SECRET: z.string().min(1), // Phase A2: Now required
  KOMMO_SCOPE_ID: z.string().optional(),
  KOMMO_CHANNEL_SECRET: z.string().optional(),
  // ...
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  process.stderr.write("Invalid environment variables:\n");
  for (const issue of parsed.error.issues) {
    process.stderr.write(`  - ${issue.path.join(".")}: ${issue.message}\n`);
  }
  process.exit(1);
}

export const env = parsed.data;
```

**Pattern:**
1. Define Zod schema
2. Parse process.env at module load
3. Exit if validation fails
4. Export immutable `env` object
5. All code imports from `env`, never process.env directly

### Structured Logging with Pino

Use Pino logger instead of console.log:

```typescript
import { logger } from "../config/logger.js";

// Object-first pattern: data first, message second
logger.info({ conversationId, count: messages.length }, "[MessageService] Messages fetched");

logger.debug({ payload }, "[WebhookHandler] Received webhook");

logger.warn({ status: response.status }, "[KommoChatsAPI] Non-2xx response");

logger.error({ err, context: "processing" }, "[TriggerService] Query failed");
```

**Pattern:**
- Always use Pino logger, never `console.log/error/warn`
- Object-first: `logger.level({ data }, "message")`
- Include module name in brackets for traceability
- Include relevant context objects for debugging
- Log level is configurable via `LOG_LEVEL` env var

### Error Handling with AppError

Use structured `AppError` class for application errors:

```typescript
import { AppError } from "../utils/app-error.js";
import { logger } from "../config/logger.js";

// In route handlers, throw AppError
export async function triggerRoutes(req: Request, res: Response, next: NextFunction) {
  try {
    const hours = Number(req.query.hours ?? 24);
    if (isNaN(hours) || hours < 0) {
      throw AppError.badRequest("hours must be a non-negative number");
    }

    const data = await getUnrespondedLeads(hours);
    res.json({ data, count: data.length, hours });
  } catch (err) {
    next(err); // Delegate to error-handler middleware
  }
}

// Catch at global error-handler middleware
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    logger.error({ statusCode: err.statusCode, code: err.code, err }, "[ErrorHandler] AppError");
    const body: Record<string, unknown> = { error: { code: err.code, message: err.message } };
    if (env.NODE_ENV !== "production") body.stack = err.stack;
    res.status(err.statusCode).json(body);
    return;
  }

  logger.error({ err }, "[ErrorHandler] Unhandled error");
  const body: Record<string, unknown> = { error: { code: "INTERNAL_ERROR", message: "Internal server error" } };
  if (env.NODE_ENV !== "production") body.stack = err.stack;
  res.status(500).json(body);
}
```

**Error codes available:**
- `AppError.badRequest(msg)` → 400 BAD_REQUEST
- `AppError.notFound(msg)` → 404 NOT_FOUND
- `AppError.internal()` → 500 INTERNAL_ERROR

**Pattern:**
- Throw AppError in route handlers with specific code + message
- Use `next(err)` to delegate to error handler
- Error handler returns structured `{error: {code, message}}` format
- Stack traces only in non-production via `NODE_ENV` check

### Timing-Safe Comparisons

For security-sensitive operations (API keys, tokens):

```typescript
import { timingSafeEqual } from "node:crypto";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Usage in middleware
if (!safeCompare(apiKey, env.API_KEY)) {
  throw AppError.badRequest("Invalid API key");
}
```

**Why:** Prevents timing attacks that leak key information.

### HMAC Signature Verification (Phase A)

For webhook signature validation (Kommo ChatAPI and WhatsApp):

```typescript
import { createHmac } from "node:crypto";

// HMAC-SHA1 (Kommo ChatAPI)
function verifyKommoSignature(rawBody: string, signature: string, secret: string): boolean {
  const computed = createHmac("sha1", secret)
    .update(rawBody)
    .digest("base64");
  return safeCompare(computed, signature);
}

// HMAC-SHA256 (WhatsApp)
function verifyWhatsAppSignature(rawBody: string, signature: string, secret: string): boolean {
  const computed = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const expected = `sha256=${computed}`;
  return safeCompare(expected, signature);
}

// Usage in webhook handler
export async function handleWhatsAppWebhook(req: Request, res: Response) {
  const signature = req.headers["x-hub-signature-256"] as string;
  const rawBody = req.body; // Must be raw string, not parsed JSON

  if (!verifyWhatsAppSignature(rawBody, signature, env.WHATSAPP_APP_SECRET)) {
    throw AppError.badRequest("Invalid signature");
  }
  // Process webhook
}
```

**Pattern:**
- Always verify signature before processing
- Use raw request body (not parsed JSON)
- Store signatures in environment variables
- Use timing-safe comparison

### Kommo Chat History API Client (Phase A3)

For fetching full chat history with HMAC-SHA1 signing:

```typescript
import { generateHmacSha1, generateContentMd5 } from "../utils/hmac-signature.js";
import { logger } from "../config/logger.js";

/**
 * Fetch full chat history for a conversation from Kommo Chat History API.
 * Uses HMAC-SHA1(MD5("GET" + path), secret) signing per Kommo spec.
 * Auto-paginates with offset_id cursor, caps at MAX_PAGES=20.
 */
export async function fetchChatHistory(
  conversationId: string,
  options: { limit?: number; offsetId?: string } = {}
): Promise<ChatHistoryMessage[]> {
  const scopeId = env.KOMMO_SCOPE_ID;
  const channelSecret = env.KOMMO_CHANNEL_SECRET;

  if (!scopeId || !channelSecret) {
    throw new Error("[KommoChatsAPI] KOMMO_SCOPE_ID and KOMMO_CHANNEL_SECRET are required");
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
    const checksum = generateContentMd5("GET" + path);
    const signature = generateHmacSha1(checksum, channelSecret);

    try {
      const response = await fetch(`https://amojo.kommo.com${path}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signature,
        },
      });

      if (!response.ok) {
        logger.error({ status: response.status }, "[KommoChatsAPI] History fetch failed");
        return results.length > 0 ? results : [];
      }

      const data = await response.json() as { items?: unknown[]; next?: string | null };
      const items = data.items ?? [];

      for (const item of items) {
        results.push(mapMessage(item));
      }

      offsetId = data.next ?? null;
      page++;
    } catch (err) {
      logger.error({ err }, "[KommoChatsAPI] Network error");
      return results.length > 0 ? results : [];
    }
  } while (offsetId && page < MAX_PAGES);

  logger.info({ count: results.length }, "[KommoChatsAPI] Fetched chat history");
  return results;
}
```

**Pattern:**
- Use MD5 hash of request (method + path) as HMAC input
- Auto-paginate with offset_id cursor
- Cap at MAX_PAGES=20 to prevent runaway requests
- Log success/failure with counts
- Return empty array on recoverable errors, throw on config errors

### Phone Number Normalization (Phase A2)

For consistent phone number formatting to prevent duplicate conversations:

```typescript
// utils/normalize-phone.ts
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  // Strip +, spaces, dashes, leading zeros
  return phone
    .replace(/^\+/, "")        // Strip leading +
    .replace(/[\s\-]/g, "")    // Strip spaces/dashes
    .replace(/^0+/, "");        // Strip leading zeros
}

// Usage in webhook handler
export async function handleWhatsAppEcho(echo: WhatsAppMessageEcho) {
  const normalizedPhone = normalizePhone(echo.message?.from);
  const conversationId = `whatsapp-${normalizedPhone}`;
  // Store message using normalized phone
}
```

**Pattern:**
- Normalize phone numbers consistently across all processing
- Use in conversation ID generation to prevent duplicates
- Handle null/undefined safely
- Strip formatting characters and leading zeros

### Service Pattern

Services encapsulate business logic:

```typescript
// conversation-service.ts
export async function upsertConversation(data: ConversationInput): Promise<string> {
  // Handle creation or update
  return conversationId;
}

export async function getConversations(filters: QueryFilters) {
  // Query with filters
  return conversations;
}
```

**Pattern:**
- Export named functions (not classes unless needed)
- Accept typed inputs
- Return typed outputs
- Handle database errors internally
- Log errors with context

### HTTP Client Pattern (Phase A)

For calling external APIs (Kommo ChatAPI, WhatsApp):

```typescript
// kommo-chatapi-client.ts
import { fetch } from "node-fetch";
import { logger } from "../config/logger.js";

export async function forwardMessageToKommo(message: KommoMessage): Promise<void> {
  const response = await fetch(`${env.KOMMO_API_URL}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.KOMMO_ACCESS_TOKEN}`
    },
    body: JSON.stringify(message)
  });

  if (!response.ok) {
    logger.error({ status: response.status }, "[KommoChatapiClient] Request failed");
    throw new Error(`Kommo API error: ${response.status} ${response.statusText}`);
  }
}
```

**Pattern:**
- Create dedicated client per external service
- Validate environment variables exist
- Use fetch (Node 18+) or axios
- Handle HTTP errors with context via logger
- Don't expose raw API responses to callers

### Message Mapping Service (Phase A)

For tracking message IDs across systems:

```typescript
// message-mapping-service.ts
export async function mapMessageIds(
  kommoMessageId: string,
  whatsappMessageId: string
): Promise<void> {
  // Insert or update mapping in database
  // Allows tracking message flow bidirectionally
}

export async function getKommoMessageId(whatsappMessageId: string): Promise<string> {
  // Lookup Kommo ID from WhatsApp ID
  return kommoMessageId;
}
```

**Pattern:**
- Map message IDs when forwarding between systems
- Create mappings before processing confirmation
- Use for deduplication and tracking
- Index on both ID types for fast lookup

### Middleware Pattern

Middleware transforms requests:

```typescript
export function myMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check condition
  if (!condition) {
    throw AppError.badRequest("Invalid request");
  }
  next();
}
```

**Pattern:**
- Return type `void`
- Throw AppError if rejecting
- Always call next() on success

### Type Definitions

Types live in `src/types/`:

```typescript
// kommo-webhook-types.ts
export type NormalizedMessage = {
  kommoMessageId: string;
  kommoChatId: string;
  direction: "incoming" | "outgoing";
  senderType: SenderType;
  contentType: ContentType;
  // ...
};

// whatsapp-webhook-types.ts
export type WhatsAppMessageEcho = {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "image" | "video" | "file" | "voice" | "location" | "sticker";
  text?: { body: string };
  image?: { link: string };
  video?: { link: string };
  // ... media types
};

// database-types.ts
export type SenderType = "customer" | "agent" | "bot" | "system";
export type ContentType = "text" | "image" | "video" | "file" | "voice" | "location" | "sticker";
export type ChatHistoryMessage = {
  id: string;
  text: string | null;
  direction: "incoming" | "outgoing";
  senderType: string;
  senderId: string | null;
  mediaUrl: string | null;
  timestamp: string; // ISO string
};
```

**Pattern:**
- Use `type` for unions and simple shapes
- Use `interface` for complex objects if extensibility matters
- Group related types in single file
- Export at module level

### Route Handlers

Routes are thin wrappers around services:

```typescript
export const triggerRoutes = Router();

triggerRoutes.get("/triggers/no-response", async (req, res, next) => {
  try {
    const hours = Number(req.query.hours ?? 24);
    if (isNaN(hours) || hours < 0) {
      throw AppError.badRequest("hours must be a non-negative number");
    }
    const data = await getUnrespondedLeads(hours);
    res.json({ data, count: data.length, hours });
  } catch (err) {
    next(err); // Delegate to error-handler middleware
  }
});
```

**Pattern:**
- Validate input from query/body
- Throw AppError if invalid
- Call service function
- Use try/catch with `next(err)` for delegation
- Let global error handler format response

## Testing Standards

### File Organization

- Test file next to source: `foo.ts` → `__tests__/foo.test.ts`
- Or in `__tests__` directory
- Use `.test.ts` extension

### Test Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getUnrespondedLeads } from "../services/trigger-service";

describe("Trigger Service", () => {
  describe("getUnrespondedLeads", () => {
    it("returns leads with no agent response in past N hours", async () => {
      // Arrange
      const hours = 24;

      // Act
      const result = await getUnrespondedLeads(hours);

      // Expect
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("rejects invalid hours", async () => {
      expect(() => getUnrespondedLeads(-1)).toThrow();
    });
  });
});
```

**Pattern:**
- Use Vitest for unit tests
- Arrange-Act-Assert structure
- Descriptive test names
- Test happy path + error cases

### Integration Tests

Use Supertest for API testing:

```typescript
import supertest from "supertest";
import { app } from "../app";

const request = supertest(app);

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request.get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
  });
});

describe("GET /api/conversations (protected)", () => {
  it("rejects without API key", async () => {
    const res = await request.get("/api/conversations");
    expect(res.status).toBe(401);
  });

  it("accepts with valid API key", async () => {
    const res = await request
      .get("/api/conversations")
      .set("x-api-key", process.env.API_KEY!);
    expect(res.status).toBe(200);
  });
});
```

**Pattern:**
- Start with unauthenticated endpoints
- Then test protected routes
- Verify both success and error cases

## Code Review Checklist

Before committing:

- [ ] No TypeScript errors (`npm run lint`)
- [ ] All tests pass (`npm test`)
- [ ] Function/variable names are clear (no `x`, `temp`, `data1`)
- [ ] Complex logic has comments
- [ ] Error messages provide context
- [ ] No hardcoded secrets or API keys
- [ ] Env vars validated at startup
- [ ] Database queries indexed columns
- [ ] No console.* calls — use Pino logger from `config/logger.ts`
- [ ] Use AppError in route handlers, not inline error responses
- [ ] Files under 200 lines
- [ ] Imports sorted: node → 3rd party → local

## Security Checklist

- [ ] All inputs validated (Zod schemas or AppError)
- [ ] Timing-safe comparison for secrets
- [ ] Helmet enabled for security headers
- [ ] CORS configured appropriately
- [ ] Body size limits in place
- [ ] API key not logged
- [ ] Error messages don't expose internals
- [ ] Non-root Docker user
- [ ] Environment secrets in .env (not .env.example)
- [ ] Webhook signatures verified (HMAC-SHA1 for Kommo, X-Hub-Signature for WhatsApp)

## Performance Checklist

- [ ] Async/await for I/O (don't block)
- [ ] Supabase client is singleton
- [ ] Database indexes on filter columns
- [ ] Composite indexes for trigger queries
- [ ] Body size limits prevent DOS
- [ ] Write-ahead log doesn't block webhook response
- [ ] No N+1 queries (verify with database logs)
- [ ] Chat history pagination caps at MAX_PAGES=20

## Documentation Checklist

- [ ] Public functions have JSDoc comments
- [ ] Complex algorithms explained
- [ ] Database schema documented
- [ ] API endpoints documented in `api-docs.md`
- [ ] Environment variables listed in `.env.example`

## Common Pitfalls to Avoid

1. **Don't use `process.env` directly** — always import from `environment-config.ts`
2. **Don't hardcode Supabase credentials** — load from env
3. **Don't catch all errors silently** — log them with Pino
4. **Don't skip API key validation** — always check x-api-key
5. **Don't block webhook response** — process async after 200
6. **Don't expose raw database errors** — wrap in AppError with safe messages
7. **Don't create new Supabase clients per request** — use singleton
8. **Don't mix business logic in routes** — extract to services
9. **Don't skip phone number normalization** — causes duplicate conversations (Phase A2)
10. **Don't trust raw phone numbers for conversation ID** — always normalize first
11. **Don't use `console.log/error`** — always use the Pino logger from `config/logger.ts`
12. **Don't throw generic errors in routes** — use `AppError.badRequest()`, `AppError.notFound()`, or `AppError.internal()`
