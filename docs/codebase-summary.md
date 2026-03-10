# Codebase Summary - Kommo WhatsApp Monitoring Backend

**Last Updated:** 2026-03-10
**Version:** 1.0.0 (Production)
**Status:** MVP Complete & Deployed

## Project Overview

A Node.js/TypeScript backend service that captures WhatsApp messages flowing through Kommo CRM, stores them in Supabase PostgreSQL, and exposes REST APIs for conversation queries and automation triggers.

**Live Deployment:** https://inicial-kommo-monitor.e8cf0x.easypanel.host

## Directory Structure

```
.
├── src/
│   ├── api/
│   │   ├── conversation-routes.ts    # GET conversations, messages, lead status
│   │   ├── health-routes.ts          # GET /health check endpoint
│   │   └── trigger-routes.ts         # GET triggers (no-response, no-followup)
│   ├── config/
│   │   ├── environment-config.ts     # Zod schema for env vars
│   │   └── supabase-client.ts        # Singleton Supabase connection
│   ├── middleware/
│   │   ├── api-auth-middleware.ts    # x-api-key validation (timing-safe)
│   │   └── error-handler.ts          # Global error handling
│   ├── services/
│   │   ├── conversation-service.ts   # Upsert/query conversations
│   │   ├── message-service.ts        # Insert/query messages
│   │   └── trigger-service.ts        # Query unresponded/unfollowed leads
│   ├── types/
│   │   ├── database-types.ts         # TypeScript interfaces for DB
│   │   └── kommo-webhook-types.ts    # Kommo webhook payload types
│   ├── webhooks/
│   │   ├── kommo-standard-handler.ts # Main webhook receiver
│   │   └── webhook-raw-logger.ts     # Write-ahead log
│   ├── __tests__/
│   │   ├── api-auth-middleware.test.ts
│   │   ├── kommo-payload-parser.test.ts
│   │   └── trigger-routes.test.ts
│   ├── app.ts                        # Express app setup (middleware, routes)
│   └── server.ts                     # Entry point (load env, start server)
├── supabase/
│   └── migrations/
│       ├── 001-create-enums.sql      # Enum types
│       ├── 002-create-conversations.sql
│       ├── 003-create-messages.sql
│       └── 004-create-webhook-raw-log.sql
├── Dockerfile                        # Multi-stage production build
├── package.json                      # Dependencies & scripts
├── tsconfig.json                     # TypeScript config
├── .env.example                      # Environment template
└── README.md                         # Quick start guide
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

**Webhook Ingestion (POST /webhooks/kommo):**
1. Write-ahead log: Save raw payload
2. Respond 200 immediately
3. Parse async: Extract normalized fields
4. Upsert conversation record
5. Insert message record
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

### 6. API Endpoints

**Public:**
- `POST /webhooks/kommo` — Receive Kommo standard webhooks
- `GET /health` — Server health check

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
| `npm run lint` | Type check (no emit) |

## Security Features

1. **API Authentication:** Timing-safe key comparison (`x-api-key` header)
2. **Environment Validation:** Zod schema fails on startup if missing required vars
3. **Helmet:** Automatic security headers (X-Frame-Options, X-Content-Type-Options, CSP)
4. **Body Size Limit:** 50KB cap prevents large payload attacks
5. **Non-Root Docker:** App runs as `app` user
6. **Write-Ahead Log:** All raw payloads logged before processing (audit trail)
7. **Input Validation:** Zod schemas for env and request bodies

## Performance Characteristics

| Operation | Typical Time | Target |
|-----------|--------------|--------|
| POST /webhooks/kommo response | ~50ms | < 100ms |
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

**Current Coverage:**
- API auth middleware tests
- Kommo payload parser tests
- Trigger routes tests

**Target:** 70%+ coverage by Phase 2

## Known Limitations

1. **No Rate Limiting** — Recommend per-API-key limits in production
2. **Offset Pagination Only** — Cursor pagination planned for Phase 3
3. **No Caching Layer** — Redis could improve conversation queries
4. **Generic Error Messages** — Could provide more specific debug info
5. **Test Coverage < 70%** — Expanding in Phase 2

## Environment Variables

| Variable | Type | Required | Example |
|----------|------|----------|---------|
| PORT | number | No | 3000 |
| NODE_ENV | enum | No | production |
| SUPABASE_URL | string | Yes | https://xxxx.supabase.co |
| SUPABASE_ANON_KEY | string | Yes | eyJx... |
| SUPABASE_SERVICE_ROLE_KEY | string | Yes | eyJx... |
| API_KEY | string | Yes | your-secret-key |

## Common Tasks

### Add a New Endpoint

1. Create route file in `src/api/`
2. Add route to `src/app.ts`
3. Create service in `src/services/` if needed
4. Write tests in `src/__tests__/`
5. Update `docs/api-docs.md`

### Deploy to Production

1. Update version in `package.json`
2. Update `docs/project-changelog.md`
3. Build Docker image: `docker build -t kommo-monitor:latest .`
4. Push to EasyPanel registry
5. Deploy on EasyPanel console

### Run Database Migrations

```bash
# Supabase CLI (if installed)
supabase db push

# Or manually: Copy migration content to Supabase SQL editor
```

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
