# Codebase Summary - Kommo WhatsApp Monitoring Backend

**Last Updated:** 2026-03-13
**Version:** 1.1.0-phase-a3 (Production - Enhanced Logging & Chat History API)
**Status:** Phase A3 In Progress — Awaiting Kommo Support

## Project Overview

A Node.js/TypeScript backend service that captures WhatsApp messages flowing through Kommo CRM, stores them in Supabase PostgreSQL, and exposes REST APIs for conversation queries and automation triggers. Supports bidirectional messaging via ChatAPI and native WhatsApp Cloud API with message echo support. Includes structured Pino logging, AppError error handling, and Kommo Chat History API integration with HMAC-SHA1 signing.

**Live Deployment:** https://inicial-kommo-monitor.e8cf0x.easypanel.host

## Directory Structure

```
src/
├── api/
│   ├── conversation-routes.ts    # GET conversations, messages, lead status
│   ├── health-routes.ts          # GET /health check endpoint
│   └── trigger-routes.ts         # GET triggers (no-response, no-followup)
├── config/
│   ├── environment-config.ts     # Zod schema for env vars (Phase A + A2 + A3)
│   ├── logger.ts                 # Pino structured logger (Phase A3)
│   └── supabase-client.ts        # Singleton Supabase connection
├── middleware/
│   ├── api-auth-middleware.ts    # x-api-key validation (timing-safe)
│   └── error-handler.ts          # Global error handling (Phase A3)
├── services/
│   ├── conversation-service.ts   # Upsert/query conversations
│   ├── message-service.ts        # Insert/query messages
│   ├── trigger-service.ts        # Query unresponded/unfollowed leads
│   ├── kommo-chatapi-client.ts   # Kommo ChatAPI HTTP client (Phase A)
│   ├── kommo-chats-api-client.ts # Kommo Chat History API HMAC client (Phase A3)
│   ├── whatsapp-api-client.ts    # WhatsApp Cloud API HTTP client (Phase A)
│   ├── message-bridge-service.ts # Bidirectional message forwarding (Phase A)
│   └── message-mapping-service.ts # WhatsApp ↔ Kommo ID tracking (Phase A)
├── types/
│   ├── database-types.ts         # TypeScript interfaces for DB
│   ├── kommo-webhook-types.ts    # Kommo webhook payload types
│   ├── chatapi-webhook-types.ts  # Kommo ChatAPI webhook payloads (Phase A)
│   └── whatsapp-webhook-types.ts # WhatsApp Cloud API payloads (Phase A + A2)
├── utils/
│   ├── app-error.ts              # Structured error class (Phase A3)
│   ├── hmac-signature.ts         # HMAC-SHA1/SHA256 signature utilities
│   └── normalize-phone.ts        # Phone number normalization (Phase A2)
├── webhooks/
│   ├── kommo-standard-handler.ts # Phase B standard webhook receiver
│   ├── chatapi-webhook-handler.ts # Phase A: Kommo ChatAPI webhook handler
│   ├── whatsapp-webhook-handler.ts # Phase A + A2: WhatsApp webhook handler
│   └── webhook-raw-logger.ts     # Write-ahead log (used by all webhooks)
├── __tests__/
│   ├── api-auth-middleware.test.ts
│   ├── kommo-payload-parser.test.ts
│   ├── trigger-routes.test.ts
│   ├── whatsapp-echo-handler.test.ts    # Phase A2: Echo processing tests
│   ├── normalize-phone.test.ts          # Phase A2: Phone normalization tests
│   ├── hmac-signature.test.ts           # Phase A3: HMAC signature tests
│   └── fixtures/
├── app.ts                        # Express app setup (middleware, routes)
└── server.ts                     # Entry point (load env, start server)

supabase/
└── migrations/
    ├── 001-create-enums.sql      # Enum types
    ├── 002-create-conversations.sql
    ├── 003-create-messages.sql
    ├── 004-create-webhook-raw-log.sql
    ├── 005-create-message-id-mapping.sql # Phase A message ID tracking table
    └── 006-add-composite-indexes.sql     # Phase A3: trigger query optimization

Dockerfile                        # Multi-stage production build
package.json                      # Dependencies & scripts
tsconfig.json                     # TypeScript config
.env.example                      # Environment template
README.md                         # Quick start guide
```

