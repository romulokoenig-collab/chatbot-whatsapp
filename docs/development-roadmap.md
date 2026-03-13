# Development Roadmap - Kommo WhatsApp Backend

## Project Status Overview

**Current Version:** 1.1.0-phase-a3
**Last Updated:** 2026-03-13
**Project Phase:** Phase A3 In Progress — Awaiting Kommo Support for Chat Channel Registration

### Key Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Core API Endpoints | 7 | Complete |
| Phase A Webhook Endpoints | 3 | Complete |
| Phase A2 Enhancements | 1 (message_echoes) | Complete |
| Database Tables | 5 | Complete |
| Composite Indexes | 3 | Complete |
| Message Forwarding Paths | 2 (bidirectional) | Complete |
| Test Coverage | 66/66 tests passing | Complete |
| Structured Logging | Pino (JSON prod, pretty dev) | Complete |
| Docker Support | Yes | Complete |
| Documentation | 95% | Complete |

---

## Phase 1: MVP (Completed)

**Status:** COMPLETE
**Timeline:** Started 2026-01-15 → Deployed 2026-03-10
**Live URL:** https://inicial-kommo-monitor.e8cf0x.easypanel.host

### Key Features

1. **Webhook Ingestion**
   - Fast response (< 100ms) to Kommo
   - Write-ahead log for durability
   - Async processing after response

2. **Data Storage**
   - Conversations table (kommo_chat_id, contact_id, lead_id, status)
   - Messages table (direction, sender_type, content_type, text, media)
   - Webhook audit log (source, status, payload, error)

3. **API Queries**
   - Filter conversations by status, date, contact, lead
   - Pagination with limit/offset
   - Health check for monitoring

4. **Security**
   - API key authentication (x-api-key header)
   - Timing-safe key comparison
   - Helmet security headers
   - CORS enabled

---

## Phase A: Bidirectional WhatsApp Bridge (Complete)

**Status:** COMPLETE | PRODUCTION
**Timeline:** Development completed 2026-03-10 | Deployed 2026-03-10
**Description:** Bidirectional message bridge between Kommo ChatAPI and WhatsApp Cloud API

## Phase A2: WhatsApp Coexistence Monitoring (Deployed)

**Status:** DEPLOYED | MONITORING LIVE TRAFFIC
**Timeline:** Development completed 2026-03-11 | Deployed to production 2026-03-12
**Description:** WhatsApp Cloud API message_echoes support for outgoing message capture and status mapping fallback

### Deliverables

- [x] WhatsApp message echo processing (`parseWhatsAppEcho()`)
- [x] Echo conversation ID creation with normalized phone numbers
- [x] Status mapping fallback (check before creating)
- [x] Message ID mapping for echo messages
- [x] Phone number normalization utility (`normalizePhone()`)
- [x] Per-item error handling in echo processing loop
- [x] Required environment variable: `WHATSAPP_APP_SECRET`
- [x] Tests: 66/66 passing (8 new echo tests + 3 normalize-phone tests)
- [x] Meta Developers Portal webhook configuration
- [x] Field subscription: `messages` + `smb_message_echoes`
- [x] EasyPanel deployment with `WHATSAPP_APP_SECRET` configured
- [x] Health check validation

---

## Phase A3: Outgoing Message Content Capture (In Progress)

**Status:** IN PROGRESS — Awaiting Kommo Support response for chat channel registration
**Timeline:** Started 2026-03-12
**Priority:** HIGH
**Description:** Register private chat channel with Kommo to access Chats API for outgoing message content

### Completed (2026-03-13)

- [x] Composite database indexes for trigger queries (migration 006)
- [x] Pino structured logging replacing all console.* calls
- [x] AppError class with structured error responses `{code, message}`
- [x] Kommo Chats API HMAC-SHA1 client (`kommo-chats-api-client.ts`)
- [x] Code review: all findings addressed

### Background & Investigation

