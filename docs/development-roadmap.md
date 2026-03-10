# Development Roadmap - Kommo WhatsApp Backend

## Project Status Overview

**Current Version:** 1.0.0
**Last Updated:** 2024-03-10
**Project Phase:** MVP Complete → Early Production

### Key Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Core API Endpoints | 7 | Complete |
| Database Tables | 4 | Complete |
| Test Coverage | 60% | In Progress |
| Docker Support | Yes | Complete |
| Documentation | 90% | Complete |

---

## Phase 1: MVP (Completed)

**Status:** COMPLETE ✓
**Timeline:** Started 2024-01-15

### Deliverables

- [x] Express.js server with TypeScript
- [x] Supabase PostgreSQL integration
- [x] Kommo webhook receiver (`POST /webhooks/kommo`)
- [x] Message parser & normalizer
- [x] Conversation upsert logic
- [x] Raw webhook audit logger (write-ahead log)
- [x] Conversation query API (`GET /api/conversations`)
- [x] Message history API (`GET /api/conversations/:id/messages`)
- [x] Health check endpoint (`GET /health`)
- [x] API key authentication
- [x] Docker multi-stage build
- [x] Environment validation (Zod)
- [x] Error handling middleware
- [x] Basic unit tests

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

## Phase 2: Automation Triggers (Current)

**Status:** IN PROGRESS
**Timeline:** 2024-03-01 → 2024-03-20
**Priority:** HIGH

### Goals

- Identify stalled conversations for automation
- Expose trigger APIs for external systems (Zapier, Make, custom bots)
- Enable automated follow-ups and reminders

### Deliverables

- [x] Trigger service (`src/services/trigger-service.ts`)
- [x] No-response endpoint (`GET /api/triggers/no-response?hours=24`)
- [x] No-followup endpoint (`GET /api/triggers/no-followup?hours=48`)
- [ ] Unit tests for trigger queries
- [ ] Integration tests for trigger endpoints
- [ ] Documentation (API examples)

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

### Success Criteria

- [ ] Trigger endpoints respond in < 500ms
- [ ] Queries return correct results
- [ ] Tests cover edge cases (0 hours, 1000 hours, empty results)
- [ ] API documented with examples
- [ ] Logging shows trigger execution

---

## Phase 3: Enhanced Filtering & Pagination (Planned)

**Status:** PLANNED
**Timeline:** 2024-03-21 → 2024-04-10
**Priority:** MEDIUM

### Goals

- Improve query flexibility for large datasets
- Support complex filtering (date ranges, multiple statuses, fuzzy search)
- Optimize pagination for production scale

### Proposed Features

- [x] Date range filters (start_date, end_date)
- [x] Multi-status filter
- [ ] Search by message content (full-text search)
- [ ] Sorting options (by date, status, lead_id)
- [ ] Cursor-based pagination (vs offset)
- [ ] Export to CSV (for reporting)

### Database Improvements

- [ ] Create indexes on frequently filtered columns:
  - `conversations(status, last_message_at)`
  - `conversations(contact_id, created_at)`
  - `conversations(lead_id, created_at)`
  - `messages(conversation_id, created_at)`
- [ ] Analyze slow queries with `EXPLAIN ANALYZE`
- [ ] Consider materialized views for common reports

---

## Phase 4: Reporting & Analytics (Planned)

**Status:** PLANNED
**Timeline:** 2024-04-15 → 2024-05-31
**Priority:** MEDIUM

### Goals

- Provide insights into WhatsApp conversation patterns
- Enable data-driven decision making

### Proposed Features

- [ ] Conversation metrics endpoint:
  - Total conversations per lead
  - Response times (customer → agent, agent → customer)
  - Average message length
  - Engagement score

- [ ] Dashboard summary:
  - Messages per day
  - Avg conversations per agent
  - Unresponded conversations trend
  - Peak conversation hours

- [ ] Export endpoints:
  - CSV export of conversations
  - Daily/weekly report generation

### Implementation Approach

- Create aggregate tables (conversation_metrics, daily_summaries)
- Update aggregates on message insert (or batch job)
- Expose read-only API endpoints

---

## Phase 5: Advanced Features (Backlog)

**Status:** BACKLOG
**Priority:** LOW

### Proposed Features

1. **Message Sentiment Analysis**
   - Integrate NLP library (e.g., sentiment or transformers)
   - Tag messages as positive/negative/neutral
   - Alert on negative sentiment

2. **Conversation Auto-Tagging**
   - Detect conversation topics (pricing, complaints, orders, etc.)
   - Enable filtering by topic
   - Track topic trends

