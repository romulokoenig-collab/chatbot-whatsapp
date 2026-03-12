# System Architecture - Kommo WhatsApp Monitoring Backend

## Overview

The Kommo WhatsApp Monitoring Backend is a Node.js/TypeScript service that captures WhatsApp messages flowing through the Kommo CRM, stores them in Supabase, and exposes REST APIs for querying conversations and triggering automations.

**Core Functions:**
- Receive Kommo webhooks for incoming/outgoing WhatsApp messages
- Store raw payloads and processed messages in Supabase with full audit trail
- Query conversations with filtering (status, date range, contact/lead ID)
- Identify stalled conversations for automation triggers (no response, no follow-up)
- Capture outgoing messages via WhatsApp Cloud API message echoes (Phase A2)

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 20 (Alpine) |
| Language | TypeScript | 5.9+ |
| Web Framework | Express.js | 5.2+ |
| Database | Supabase (PostgreSQL) | Latest |
| Config Validation | Zod | 4.3+ |
| Security | Helmet, CORS | Latest |
| Testing | Vitest, Supertest | Latest |

## Architecture Layers

### 1. Entry Point (`src/server.ts`)
- Loads environment config (Zod schema validation)
- Starts Express app on `PORT` (default: 3000)
- Logs startup message with environment

### 2. Application Layer (`src/app.ts`)
Middleware & route registration:
- **Security:** Helmet (headers), CORS (cross-origin), body size limits (50kb)
- **Public Routes:** `/webhooks`, `/health` (no auth required)
- **Protected Routes:** `/api/*` (requires `x-api-key` header)
- **Error Handler:** Global exception handling

### 3. Request Routing

**Webhook Ingestion (Phase B - Standard):**
```
POST /webhooks/kommo
├─ kommo-standard-handler.ts (entry point)
├─ webhook-raw-logger.ts (write-ahead log)
└─ Services:
   ├─ conversation-service.ts (upsert)
   └─ message-service.ts (insert)
```

**Webhook Ingestion (Phase A - ChatAPI):**
```
POST /webhooks/chatapi/:scopeId
├─ chatapi-webhook-handler.ts (entry point)
├─ webhook-raw-logger.ts (write-ahead log)
├─ HMAC-SHA1 signature verification
└─ Services:
   ├─ conversation-service.ts (upsert)
   ├─ message-service.ts (insert)
   ├─ message-bridge-service.ts (forward to WhatsApp)
   └─ message-mapping-service.ts (track message IDs)
```

**Webhook Ingestion (Phase A - WhatsApp Cloud API):**
```
GET /webhooks/whatsapp (Meta verification challenge)
POST /webhooks/whatsapp (incoming messages + echoes from WhatsApp)
├─ whatsapp-webhook-handler.ts (entry point)
├─ webhook-raw-logger.ts (write-ahead log)
├─ X-Hub-Signature verification
├─ Echo processing loop (Phase A2)
└─ Services:
   ├─ conversation-service.ts (upsert)
   ├─ message-service.ts (insert)
   ├─ message-bridge-service.ts (forward to Kommo ChatAPI)
   └─ message-mapping-service.ts (track message IDs)
```

**API Routes (Protected):**
```
GET /api/conversations
├─ conversation-routes.ts
└─ conversation-service.ts (query)

GET /api/conversations/:id/messages
├─ conversation-routes.ts
└─ message-service.ts (query)

GET /api/leads/:kommoLeadId/status
├─ conversation-routes.ts
└─ conversation-service.ts (query)

GET /api/triggers/no-response?hours=24
├─ trigger-routes.ts
└─ trigger-service.ts (query unresponded)

GET /api/triggers/no-followup?hours=48
├─ trigger-routes.ts
└─ trigger-service.ts (query unfollowed)

GET /health
└─ health-routes.ts (returns { status: "ok" })
```

### 4. Middleware

**API Auth Middleware** (`src/middleware/api-auth-middleware.ts`)
- Validates `x-api-key` header against `API_KEY` env var
- Uses timing-safe comparison (prevents timing attacks)
- Returns 401 if key is invalid or missing

**Error Handler** (`src/middleware/error-handler.ts`)
- Catches all exceptions from routes
- Returns 500 with error message
- Logs to console for debugging

