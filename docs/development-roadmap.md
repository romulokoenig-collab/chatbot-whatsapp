# Development Roadmap - Kommo WhatsApp Backend

## Project Status Overview

**Current Version:** 1.1.0-phase-a2
**Last Updated:** 2026-03-13
**Project Phase:** Phase A3 In Progress — Awaiting Kommo Support for Chat Channel Registration

### Key Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Core API Endpoints | 7 | Complete |
| Phase A Webhook Endpoints | 3 | Complete |
| Phase A2 Enhancements | 1 (message_echoes) | Complete |
| Database Tables | 5 | Complete |
| Message Forwarding Paths | 2 (bidirectional) | Complete |
| Test Coverage | 66/66 tests passing | Complete |
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

### Key Features

1. **Message Echo Support**
   - Process `smb_message_echoes` webhook field from Meta
   - Outgoing message capture parallel with incoming messages
   - Echo message ID mapping for status tracking
   - Phone number normalization prevents duplicate conversations

2. **Status Mapping Fallback**
   - Check for existing mapping before creating
   - Out-of-order event handling (status before echo)
   - Prevents race condition with skeletal records

3. **Deployment Infrastructure**
   - Meta webhook URL: `https://inicial-kommo-monitor.e8cf0x.easypanel.host/webhooks/whatsapp`
   - Signature verification via `WHATSAPP_APP_SECRET`
   - Health check: GET /health (passing)

---

## Phase A3: Outgoing Message Content Capture (In Progress)

**Status:** IN PROGRESS — Awaiting Kommo Support response for chat channel registration
**Timeline:** Started 2026-03-12
**Priority:** HIGH
**Description:** Register private chat channel with Kommo to access Chats API for outgoing message content

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
2. [ ] Test `GET amojo.kommo.com/v2/origin/custom/{scope_id}/chats/{conv_id}/history`
3. [ ] Implement reactive polling: Meta `sent` status → Chats API call → store content
4. [ ] Add HMAC-SHA1 signing for Chats API requests
5. [ ] Store outgoing message content in `messages` table
6. [ ] Add tests for new flow
7. [ ] Deploy to production

### Architecture (Planned — Post-Approval)

```
Meta webhook: status=sent + wamid
  |
  v
Our Backend (POST /webhooks/whatsapp)
  |
  v
Lookup conversation_id via message_id_mapping
  |
  v
GET amojo.kommo.com/v2/origin/custom/{scope_id}/chats/{conv_id}/history
  (HMAC-SHA1 signed request)
  |
  v
Extract outgoing message content
  |
  v
Store in messages table (direction=outgoing, text_content=...)
```

### Environment Variables

```
KOMMO_SUBDOMAIN=kfsa
KOMMO_PRIVATE_TOKEN=<long-lived-token>
KOMMO_SCOPE_ID=<from-channel-registration>
KOMMO_CHANNEL_SECRET=<from-channel-registration>
```

---

## Phase 2: Optimization & Monitoring (Next)

**Status:** PLANNED
**Timeline:** 2026-04-01 → 2026-04-30
**Priority:** HIGH

### Goals

- Identify stalled conversations for automation
- Expose trigger APIs for external systems (Zapier, Make, custom bots)
- Enable automated follow-ups and reminders

### Implementation Details

**No-Response Trigger:**
- Query: conversations where last message is `incoming`
- AND: last message created > N hours ago
- Returns: Leads waiting for agent response
- Use case: Alert agents, auto-escalate, send reminders

**No-Followup Trigger:**
- Query: conversations where last message is `outgoing`
- AND: last message created > N hours ago
- Returns: Leads waiting for customer reply
- Use case: Re-engagement campaigns, follow-up sequences

---

## Phase 3: Enhanced Filtering & Pagination (Planned)

**Status:** PLANNED
**Timeline:** 2026-04-16 → 2026-05-15
**Priority:** MEDIUM

### Goals

- Improve query flexibility for large datasets
- Support complex filtering (date ranges, multiple statuses, fuzzy search)
- Optimize pagination for production scale

---

## Phase 4: Reporting & Analytics (Planned)

**Status:** PLANNED
**Timeline:** 2026-05-16 → 2026-07-01
**Priority:** MEDIUM

### Goals

- Provide insights into WhatsApp conversation patterns
- Enable data-driven decision making

---

## Known Issues & Debt

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| Test coverage improved | Medium | RESOLVED | Now 66/66 tests passing |
| No database indexes | High | Planned for Phase 3 | May cause slow queries at scale |
| No caching layer | Medium | Backlog | Could add Redis for conversation queries |
| No pagination cursor | Low | Planned for Phase 3 | Offset pagination only |
| ChatAPI bridge dead code | Low | Open | Phase A ChatAPI code unused without credentials |

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
| GET /api/triggers/* | < 1000ms | ~300ms | Good |

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
- Features: Chats API integration for outgoing message content capture
- Dependency: Chat channel registration approval from Kommo Support

### Version 1.1.0 (Phase 2)
- ETA: 2026-04-30
- Features: Structured logging, performance monitoring, webhook retry logic

### Version 1.2.0 (Phase 3)
- ETA: 2026-05-15
- Features: Enhanced filtering, sorting, cursor pagination, composite indexes

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
| 2026-03-13 | 1.4 | Phase A3: Kommo Private Integration investigation, API testing results |
| 2026-03-13 | 1.5 | Phase A3: talks scope doesn't exist, pivoted to Chats API channel registration |

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
