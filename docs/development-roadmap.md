# Development Roadmap - Kommo WhatsApp Backend

## Project Status Overview

**Current Version:** 1.1.0-phase-a2
**Last Updated:** 2026-03-12
**Project Phase:** Phase A2 Deployed → Monitoring Live Traffic

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

**Status:** COMPLETE ✓
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

**Status:** COMPLETE ✓ | PRODUCTION
**Timeline:** Development completed 2026-03-10 | Deployed 2026-03-10
**Description:** Bidirectional message bridge between Kommo ChatAPI and WhatsApp Cloud API

## Phase A2: WhatsApp Coexistence Monitoring (Deployed)

**Status:** DEPLOYED ✓ | MONITORING LIVE TRAFFIC
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

### Architecture

```
Path 1: Coexistence (native, direct from WhatsApp)
  WhatsApp Customer
    ↓
  WhatsApp Cloud API (messages + echoes)
    ↓
  POST /webhooks/whatsapp
    ↓
  Parse echo → Store outgoing + Create mapping
    ↓
  messages table (direction=outgoing)

Path 2: ChatAPI (custom channel via Kommo)
  WhatsApp Customer
    ↓
  Kommo ChatAPI (agent app)
    ↓
  POST /webhooks/chatapi/:scopeId
    ↓
  Bridge to WhatsApp Cloud API
    ↓
  WhatsApp Cloud API → Customer
```

Both paths active simultaneously. Echo (Coexistence) is primary source of outgoing message content.

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

---

## Dependencies & Blockers

| Item | Type | Impact | Status |
|------|------|--------|--------|
| Supabase project | Infra | Blocking | ✓ In place |
| Kommo API credentials | Infra | Blocking | ✓ Configured |
| Meta WhatsApp Business Account | Infra | Blocking | ✓ Verified & Live |
| Docker registry | Infra | Blocking | ✓ Ready for EasyPanel |

---

## Performance Targets

### Response Times

| Endpoint | Target | Current | Status |
|----------|--------|---------|--------|
| POST /webhooks/kommo | < 100ms | ~50ms | ✓ Good |
| POST /webhooks/whatsapp | < 100ms | ~50ms | ✓ Good |
| GET /api/conversations | < 500ms | ~200ms | ✓ Good |
| GET /api/conversations/*/messages | < 500ms | ~150ms | ✓ Good |
| GET /api/triggers/* | < 1000ms | ~300ms | ✓ Good |

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

---

## Related Documentation

- [System Architecture](./system-architecture.md) — How it works
- [Code Standards](./code-standards.md) — How to develop features
- [API Documentation](./api-docs.md) — Available endpoints
- [Project Changelog](./project-changelog.md) — Version history