## Core Components

### 1. Entry Point (`src/server.ts`)
- Loads `.env` file with dotenv
- Validates environment variables using Zod schema
- Starts Express server on `PORT` (default: 3000)
- Logs startup info via Pino logger

### 2. Application Layer (`src/app.ts`)
- **Security Middleware:**
  - Helmet: Security headers
  - CORS: Cross-origin requests
  - Body size limit: 50KB
- **Routes:**
  - Public: `/webhooks/*`, `/health`
  - Protected: `/api/*` (requires x-api-key)
- **Error Handler:** Global error handling with AppError and structured responses

### 3. Request Flow

**Webhook Ingestion (POST /webhooks/whatsapp):**
1. Write-ahead log: Save raw payload
2. Respond 200 immediately
3. Parse async: Extract incoming messages and message echoes
4. For incoming messages:
   - Upsert conversation record
   - Insert message record
5. For message echoes (Phase A2):
   - Normalize phone number
   - Upsert conversation using normalized phone
   - Insert message with `direction=outgoing`
   - Create message ID mapping
6. Mark webhook as processed/error

**API Queries (GET /api/...):**
1. Validate x-api-key header
2. Query Supabase with filters
3. Return JSON response with structured error handling

### 4. Database Schema

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `conversations` | Chat sessions | id, kommo_chat_id (unique), contact_id, lead_id, status, last_message_at, last_incoming_at, last_outgoing_at |
| `messages` | Individual messages | id, conversation_id, kommo_message_id (unique), direction, sender_type, content_type, text_content, media_url |
| `webhook_raw_log` | Audit trail | id, source, event_type, status, payload, error_message |
| `message_id_mapping` | WhatsApp ↔ Kommo message ID correspondence | id, whatsapp_message_id, kommo_message_id, kommo_conversation_id, delivery_status, created_at |

**Enums:**
- `conversation_status`: active, closed
- `message_direction`: incoming, outgoing
- `sender_type`: customer, agent, bot, system
- `content_type`: text, image, video, file, voice, location, sticker
- `webhook_source`: kommo_standard, kommo_chatapi, meta

**Composite Indexes (Phase A3):**
- `idx_conversations_status_last_incoming` — Optimizes no-response trigger queries
- `idx_conversations_status_last_outgoing` — Optimizes no-followup trigger queries

### 5. Services

**ConversationService:**
- `upsertConversation(data)` — Create or update conversation
- `getConversations(filters)` — Query with status, date, contact/lead ID
- `getConversationById(id)` — Fetch single conversation

**MessageService:**
- `insertMessage(data)` — Store normalized message
- `getMessageHistory(conversationId)` — Fetch messages for conversation

**TriggerService:**
- `getUnrespondedLeads(hours)` — Find conversations where agent hasn't responded
- `getUnfollowedLeads(hours)` — Find conversations where customer hasn't replied

**KommoChatapiClient (Phase A):**
- `sendMessageToKommo(params)` — Forward WhatsApp message to Kommo ChatAPI
- Accepts: conversationId, senderId, senderName, messageType, text, mediaUrl
- Returns: { kommoMessageId, status }

**KommoChatsApiClient (Phase A3):**
- `fetchChatHistory(conversationId, options)` — Fetch full chat history from Kommo Chat History API
- HMAC-SHA1 signing with MD5: `HMAC(secret, MD5("GET" + path))`
- Auto-pagination with offset_id cursor, MAX_PAGES=20 safety cap
- Returns normalized ChatHistoryMessage[] array

**WhatsappApiClient (Phase A):**
- `sendTextToWhatsApp(number, text)` — Send text message
- `sendMediaToWhatsApp(number, mediaType, mediaUrl, caption)` — Send media
- Returns: { id, status }

**MessageBridgeService (Phase A):**
- `bridgeWhatsAppToKommo(normalized, rawWhatsApp)` — Forward incoming WhatsApp → Kommo
- `bridgeKommoToWhatsApp(normalized, rawKommo)` — Forward outgoing Kommo → WhatsApp
- Creates message ID mappings

**MessageMappingService (Phase A):**
- `createMapping(data)` — Store WhatsApp ↔ Kommo message ID relationship
- `getMapping(whatsappId)` — Lookup Kommo ID from WhatsApp ID
- `getMappingByKommoId(kommoId)` — Lookup WhatsApp ID from Kommo ID