1. **ChatAPI credentials denied** (2026-03-12) — Kommo: credentials belong to integration provider
2. **Private Integration created** (2026-03-13) — REST API v4 works, but no message content
3. **`talks` scope doesn't exist** (2026-03-13) — Only 4 scopes available: `crm`, `notifications`, `files`, `files_delete`
4. **REST API v4 insufficient** (2026-03-13) — `/api/v4/talks/{id}` = metadata only; events API = UUID only
5. **Private chat channel registration requested** (2026-03-13) — Via Kommo support ticket

### Key Finding: Two Separate API Systems

| API Layer | Auth | Message Content? |
|-----------|------|-----------------|
| REST API v4 (`{subdomain}.kommo.com/api/v4/`) | OAuth Bearer token | NO — metadata only |
| Chats API (`amojo.kommo.com`) | HMAC-SHA1 (scope_id + secret) | YES — full text + media |

### Current Blocker

Private chat channel registration requires Kommo Support approval (1-3 business days). Request submitted 2026-03-13.

### Next Steps (After Kommo Approval)

1. [ ] Receive `scope_id` + `channel_secret` from Kommo
2. [ ] Configure credentials in EasyPanel
3. [ ] Test Chats API history endpoint with real data
4. [ ] Implement reactive polling: Meta `sent` status → Chats API call → store content
5. [ ] Store outgoing message content in `messages` table
6. [ ] Add tests for new flow
7. [ ] Deploy to production

### Environment Variables

```
KOMMO_SUBDOMAIN=kfsa
KOMMO_PRIVATE_TOKEN=<long-lived-token>
KOMMO_SCOPE_ID=<from-channel-registration>
KOMMO_CHANNEL_SECRET=<from-channel-registration>
LOG_LEVEL=info
```

---

## Phase 2: Optimization & Monitoring (Next)

**Status:** PARTIALLY COMPLETE
**Timeline:** 2026-04-01 → 2026-04-30
**Priority:** HIGH

### Completed Early (moved from Phase 2/3)

- [x] Structured logging (Pino) — JSON in prod, pretty-print in dev
- [x] Composite database indexes on (status, last_incoming_at), (status, last_outgoing_at)
- [x] Structured error responses (AppError class)

### Remaining Goals

- Webhook retry logic with exponential backoff
- Performance monitoring and metrics
- Enhanced trigger queries with configurable thresholds

---

## Phase 3: Enhanced Filtering & Pagination (Planned)

**Status:** PLANNED
**Timeline:** 2026-04-16 → 2026-05-15
**Priority:** MEDIUM

### Goals

- Cursor-based pagination (vs offset)
- Complex filtering (date ranges, multiple statuses, fuzzy search)
- Full-text search on message content

---

## Phase 4: Reporting & Analytics (Planned)

**Status:** PLANNED
**Timeline:** 2026-05-16 → 2026-07-01
**Priority:** MEDIUM

### Goals

- Conversation metrics API
- Daily summary aggregations
- Response time analytics

---

## Known Issues & Debt

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| #001 | Medium | RESOLVED | Test coverage 66/66 passing |
| #002 | High | RESOLVED | Composite indexes added (migration 006) |
| #003 | Low | RESOLVED | AppError class with structured responses |
| #004 | Low | Open | Offset pagination only, no cursor support |
| #005 | High | Blocked | Chats API requires channel registration |
| #006 | Low | Clarified | ChatAPI bridge is pre-built for own-channel architecture |

---

## Dependencies & Blockers

| Item | Type | Impact | Status |
|------|------|--------|--------|
| Supabase project | Infra | Blocking | In place |
| Kommo API credentials | Infra | Blocking | Configured |
| Meta WhatsApp Business Account | Infra | Blocking | Verified & Live |
| Docker registry | Infra | Blocking | Ready for EasyPanel |
| Kommo Chat Channel Registration | Infra | Blocking Phase A3 | Pending — awaiting Kommo Support approval (1-3 days) |

---

## Performance Targets

### Response Times