### 5. Webhook Processing Flow

**WhatsApp Webhook Handler** (`src/webhooks/whatsapp-webhook-handler.ts`)

1. **Write-Ahead Log**: Save raw webhook immediately before processing
   - Logs to `webhook_raw_log` table with status `pending`
   - Extracts event type (message, echo, status, etc.)

2. **Fast Response**: Return 200 to Meta immediately (prevents retries)

3. **Async Processing** (after response sent):
   - **Process incoming messages:**
     - Parse WhatsApp webhook body
     - Extract normalized message fields
     - Upsert conversation record
     - Insert message record
   - **Process message echoes (Phase A2):**
     - Extract `smb_message_echoes` array from webhook value
     - For each echo:
       - Normalize phone number (prevent duplicates)
       - Create or get conversation ID
       - Insert message record with `direction=outgoing`
       - Create/update message ID mapping
       - Per-item error handling (continue if one echo fails)
   - **Process status updates:**
     - Check for existing message ID mapping before creating
     - Create mapping-only record if not found (handles out-of-order delivery)
   - Mark webhook as `processed` or `error` in audit log

**Message Normalization (Incoming):**
- Extracts: phone, message ID, timestamp, text/media
- Determines: direction (incoming), sender type (customer)
- Resolves: content type (text/image/video/file/voice/location/sticker)
- Captures: Text content, media URL, sender ID, timestamp
- Stores: Raw payload for audit trail

**Echo Processing (Phase A2):**
- Normalizes phone number (`normalizePhone()`) to prevent duplicates
- Creates conversation ID using normalized phone
- Stores as `direction=outgoing` message
- Creates message ID mapping for echo ID tracking
- Graceful error handling per echo (logs, continues)

### 6. Data Layer

**Supabase Connection** (`src/config/supabase-client.ts`)
- Initializes with `SUPABASE_URL` and service role key
- Uses service role key for full database access (not anon key)
- Singleton pattern for reusability

**Database Schema:**

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `conversations` | Track unique chat sessions | `id`, `kommo_chat_id`, `contact_id`, `lead_id`, `status`, `last_message_at` |
| `messages` | Store individual messages | `id`, `conversation_id`, `kommo_message_id`, `direction`, `sender_type`, `content_type`, `text_content`, `media_url`, `created_at` |
| `webhook_raw_log` | Audit trail of all webhooks | `id`, `source`, `event_type`, `status`, `payload`, `error_message`, `created_at` |
| `message_id_mapping` | WhatsApp ↔ Kommo message ID tracking | `id`, `whatsapp_message_id`, `kommo_message_id`, `kommo_conversation_id`, `created_at` |

**Enums:**
- `conversation_status`: active, closed
- `message_direction`: incoming, outgoing
- `sender_type`: customer, agent, bot, system
- `content_type`: text, image, video, file, voice, location, sticker
- `webhook_source`: kommo_standard, kommo_chatapi, meta

### 7. Services Layer

**Conversation Service** (`src/services/conversation-service.ts`)
- `upsertConversation()` — Create or update conversation record
- `getConversations()` — Query with filters (status, date range, etc.)
- `getConversationById()` — Fetch single conversation with context

**Message Service** (`src/services/message-service.ts`)
- `insertMessage()` — Store normalized message
- `getMessageHistory()` — Query messages for a conversation

**Trigger Service** (`src/services/trigger-service.ts`)
- `getUnrespondedLeads()` — Find conversations where agent has not responded within N hours
- `getUnfollowedLeads()` — Find conversations where customer has not replied within N hours
- Joins conversations + messages to identify gaps

### 8. Configuration

**Environment Variables** (`src/config/environment-config.ts`)