3. **Rate Limiting & Quotas**
   - Per-API-key rate limits (e.g., 100 req/min)
   - Track usage, enforce quotas
   - Support tiered API plans

4. **Webhook Retries**
   - If processing fails, retry with exponential backoff
   - Dead letter queue for permanent failures
   - Webhook status dashboard

5. **Message Search**
   - Full-text search across message content
   - Elasticsearch or PostgreSQL full-text search
   - Expose via `GET /api/search?q=...`

6. **Kommo ChatAPI Support**
   - In addition to standard webhooks, support ChatAPI format
   - Auto-detect payload format
   - Route to appropriate parser

7. **Multi-Channel Support**
   - Support other channels (Telegram, Facebook, SMS)
   - Generic message schema
   - Route by channel type

---

## Known Issues & Debt

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| Test coverage < 70% | Medium | In Progress | Need trigger tests, more route tests |
| No database indexes | High | Planned for Phase 3 | May cause slow queries at scale |
| No caching layer | Medium | Backlog | Could add Redis for conversation queries |
| Error messages generic | Low | Backlog | Could provide more specific debug info |
| No pagination cursor | Low | Planned for Phase 3 | Offset pagination only |

---

## Dependencies & Blockers

| Item | Type | Impact | Status |
|------|------|--------|--------|
| Supabase project | Infra | Blocking | ✓ In place |
| Kommo API credentials | Infra | Blocking | ✓ Configured |
| Docker registry | Infra | Blocking | ✓ Ready for EasyPanel |
| TypeScript / Node.js | Dev | Blocking | ✓ Compatible |
| Vitest framework | Dev | Info | ✓ Latest version |

---

## Performance Targets

### Response Times

| Endpoint | Target | Current | Status |
|----------|--------|---------|--------|
| POST /webhooks/kommo | < 100ms | ~50ms | ✓ Good |
| GET /api/conversations | < 500ms | ~200ms | ✓ Good |
| GET /api/conversations/*/messages | < 500ms | ~150ms | ✓ Good |
| GET /api/triggers/* | < 1000ms | ~300ms | ✓ Good |

### Scalability Targets

- **Requests per second:** 100+ (via load balancing)
- **Concurrent webhooks:** 1000+ (Supabase handles)
- **Data retention:** 12+ months (Supabase storage)
- **Conversation growth:** 10k+/day (auto-scales with database)

---

## Release Plan

### Version 1.0.0 (Current)
- Date: 2024-03-10
- Status: Released
- Features: Core webhook ingestion, basic API, audit logging

### Version 1.1.0 (Next Sprint)
- ETA: 2024-03-20
- Features: Automation triggers (no-response, no-followup), improved tests
- Breaking Changes: None

### Version 1.2.0 (Q2 2024)
- ETA: 2024-04-15
- Features: Enhanced filtering, sorting, cursor pagination
- Breaking Changes: May adjust query parameter names

### Version 2.0.0 (Q3 2024)
- ETA: 2024-06-01
- Features: Analytics, sentiment analysis, rate limiting
- Breaking Changes: New response format for some endpoints

---

## Team & Responsibilities

| Role | Person | Responsibilities |
|------|--------|------------------|
| Lead | - | Roadmap, architecture decisions, deployments |
| Backend Dev | - | Feature implementation, testing, bug fixes |
| DevOps | - | Docker, deployment, infrastructure, monitoring |
| QA | - | Test coverage, manual testing, edge cases |

---

## Success Metrics

By end of Phase 2 (March 2024):
- [ ] All Phase 1 features stable (zero breaking changes)
- [ ] Trigger endpoints live and tested (100% test coverage)
- [ ] Automation partners using triggers (e.g., Zapier)
- [ ] < 5 critical bugs reported
- [ ] Uptime > 99.5%

By end of Phase 3 (April 2024):
- [ ] Query latency < 500ms even with 1M+ conversations
- [ ] Advanced filters tested
- [ ] Cursor pagination implemented
- [ ] 80%+ test coverage

---

## Quarterly Review Schedule

- **Every Sprint (2 weeks):** Review progress, update blockers, adjust priorities
- **Monthly (end of month):** Stakeholder sync, feature prioritization
- **Quarterly (end of quarter):** Retrospective, roadmap revision

---

## Document History

| Date | Version | Changes |
|------|---------|---------|
| 2024-03-10 | 1.0 | Initial roadmap created after MVP completion |
| - | - | - |

---

## Related Documentation

- [System Architecture](./system-architecture.md) — How it works
- [Code Standards](./code-standards.md) — How to develop features
- [API Documentation](./api-docs.md) — Available endpoints
- [Project Changelog](./project-changelog.md) — Version history
