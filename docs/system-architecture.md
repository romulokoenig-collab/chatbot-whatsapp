# System Architecture - Kommo WhatsApp Monitoring Backend

## Overview

The Kommo WhatsApp Monitoring Backend is a Node.js/TypeScript service that captures WhatsApp messages flowing through the Kommo CRM, stores them in Supabase, and exposes REST APIs for querying conversations and triggering automations.

**Core Functions:**
- Receive Kommo webhooks for incoming/outgoing WhatsApp messages
- Store raw payloads and processed messages in Supabase with full audit trail
- Query conversations with filtering (status, date range, contact/lead ID)
- Identify stalled conversations for automation triggers (no response, no follow-up)

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

**Webhook Ingestion:**
```
POST /webhooks/kommo
├─ kommo-standard-handler.ts (entry point)
├─ webhook-raw-logger.ts (write-ahead log)
└─ Services:
   ├─ conversation-service.ts (upsert)
   └─ message-service.ts (insert)
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

**Kommo Standard Handler** (`src/webhooks/kommo-standard-handler.ts`)

1. **Write-Ahead Log**: Save raw webhook immediately before processing
   - Logs to `webhook_raw_log` table with status `pending`
   - Extracts event type (message, note, etc.)

2. **Fast Response**: Return 200 to Kommo immediately (prevents retries)

3. **Async Processing** (after response sent):
   - Parse Kommo webhook body (handles urlencoded format)
   - Extract normalized message fields
   - Upsert conversation record
   - Insert message record
   - Mark webhook as `processed` or `error` in audit log

**Message Normalization:**
- Extracts: `kommoMessageId`, `kommoChatId`, `direction` (incoming/outgoing)
- Determines: `senderType` (customer/agent/bot/system) based on direction and author metadata
- Resolves: `contentType` (text/image/video/file/voice/location/sticker)
- Captures: Text content, media URL, sender ID, contact ID, lead ID, timestamp
- Stores: Raw payload for audit trail

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

## Data Flow Example

```
Kommo User sends WhatsApp message
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

## Performance Considerations

1. **Async Processing**: Respond to Kommo immediately, process async after
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