| Variable | Type | Required | Default | Notes |
|----------|------|----------|---------|-------|
| `PORT` | number | No | 3000 | Server port |
| `SUPABASE_URL` | string | Yes | - | Supabase project URL |
| `SUPABASE_ANON_KEY` | string | Yes | - | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | string | Yes | - | Service role key (full access) |
| `API_KEY` | string | Yes | - | Secret key for protected routes |
| `NODE_ENV` | enum | No | development | development \| production \| test |
| `KOMMO_CHANNEL_ID` | string | No | - | Kommo ChatAPI channel ID (Phase A) |
| `KOMMO_CHANNEL_SECRET` | string | No | - | Kommo ChatAPI channel secret for HMAC verification (Phase A) |
| `KOMMO_SCOPE_ID` | string | No | - | Kommo account scope ID for ChatAPI (Phase A) |
| `KOMMO_AMOJO_ID` | string | No | - | Kommo amoJob ID for message routing (Phase A) |
| `WHATSAPP_ACCESS_TOKEN` | string | No | - | Meta WhatsApp Cloud API access token (Phase A) |
| `WHATSAPP_PHONE_NUMBER_ID` | string | No | - | WhatsApp business phone number ID (Phase A) |
| `WHATSAPP_VERIFY_TOKEN` | string | No | - | WhatsApp webhook verification token (Phase A) |
| `WHATSAPP_APP_SECRET` | string | **Yes** | - | WhatsApp app secret for X-Hub-Signature verification (Required Phase A2) |

**Validation:**
- Uses Zod for runtime validation
- Fails fast on startup if missing required vars
- Prints validation errors to console

## Deployment

**Docker Multi-Stage Build** (`Dockerfile`)

Stage 1 (Builder):
- Node 20 Alpine
- Copy package.json, install all deps
- Compile TypeScript → dist/
- Discard dev dependencies

Stage 2 (Production):
- Node 20 Alpine (minimal size)
- Copy package.json, install prod deps only
- Copy compiled dist/
- Create non-root user (`app`)
- Expose port 3000
- Run `node dist/server.js`

**EasyPanel Deployment:**
- Use Stage 2 image directly
- Mount env file with secrets
- Map port 3000 → external port
- Configure health check: `GET /health`
- **Live Instance:** https://inicial-kommo-monitor.e8cf0x.easypanel.host (deployed 2026-03-12)

## Data Flow Examples

### Phase A2: WhatsApp Coexistence Message Echo (Outgoing)
n> **Production Finding (2026-03-12):** `smb_message_echoes` only fires for messages sent via the WhatsApp Business App, NOT via Cloud API. Since Kommo sends via Cloud API, this echo flow does not trigger. Status tracking (sent/delivered/read) via the `messages` field webhook works correctly and is sufficient for automation triggers.

```
Agent sends WhatsApp message via Kommo ChatAPI
        ↓
Kommo ChatAPI custom channel broadcasts message to WhatsApp
        ↓
WhatsApp Cloud API stores message
        ↓
Meta sends message_echo webhook event
        ↓
POST /webhooks/whatsapp (with smb_message_echoes field)
        ↓
[Signature Verification] (validates WHATSAPP_APP_SECRET)
        ↓
[Write-Ahead Log] → webhook_raw_log (status: pending)
        ↓
[Respond 200] (Meta satisfied)
        ↓
[Parse Echo Message]
  - Extract from smb_message_echoes array
  - Normalize phone number
  - Create conversation using normalized phone
        ↓
[Insert Message]
  - Store in messages table (direction=outgoing)
        ↓
[Create Message ID Mapping]
  - Link WhatsApp echo ID to conversation
  - Enable status tracking for delivery confirmation
        ↓
[Mark Processed]
  - Update webhook_raw_log (status: processed)
```

### Phase A: Kommo ChatAPI Outgoing → WhatsApp

```
Agent sends message via Kommo ChatAPI custom channel
        ↓
Kommo ChatAPI webhook POST /webhooks/chatapi/:scopeId
        ↓
[HMAC-SHA1 Signature Verification] (validates KOMMO_CHANNEL_SECRET)
        ↓
[Write-Ahead Log] → webhook_raw_log (status: pending)
        ↓
[Respond 200] (Kommo satisfied)
        ↓
[Parse & Normalize ChatAPI payload]
  - Extract message fields
  - Map to NormalizedMessage format
        ↓
[Upsert Conversation] → conversations table
        ↓
[Insert Message] → messages table
        ↓
[Bridge to WhatsApp Cloud API]
  - Send via whatsapp-api-client
  - Create message ID mapping (WhatsApp ID ↔ Kommo ID)
        ↓
[Mark Processed]
  - Update webhook_raw_log (status: processed)
```

