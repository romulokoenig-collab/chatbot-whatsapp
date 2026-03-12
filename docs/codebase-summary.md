# Codebase Summary - Kommo WhatsApp Monitoring Backend

**Last Updated:** 2026-03-12
**Version:** 1.1.0-phase-a2 (Production - Live Monitoring)
**Status:** Phase A2 Deployed

## Project Overview

A Node.js/TypeScript backend service that captures WhatsApp messages flowing through Kommo CRM, stores them in Supabase PostgreSQL, and exposes REST APIs for conversation queries and automation triggers. Supports bidirectional messaging via ChatAPI and native WhatsApp Cloud API with message echo support.

**Live Deployment:** https://inicial-kommo-monitor.e8cf0x.easypanel.host

## Directory Structure

```
src/
├── api/
│   ├── conversation-routes.ts    # GET conversations, messages, lead status
│   ├── health-routes.ts          # GET /health check endpoint
│   └── trigger-routes.ts         # GET triggers (no-response, no-followup)
├── config/
│   ├── environment-config.ts     # Zod schema for env vars (Phase A + A2)
│   └── supabase-client.ts        # Singleton Supabase connection
├── middleware/
│   ├── api-auth-middleware.ts    # x-api-key validation (timing-safe)
│   └── error-handler.ts          # Global error handling
├── services/
│   ├── conversation-service.ts   # Upsert/query conversations
│   ├── message-service.ts        # Insert/query messages
│   ├── trigger-service.ts        # Query unresponded/unfollowed leads
│   ├── kommo-chatapi-client.ts   # Kommo ChatAPI HTTP client (Phase A)
│   ├── whatsapp-api-client.ts    # WhatsApp Cloud API HTTP client (Phase A)
│   ├── message-bridge-service.ts # Bidirectional message forwarding (Phase A)
│   └── message-mapping-service.ts # WhatsApp ↔ Kommo ID tracking (Phase A)
├── types/
│   ├── database-types.ts         # TypeScript interfaces for DB
│   ├── kommo-webhook-types.ts    # Kommo webhook payload types
│   ├── chatapi-webhook-types.ts  # Kommo ChatAPI webhook payloads (Phase A)
│   └── whatsapp-webhook-types.ts # WhatsApp Cloud API payloads (Phase A + A2)
├── utils/
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
│   └── fixtures/
├── app.ts                        # Express app setup (middleware, routes)
└── server.ts                     # Entry point (load env, start server)

supabase/
└── migrations/
    ├── 001-create-enums.sql      # Enum types
    ├── 002-create-conversations.sql
    ├── 003-create-messages.sql
    ├── 004-create-webhook-raw-log.sql
    └── 005-create-message-id-mapping.sql # Phase A message ID tracking table

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
- Logs startup info

### 2. Application Layer (`src/app.ts`)
- **Security Middleware:**
  - Helmet: Security headers
  - CORS: Cross-origin requests
  - Body size limit: 50KB
- **Routes:**
  - Public: `/webhooks/*`, `/health`
  - Protected: `/api/*` (requires x-api-key)

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
3. Return JSON response

### 4. Database Schema

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `conversations` | Chat sessions | id, kommo_chat_id (unique), contact_id, lead_id, status, last_message_at |
| `messages` | Individual messages | id, conversation_id, kommo_message_id (unique), direction, sender_type, content_type, text_content, media_url |
| `webhook_raw_log` | Audit trail | id, source, event_type, status, payload, error_message |
| `message_id_mapping` | WhatsApp ↔ Kommo message ID correspondence | id, whatsapp_message_id, kommo_message_id, kommo_conversation_id, created_at |

**Enums:**
- `conversation_status`: active, closed
- `message_direction`: incoming, outgoing
- `sender_type`: customer, agent, bot, system
- `content_type`: text, image, video, file, voice, location, sticker
- `webhook_source`: kommo_standard, kommo_chatapi, meta

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
| Validation | Zod | 4.3+ |
| Security | Helmet, CORS | Latest |
| Testing | Vitest, Supertest | Latest |

**Key Dependencies:**
```json
{
  "express": "^5.2.1",
  "@supabase/supabase-js": "^2.99.0",
  "zod": "^4.3.6",
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

## Performance Characteristics

| Operation | Typical Time | Target |
|-----------|--------------|--------|
| POST /webhooks/kommo response | ~50ms | < 100ms |
| POST /webhooks/whatsapp response | ~50ms | < 100ms |
| GET /api/conversations | ~200ms | < 500ms |
| GET /api/conversations/*/messages | ~150ms | < 500ms |
| GET /api/triggers/* | ~300ms | < 1000ms |

**Optimization Techniques:**
- Async webhook processing (respond before storing)
- Singleton Supabase connection
- Database indexes on frequently queried columns
- Connection pooling via Supabase

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
2. Run database migrations
3. Configure .env with Supabase credentials and API key
4. Push Docker image to registry
5. Deploy on EasyPanel with env file mounted
6. Configure health check: `GET /health`

## Testing Strategy

**Test Framework:** Vitest + Supertest

**Test Files (66/66 passing):**
- API auth middleware tests
- Kommo payload parser tests
- Trigger routes tests
- WhatsApp echo handler tests (Phase A2)
- Phone normalization tests (Phase A2)

**Target:** 70%+ coverage by Phase 2

## Known Limitations

1. **No Rate Limiting** — Recommend per-API-key limits in production
2. **Offset Pagination Only** — Cursor pagination planned for Phase 3
3. **No Caching Layer** — Redis could improve conversation queries
4. **Generic Error Messages** — Could provide more specific debug info
5. **Test Coverage** — Expanded to 66/66 tests passing

## Environment Variables

| Variable | Type | Required | Example |
|----------|------|----------|---------|
| PORT | number | No | 3000 |
| NODE_ENV | enum | No | production |
| SUPABASE_URL | string | Yes | https://xxxx.supabase.co |
| SUPABASE_ANON_KEY | string | Yes | eyJx... |
| SUPABASE_SERVICE_ROLE_KEY | string | Yes | eyJx... |
| API_KEY | string | Yes | your-secret-key |
| KOMMO_CHANNEL_ID | string | No (Phase A) | kommo-chatapi-channel-id |
| KOMMO_CHANNEL_SECRET | string | No (Phase A) | kommo-channel-secret-for-hmac |
| KOMMO_SCOPE_ID | string | No (Phase A) | kommo-account-scope-id |
| KOMMO_AMOJO_ID | string | No (Phase A) | kommo-amojo-id |
| WHATSAPP_ACCESS_TOKEN | string | No (Phase A) | EAAY... |
| WHATSAPP_PHONE_NUMBER_ID | string | No (Phase A) | 1234567890 |
| WHATSAPP_VERIFY_TOKEN | string | No (Phase A) | webhook-verify-token |
| WHATSAPP_APP_SECRET | string | **Yes** (Phase A2) | app-secret-for-signature |

## Phase A2: Coexistence Message Echo Support

**New Files:**
- `src/utils/normalize-phone.ts` — Phone number normalization utility
- `src/__tests__/whatsapp-echo-handler.test.ts` — Echo processing tests (8 tests)
- `src/__tests__/normalize-phone.test.ts` — Phone normalization tests (3 tests)

**Updated Files:**
- `src/webhooks/whatsapp-webhook-handler.ts` — Added echo processing loop
- `src/types/whatsapp-webhook-types.ts` — Added `WhatsAppMessageEcho` type
- `src/config/environment-config.ts` — `WHATSAPP_APP_SECRET` now required

**Key Features:**
- Process `smb_message_echoes` webhook field from Meta
- Outgoing message capture via native WhatsApp Cloud API
- Phone number normalization prevents duplicate conversations
- Status mapping fallback handles out-of-order delivery
- Per-item error handling in echo loop
- 66/66 tests passing

## Next Steps (Phase 2)

1. **Structured Logging:** Add Winston or Pino for better observability
2. **Performance Monitoring:** Track response times, error rates
3. **Webhook Retry Logic:** Add exponential backoff for failed processing
4. **Comprehensive Tests:** Expand unit and integration test coverage
5. **Monitoring Dashboard:** Integrate with status page or Sentry

## Related Files

- **[System Architecture](./system-architecture.md)** — Detailed component interaction
- **[API Documentation](./api-docs.md)** — Endpoint reference with examples
- **[Development Roadmap](./development-roadmap.md)** — Planned features and phases
- **[Project Changelog](./project-changelog.md)** — Version history
- **[Code Standards](./code-standards.md)** — Development patterns and conventions
- **[CLAUDE.md](../CLAUDE.md)** — Project setup and development guides