| Endpoint | Target | Current | Status |
|----------|--------|---------|--------|
| POST /webhooks/kommo | < 100ms | ~50ms | Good |
| POST /webhooks/whatsapp | < 100ms | ~50ms | Good |
| GET /api/conversations | < 500ms | ~200ms | Good |
| GET /api/conversations/*/messages | < 500ms | ~150ms | Good |
| GET /api/triggers/* | < 1000ms | ~85ms | Good (indexed) |

---

## Release Plan

### Version 1.0.0 (Released)
- Date: 2026-03-10
- Status: Production
- Features: Core webhook ingestion, REST API, audit logging, Docker deployment

### Version 1.1.0-phase-a (Released)
- Date: 2026-03-10
- Status: Production
- Features: Bidirectional ChatAPI + WhatsApp Cloud API bridge

### Version 1.1.0-phase-a2 (Released)
- Date: 2026-03-12
- Status: Production (Monitoring Live)
- Features: WhatsApp Coexistence message_echoes support, status mapping fallback, phone normalization
- Tests: 66/66 passing
- Breaking Changes: WHATSAPP_APP_SECRET now required

### Version 1.1.0-phase-a3 (In Progress)
- ETA: 2026-03-17 (depends on Kommo approval)
- Features: Chats API client, Pino logging, AppError class, composite indexes
- Dependency: Chat channel registration approval from Kommo Support

### Version 1.1.0 (Phase 2)
- ETA: 2026-04-30
- Features: Webhook retry, performance monitoring

### Version 1.2.0 (Phase 3)
- ETA: 2026-05-15
- Features: Cursor pagination, full-text search

### Version 2.0.0 (Phase 4)
- ETA: 2026-07-01
- Features: Analytics endpoints, sentiment analysis, rate limiting

---

## Document History

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-10 | 1.0 | Initial roadmap after MVP completion |
| 2026-03-10 | 1.1 | Added Phase A (bidirectional bridge) |
| 2026-03-11 | 1.2 | Phase A2 code complete, 66/66 tests |
| 2026-03-12 | 1.3 | Phase A2 deployed to production, live monitoring |
| 2026-03-13 | 1.4 | Phase A3: Kommo Private Integration investigation |
| 2026-03-13 | 1.5 | Phase A3: talks scope doesn't exist, pivot to Chats API |
| 2026-03-13 | 1.6 | Phase A3: Pino logging, AppError, Chats API client, composite indexes |

---

## Related Documentation

- [System Architecture](./system-architecture.md) — How it works
- [Code Standards](./code-standards.md) — How to develop features
- [API Documentation](./api-docs.md) — Available endpoints
- [Project Changelog](./project-changelog.md) — Version history

### Production Findings

#### Echo Limitation (2026-03-12)

`smb_message_echoes` only fires for messages sent via the WhatsApp Business App (mobile/desktop), NOT for messages sent via Cloud API by BSPs like Kommo. Since Kommo sends messages through the Cloud API, outgoing message content is not captured via echoes.

#### Kommo ChatAPI Credentials Denied (2026-03-12)

Kommo support confirmed: ChatAPI credentials belong to the integration provider and are not shared. There is no officially supported method to access other integrations' chat history. ChatAPI is designed for creating your own chat integration. Request added to development wishlist.

#### Kommo REST API v4 — No Message Content (2026-03-13)

Private Integration created successfully. REST API v4 works with long-lived token. However, **no REST API endpoint returns message text content**:
- `/api/v4/talks/{id}` — metadata only (ID, status, participants)
- `/api/v4/events?filter[type]=outgoing_chat_message` — message UUID only, no text
- `talks` scope does not exist in Kommo's permission system (only: crm, notifications, files, files_delete)

Message text is exclusively available via the **Chats API** (`amojo.kommo.com`), which requires a registered chat channel with `scope_id` + `channel_secret`. Private chat channel registration requested 2026-03-13.

**What works now:**
- Incoming messages: captured via Meta webhook + Kommo standard webhook
- Status tracking: `sent -> delivered -> read` cycle captured in `message_id_mapping`
- Kommo outgoing events: metadata only (message_id, talk_id, timestamps) — no content

**Conclusion:** Status tracking + Kommo standard webhooks sufficient for automation triggers. Full outgoing message content capture requires Chats API access via registered chat channel.