### Phase A: WhatsApp Cloud API Incoming → Kommo

```
Customer sends WhatsApp message to business phone number
        ↓
Meta's WhatsApp Cloud API POST /webhooks/whatsapp
        ↓
[Verify X-Hub-Signature] (validates WHATSAPP_APP_SECRET)
        ↓
[Write-Ahead Log] → webhook_raw_log (status: pending)
        ↓
[Respond 200] (Meta satisfied)
        ↓
[Parse & Normalize WhatsApp payload]
  - Extract message fields
  - Map to NormalizedMessage format
        ↓
[Upsert Conversation] → conversations table
        ↓
[Insert Message] → messages table
        ↓
[Bridge to Kommo ChatAPI]
  - Send via kommo-chatapi-client
  - Create message ID mapping (WhatsApp ID ↔ Kommo ID)
        ↓
[Mark Processed]
  - Update webhook_raw_log (status: processed)
```

### Phase B: Kommo Standard Webhook (Incoming Only)

```
Customer sends WhatsApp message via Kommo
        ↓
Kommo CRM detects message_add event
        ↓
POST /webhooks/kommo (raw payload)
        ↓
[Write-Ahead Log] → webhook_raw_log (status: pending)
        ↓
[Respond 200] (Kommo satisfied)
        ↓
[Parse & Normalize]
  - Extract message fields
  - Determine direction, sender type, content type
        ↓
[Upsert Conversation]
  - If kommo_chat_id exists: update last_message_at, status
  - Else: create new conversation record
        ↓
[Insert Message]
  - Store normalized message with conversation_id
        ↓
[Mark Processed]
  - Update webhook_raw_log (status: processed)
```

## Security Considerations

1. **API Authentication**: Timing-safe key comparison prevents side-channel attacks
2. **Environment Variables**: All secrets in .env, never in code
3. **Input Validation**: Zod schemas validate env and request bodies
4. **Helmet**: Automatic security headers (X-Frame-Options, X-Content-Type-Options, etc.)
5. **Body Size Limit**: 50kb limit prevents large payload attacks
6. **Non-Root Docker**: App runs as `app` user, not root
7. **Write-Ahead Log**: All raw payloads logged before processing (audit trail, recovery)
8. **Error Handling**: Don't expose sensitive info in error responses
9. **Webhook Signature Verification**: HMAC-SHA1 (Kommo) + X-Hub-Signature (WhatsApp)

## Performance Considerations

1. **Async Processing**: Respond to webhooks immediately, process async after
2. **Singleton Connections**: Supabase client reused across requests
3. **Indexed Queries**: Database indexes on `kommo_chat_id`, `contact_id`, `lead_id`, `created_at`
4. **Body Size Limits**: 50kb prevents memory exhaustion
5. **Connection Pooling**: Supabase manages PostgreSQL connection pool

## Scalability

- **Horizontal Scaling**: Stateless design allows multiple instances
- **Load Balancing**: Any reverse proxy (nginx, AWS ALB, EasyPanel)
- **Database**: Supabase auto-scales PostgreSQL, auto-backups
- **No Local Storage**: All state in Supabase

## Error Handling Strategy

1. **Webhook Logging**: Write-ahead log ensures no data loss on processing errors
2. **Async Errors**: Logged to console, webhook marked with error status
3. **Database Errors**: Propagated as 500 from routes
4. **Validation Errors**: Return 400 with specific field errors
5. **Auth Errors**: Return 401 for invalid API keys

## Monitoring & Observability

- **Startup Logs**: Environment and port confirmation
- **Webhook Processing**: Message count and error logging
- **Raw Log**: All webhooks stored with status (pending/processed/error)
- **Error Details**: Error messages persisted in webhook_raw_log
- **Health Endpoint**: Simple GET /health check for uptime monitoring

## Related Documentation

- [API Documentation](./api-docs.md) — Endpoint details, request/response examples
- [Code Standards](./code-standards.md) — File structure, naming conventions, testing
- [Development Roadmap](./development-roadmap.md) — Current phase, milestones, progress
- [Project Changelog](./project-changelog.md) — Feature history and version notes