**normalizePhone (Phase A2):**
- `normalizePhone(phone)` — Strip +, spaces, dashes for consistent phone format
- Prevents duplicate conversations from phone number format mismatches

### 6. API Endpoints

**Public (Phase B - Standard Webhooks):**
- `POST /webhooks/kommo` — Receive Kommo standard webhooks (incoming only)
- `GET /health` — Server health check

**Public (Phase A - Bidirectional Bridge):**
- `POST /webhooks/chatapi/:scopeId` — Kommo ChatAPI webhook (HMAC-SHA1 protected)
- `GET /webhooks/whatsapp` — WhatsApp webhook verification (token challenge)
- `POST /webhooks/whatsapp` — WhatsApp incoming + echoes (X-Hub-Signature protected)

**Protected (require x-api-key):**
- `GET /api/conversations` — List conversations with filters
- `GET /api/conversations/:id/messages` — Message history
- `GET /api/leads/:kommoLeadId/status` — Lead conversation status
- `GET /api/triggers/no-response?hours=24` — Unresponded leads
- `GET /api/triggers/no-followup?hours=48` — Unfollowed leads

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 20 (Alpine) |
| Language | TypeScript | 5.9+ |
| Framework | Express.js | 5.2+ |
| Database | Supabase (PostgreSQL) | Latest |
| Logging | Pino | 9.7+ |
| Validation | Zod | 4.3+ |
| Security | Helmet, CORS | Latest |
| Testing | Vitest, Supertest | Latest |

**Key Dependencies:**
```json
{
  "express": "^5.2.1",
  "@supabase/supabase-js": "^2.99.0",
  "zod": "^4.3.6",
  "pino": "^9.7.0",
  "helmet": "^8.1.0",
  "cors": "^2.8.6",
  "dotenv": "^17.3.1",
  "typescript": "^5.9.3"
}
```

## Development Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start dev server with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to dist/ |
| `npm start` | Run production build |
| `npm test` | Run all tests (Vitest) |
| `npm run lint` | Type check (no emit) |

## Security Features

1. **API Authentication:** Timing-safe key comparison (`x-api-key` header)
2. **Environment Validation:** Zod schema fails on startup if missing required vars
3. **Helmet:** Automatic security headers (X-Frame-Options, X-Content-Type-Options, CSP)
4. **Body Size Limit:** 50KB cap prevents large payload attacks
5. **Non-Root Docker:** App runs as `app` user
6. **Write-Ahead Log:** All raw payloads logged before processing (audit trail)
7. **Input Validation:** Zod schemas for env and request bodies
8. **Webhook Signature Verification:** HMAC-SHA1 (Kommo) + X-Hub-Signature (WhatsApp)
9. **Structured Error Handling:** AppError class with safe error responses (no stack traces in production)

## Performance Characteristics

