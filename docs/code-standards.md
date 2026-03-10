# Code Standards - Kommo WhatsApp Backend

## File Organization

### Directory Structure

```
src/
├── server.ts                    # Entry point (starts app)
├── app.ts                       # Express app setup
├── config/
│   ├── environment-config.ts    # Zod schema, env validation
│   └── supabase-client.ts       # Supabase instance
├── types/
│   ├── database-types.ts        # Database enums and types
│   └── kommo-webhook-types.ts   # Kommo payload types
├── webhooks/
│   ├── kommo-standard-handler.ts # Webhook entry, parsing, routing
│   └── webhook-raw-logger.ts    # Write-ahead log service
├── services/
│   ├── conversation-service.ts  # Upsert, query conversations
│   ├── message-service.ts       # Insert, query messages
│   └── trigger-service.ts       # Automation triggers
├── api/
│   ├── conversation-routes.ts   # GET /api/conversations*
│   ├── trigger-routes.ts        # GET /api/triggers/*
│   └── health-routes.ts         # GET /health
├── middleware/
│   ├── api-auth-middleware.ts   # x-api-key validation
│   └── error-handler.ts         # Global error handling
└── __tests__/                   # Unit + integration tests
    ├── *.test.ts
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
  ```

- **UPPER_SNAKE_CASE** for constants
  ```typescript
  const MAX_WEBHOOK_PAYLOAD_SIZE = 50000;
  const DEFAULT_HOURS = 24;
  ```

- **PascalCase** for types and interfaces
  ```typescript
  type NormalizedMessage = { ... };
  interface ConversationRow { ... };
  enum ConversationStatus { ... }
  ```

### Database References

- **Snake_case** for table/column names in SQL
  ```sql
  SELECT kommo_chat_id, contact_id FROM conversations
  ```

- **Match database case exactly in code comments**
  ```typescript
  // kommo_chat_id — maps to conversations.kommo_chat_id
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
  // ...
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
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

### Error Handling

Always provide context in error logs:

```typescript
try {
  await someOperation();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[ModuleName] Operation failed:", msg);
  // Handle or re-throw
}
```

**Pattern:**
- Prefix logs with `[ModuleName]` for traceability
- Extract error message safely
- Log in console for observability
- Provide context to callers

### Timing-Safe Comparisons

For security-sensitive operations (API keys, tokens):

```typescript
import { timingSafeEqual } from "node:crypto";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Usage
if (!safeCompare(apiKey, env.API_KEY)) {
  res.status(401).json({ error: "Unauthorized" });
}
```

**Why:** Prevents timing attacks that leak key information.

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

### Middleware Pattern

Middleware transforms requests:

```typescript
export function myMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check condition
  if (!condition) {
    res.status(400).json({ error: "Bad request" });
    return;  // Important: return to prevent next() call
  }
  next();
}
```

**Pattern:**
- Return type `void`
- Early return before next() if rejecting
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

// database-types.ts
export type SenderType = "customer" | "agent" | "bot" | "system";
export type ContentType = "text" | "image" | "video" | "file" | "voice" | "location" | "sticker";
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

triggerRoutes.get("/triggers/no-response", async (req, res) => {
  try {
    const hours = Number(req.query.hours ?? 24);
    if (isNaN(hours) || hours < 0) {
      res.status(400).json({ error: "hours must be non-negative" });
      return;
    }
    const data = await getUnrespondedLeads(hours);
    res.json({ data, count: data.length, hours });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
```

**Pattern:**
- Validate input from query/body
- Return 400 if invalid
- Call service function
- Return 500 on error with message
- Return 200 with data on success

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
- [ ] No console.log in production code (use console.error for errors)
- [ ] Files under 200 lines
- [ ] Imports sorted: node → 3rd party → local

## Security Checklist

- [ ] All inputs validated (Zod schemas)
- [ ] Timing-safe comparison for secrets
- [ ] Helmet enabled for security headers
- [ ] CORS configured appropriately
- [ ] Body size limits in place
- [ ] API key not logged
- [ ] Error messages don't expose internals
- [ ] Non-root Docker user
- [ ] Environment secrets in .env (not .env.example)

## Performance Checklist

- [ ] Async/await for I/O (don't block)
- [ ] Supabase client is singleton
- [ ] Database indexes on filter columns
- [ ] Body size limits prevent DOS
- [ ] Write-ahead log doesn't block webhook response
- [ ] No N+1 queries (verify with database logs)

## Documentation Checklist

- [ ] Public functions have JSDoc comments
- [ ] Complex algorithms explained
- [ ] Database schema documented
- [ ] API endpoints documented in `api-docs.md`
- [ ] Environment variables listed in `.env.example`

## Common Pitfalls to Avoid

1. **Don't use `process.env` directly** — always import from `environment-config.ts`
2. **Don't hardcode Supabase credentials** — load from env
3. **Don't catch all errors silently** — log them
4. **Don't skip API key validation** — always check x-api-key
5. **Don't block webhook response** — process async after 200
6. **Don't expose raw database errors** — wrap in safe messages
7. **Don't create new Supabase clients per request** — use singleton
8. **Don't mix business logic in routes** — extract to services