| Operation | Typical Time | Target |
|-----------|--------------|--------|
| POST /webhooks/kommo response | ~50ms | < 100ms |
| POST /webhooks/whatsapp response | ~50ms | < 100ms |
| GET /api/conversations | ~200ms | < 500ms |
| GET /api/conversations/*/messages | ~150ms | < 500ms |
| GET /api/triggers/* | ~300ms (composite indexes) | < 1000ms |
| Chat history fetch | varies by size | paginated auto-fetch |

**Optimization Techniques:**
- Async webhook processing (respond before storing)
- Singleton Supabase connection
- Database composite indexes on trigger queries
- Connection pooling via Supabase
- Pagination safety cap (MAX_PAGES=20)

## Docker Build

**Multi-Stage Approach:**

Stage 1 (Builder):
- Node 20 Alpine
- Install all dependencies
- Compile TypeScript

Stage 2 (Production):
- Node 20 Alpine (minimal)
- Copy compiled code only
- Non-root user (`app`)
- Expose port 3000

**Build & Run:**
```bash
docker build -t kommo-monitor:latest .
docker run --env-file .env -p 3000:3000 kommo-monitor:latest
```

## Deployment

**Current:** EasyPanel (https://inicial-kommo-monitor.e8cf0x.easypanel.host)

**Setup Steps:**
1. Create Supabase project
2. Run database migrations (001-006)
3. Configure .env with Supabase credentials and API key
4. Push Docker image to registry
5. Deploy on EasyPanel with env file mounted
6. Configure health check: `GET /health`

## Testing Strategy

**Test Framework:** Vitest + Supertest

**Test Files:**
- API auth middleware tests
- Kommo payload parser tests
- Trigger routes tests
- WhatsApp echo handler tests (Phase A2)
- Phone normalization tests (Phase A2)
- HMAC signature tests (Phase A3)

**Target:** 70%+ coverage by Phase 2

## Known Limitations

1. **No Rate Limiting** — Recommend per-API-key limits in production
2. **Offset Pagination Only** — Cursor pagination planned for Phase 3
3. **No Caching Layer** — Redis could improve conversation queries
4. **Generic Error Messages** — RESOLVED (AppError class) in Phase A3

## Environment Variables

| Variable | Type | Required | Example |
|----------|------|----------|---------|
| PORT | number | No | 3000 |
| NODE_ENV | enum | No | production |
| LOG_LEVEL | enum | No | info |
| SUPABASE_URL | string | Yes | https://xxxx.supabase.co |
| SUPABASE_ANON_KEY | string | Yes | eyJx... |
| SUPABASE_SERVICE_ROLE_KEY | string | Yes | eyJx... |
| API_KEY | string | Yes | your-secret-key |
| KOMMO_CHANNEL_ID | string | No (Phase A) | kommo-chatapi-channel-id |
| KOMMO_CHANNEL_SECRET | string | No (Phase A) | kommo-channel-secret-for-hmac |
| KOMMO_SCOPE_ID | string | No (Phase A3) | kommo-account-scope-id |
| KOMMO_AMOJO_ID | string | No (Phase A) | kommo-amojo-id |
| WHATSAPP_ACCESS_TOKEN | string | No (Phase A) | EAAY... |
| WHATSAPP_PHONE_NUMBER_ID | string | No (Phase A) | 1234567890 |
| WHATSAPP_VERIFY_TOKEN | string | No (Phase A) | webhook-verify-token |
| WHATSAPP_APP_SECRET | string | **Yes** (Phase A2) | app-secret-for-signature |

## Phase A3: Structured Logging, AppError, and Chat History API

**New Files:**
- `src/config/logger.ts` — Pino structured logger configuration
- `src/utils/app-error.ts` — Structured error class for safe error responses
- `src/services/kommo-chats-api-client.ts` — Kommo Chat History API HMAC client
- `supabase/migrations/006-add-composite-indexes.sql` — Trigger query indexes

**Updated Files:**
- `src/config/environment-config.ts` — Added `LOG_LEVEL` env var, KOMMO chat API vars
- `src/middleware/error-handler.ts` — Uses AppError class, Pino logger, structured responses
- All service files — Console logs replaced with Pino logger calls
- `src/api/*-routes.ts` — Use AppError.badRequest() instead of inline error responses

**Key Features:**
- Pino structured JSON logging (production) + pretty-printed (development)
- Configurable log level via `LOG_LEVEL` env var
- AppError class with code + message fields for safe error responses
- Stack traces only in non-production environments
- Kommo Chat History API client with HMAC-SHA1 signing
- Composite indexes for trigger query optimization
- 15+ files refactored to use logger and AppError

## Next Steps

### Phase A3 Blockers
- Awaiting Kommo support for Chat History API endpoint confirmation
- Testing Chat History fetch with real Kommo account

### Phase 2 (Future)
1. **Performance Monitoring:** Track response times, error rates
2. **Webhook Retry Logic:** Add exponential backoff for failed processing
3. **Comprehensive Tests:** Expand unit and integration test coverage
4. **Monitoring Dashboard:** Integrate with status page or Sentry
5. **Cursor-Based Pagination:** Replace offset pagination for better scalability

## Related Files

- **[System Architecture](./system-architecture.md)** — Detailed component interaction
- **[API Documentation](./api-docs.md)** — Endpoint reference with examples
- **[Development Roadmap](./development-roadmap.md)** — Planned features and phases
- **[Project Changelog](./project-changelog.md)** — Version history
- **[Code Standards](./code-standards.md)** — Development patterns and conventions
- **[CLAUDE.md](../CLAUDE.md)** — Project setup and development guides
