# Project Changelog - Kommo WhatsApp Backend

All notable changes to the Kommo WhatsApp Monitoring Backend are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.0.0] - 2026-03-10

**Status:** Released (MVP)

### Added

#### Core Features
- Express.js REST API server with TypeScript
- Kommo CRM webhook receiver (`POST /webhooks/kommo`)
- Message parser supporting text, image, video, file, voice, location, sticker content types
- Conversation upsert logic with deduplication by `kommo_chat_id`
- Write-ahead logging for webhook audit trail (webhook_raw_log table)
- Raw payload persistence for debugging and replay

#### API Endpoints
- `POST /webhooks/kommo` — Receive Kommo standard webhooks (public)
- `GET /health` — Server health check (public)
- `GET /api/conversations` — Query conversations with filters (protected)
  - Filters: status, contact_id, lead_id, kommo_chat_id, start_date, end_date
  - Pagination: limit, offset
- `GET /api/conversations/:id/messages` — Message history (protected)
- `GET /api/leads/:kommoLeadId/status` — Lead status check (protected)
- `GET /api/triggers/no-response?hours=24` — Unresponded leads (protected)
- `GET /api/triggers/no-followup?hours=48` — Unfollowed leads (protected)

#### Database Schema
- `conversations` table — Track unique chat sessions
  - Columns: id, kommo_chat_id, contact_id, lead_id, status, last_message_at, created_at, updated_at
  - Indexes: kommo_chat_id (unique), contact_id, lead_id, created_at
- `messages` table — Store individual messages
  - Columns: id, conversation_id, kommo_message_id, direction, sender_type, content_type, text_content, media_url, raw_payload, created_at
  - Indexes: conversation_id, kommo_message_id (unique), created_at
- `webhook_raw_log` table — Audit trail
  - Columns: id, source, event_type, status, payload, error_message, created_at
  - Indexes: source, status, created_at
- Enum types: conversation_status, message_direction, sender_type, content_type, webhook_source

#### Security
- API key authentication via `x-api-key` header
- Timing-safe key comparison (prevents timing attacks)
- Helmet security middleware (CORS, headers, etc.)
- Environment variable validation with Zod
- Request body size limit (50KB)

#### Infrastructure
- Docker multi-stage build (Node 20 Alpine)
- Non-root user execution in container
- TypeScript strict mode enabled
- ESM modules with .js extension imports

#### Testing
- Vitest test framework setup
- Supertest for API testing
- Unit test examples:
  - API auth middleware tests
  - Kommo payload parser tests
  - Trigger routes tests

#### Documentation
- System architecture overview
- API documentation with examples
- Code standards and patterns
- Development roadmap
- Environment configuration guide

### Changed

- N/A (initial release)

### Fixed

- N/A (initial release)

### Deprecated

- N/A

### Removed

- N/A

### Security

- API keys validated with timing-safe comparison
- All environment secrets loaded from .env, never hardcoded
- Helmet enabled for security headers
- Request body size capped at 50KB to prevent DOS

### Performance

- Webhook response sent immediately (< 100ms) before async processing
- Supabase connection reused (singleton pattern)
- Database indexes on frequently queried columns
- No N+1 queries in trigger endpoints

### Notes

- **Write-Ahead Logging**: All webhooks logged before processing ensures no data loss
- **Async Processing**: Kommo gets 200 immediately; message processing happens after
- **Content Type Detection**: Automatically detects media type from Kommo attachment
- **Sender Type Resolution**: Determines if sender is customer, agent, bot, or system

---

## [1.0.1] - 2026-03-11

**Status:** Released (Integration Test Complete)

### Added
- Webhook registered in Kommo production via UI (bypasses API DNS validation)
- Events: "Mensagem recebida" + "Nota adicionada ao lead"
- 17 real WhatsApp incoming messages captured and processed successfully

### Tested
- **Incoming messages (customer→agent): PASS** — All captured with correct direction, sender_type, text_content
- **Outgoing messages (agent→customer): FAIL** — Kommo does NOT send webhooks for agent replies
- **Decision: Phase B (standard webhooks) insufficient** — Phase A (ChatAPI) required for bidirectional capture

### Known Limitations
- Only incoming messages captured via standard Kommo webhooks
- Outgoing message capture requires ChatAPI custom channel integration (Phase A)

---

## [1.1.0-phase-a] - 2026-03-10

**Status:** Phase A Implementation Complete (Bidirectional Bridge)

### Added (Phase A)

#### Webhook Integration (ChatAPI + WhatsApp Cloud API)
- Kommo ChatAPI custom channel webhook handler (`POST /webhooks/chatapi/:scopeId`)
  - HMAC-SHA1 signature verification using `KOMMO_CHANNEL_SECRET`
  - Processes outgoing messages from Kommo agents
  - Forwards to WhatsApp Cloud API
- WhatsApp Cloud API webhook handler (`GET+POST /webhooks/whatsapp`)
  - X-Hub-Signature verification using `WHATSAPP_APP_SECRET`
  - GET for Meta's webhook verification challenge
  - POST for incoming customer messages from WhatsApp
  - Forwards to Kommo ChatAPI

#### Message Bridging Infrastructure
- Bidirectional message forwarding service (`message-bridge-service.ts`)
  - `bridgeWhatsAppToKommo()` — Route incoming WhatsApp → Kommo ChatAPI
  - `bridgeKommoToWhatsApp()` — Route outgoing Kommo → WhatsApp Cloud API
- Message ID mapping service (`message-mapping-service.ts`)
  - Stores correspondence between WhatsApp message IDs and Kommo message IDs
  - Enables two-way message tracking for audit and reconciliation

#### External API Clients
- Kommo ChatAPI HTTP client (`kommo-chatapi-client.ts`)
  - `sendMessageToKommo()` — POST to ChatAPI with message data
  - Supports text and media attachments
  - Returns Kommo message ID for mapping
- WhatsApp Cloud API HTTP client (`whatsapp-api-client.ts`)
  - `sendTextToWhatsApp()` — Send text messages
  - `sendMediaToWhatsApp()` — Send images, videos, documents
  - Integrates with Graph API
  - Returns WhatsApp message ID for mapping

#### Signature Verification Utilities
- HMAC signature utilities (`hmac-signature.ts`)
  - `verifyHmacSha1()` — Kommo ChatAPI verification
  - `verifyHmacSha256()` — WhatsApp Cloud API verification
  - Timing-safe comparison prevents signature spoofing

#### Type Definitions
- Kommo ChatAPI webhook types (`chatapi-webhook-types.ts`)
  - `ChatApiWebhookPayload`, `ChatApiMessage`, `ChatApiFile`
- WhatsApp webhook types (`whatsapp-webhook-types.ts`)
  - `WhatsAppWebhookPayload`, `WhatsAppMessage`, `WhatsAppMedia`

#### Database
- New `message_id_mapping` table (migration `005-create-message-id-mapping.sql`)
  - Tracks `(whatsapp_message_id, kommo_message_id, kommo_conversation_id)`
  - Unique indexes on both message ID types
  - Enables bi-directional ID lookup

#### Environment Configuration
- 8 new optional environment variables (all Phase A related)
  - Kommo: `KOMMO_CHANNEL_ID`, `KOMMO_CHANNEL_SECRET`, `KOMMO_SCOPE_ID`, `KOMMO_AMOJO_ID`
  - WhatsApp: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`

### Architecture Changes

**Message Flow (Phase A):**
```
┌─ WhatsApp Cloud API ─┐
│  (customer messages) │
└──────────┬───────────┘
           ↓
    GET /webhooks/whatsapp (verify)
    POST /webhooks/whatsapp (incoming)
           ↓
   ┌───────────────────┐
   │ Our Backend Server│
   │ ├─ Parse message  │
   │ ├─ Store in DB    │
   │ └─ Bridge to      │
   │    Kommo ChatAPI  │
   └────────┬──────────┘
            ↓
┌──── Kommo ChatAPI ────┐
│ (agent sees message)  │
└──────────┬────────────┘
           ↓
  Agent sends reply
  (outgoing message)
           ↓
POST /webhooks/chatapi/:scopeId
           ↓
   ┌───────────────────┐
   │ Our Backend Server│
   │ ├─ Parse message  │
   │ ├─ Store in DB    │
   │ └─ Bridge to      │
   │    WhatsApp       │
   └────────┬──────────┘
            ↓
┌─ WhatsApp Cloud API ─┐
│ (customer receives) │
└──────────────────────┘
```

**New Webhook Endpoints:**
- Public: `POST /webhooks/chatapi/:scopeId` — Kommo ChatAPI (HMAC-SHA1 protected)
- Public: `GET /webhooks/whatsapp` — WhatsApp verification challenge
- Public: `POST /webhooks/whatsapp` — WhatsApp incoming messages (X-Hub-Signature protected)

### Security (Phase A)

- HMAC-SHA1 signature verification for Kommo ChatAPI integration
- X-Hub-Signature verification for WhatsApp Cloud API integration
- Timing-safe comparison for all signature checks (prevents timing attacks)
- Secret keys loaded from environment, never hardcoded
- Webhook endpoints reject unsigned/invalid requests

### Performance (Phase A)

- Async message forwarding (respond to webhook immediately, bridge after)
- Efficient ID mapping lookup (indexed by both message ID types)
- No additional database round-trips for message forwarding

### Testing (Phase A)

- Unit tests for signature verification utilities
- Tests for message bridge service
- Tests for HTTP client error handling

## [Unreleased]

### Planned Features (Phase 2+)
- Structured logging for better observability
- Performance monitoring and metrics
- Webhook retry logic with exponential backoff

### Planned Features (Phase 2)

#### Automation Triggers (In Progress)
- Enhanced trigger queries with configurable thresholds
- Improved performance for high-volume conversations
- Comprehensive test coverage for trigger endpoints

#### Testing & QA
- Integration tests covering all routes
- Load testing for scalability validation
- Edge case testing (0 hours, 1000+ hours, empty results)

#### Monitoring & Observability
- Structured logging (Winston or Pino)
- Performance metrics (response times, error rates)
- Dashboard integration support

### Planned Features (Phase 3)

#### Query Optimization
- Database indexes on composite columns
- Cursor-based pagination (vs offset)
- Full-text search on message content

#### Advanced Filtering
- Sort by multiple columns
- Fuzzy search on conversation metadata
- Multi-status filtering

### Planned Features (Phase 4+)

#### Analytics & Reporting
- Conversation metrics API
- Daily summary aggregations
- Response time analytics

#### Advanced Features (Backlog)
- Sentiment analysis on messages
- Automatic conversation tagging
- Rate limiting by API key
- Kommo ChatAPI format support
- Multi-channel support (Telegram, SMS, etc.)

---

## Version History Summary

| Version | Release Date | Status | Phase |
|---------|--------------|--------|-------|
| 1.0.0 | 2026-03-10 | Released | MVP - Standard Webhooks Only |
| 1.1.0-phase-a | 2026-03-10 | Released | Phase A - Bidirectional Bridge |
| 1.1.0 | Planned: 2026-04-15 | Backlog | Phase 2 - Enhancements |
| 1.2.0 | Planned: 2026-05-15 | Backlog | Phase 3 - Advanced Filtering |
| 2.0.0 | Planned: 2026-07-01 | Backlog | Phase 4 - Analytics |

---

## Breaking Changes Log

### Version 1.0.0
- Initial release, no breaking changes

### Version 1.1.0 (Planned)
- No breaking changes expected

### Version 1.2.0 (Planned)
- May adjust query parameter names for consistency
- May change pagination response format

### Version 2.0.0 (Planned)
- Response structure will change for analytics endpoints
- New required fields in API responses

---

## Migration Guide

### Upgrading from 1.0.0 to 1.1.0
- No database migrations required
- No API changes expected
- Update .env file with any new variables (see CLAUDE.md)

### Upgrading to 2.0.0
- Database migration guide will be provided
- API response format may change
- Breaking changes documented in release notes

---

## Known Issues

| ID | Severity | Component | Status | Notes |
|----|----------|-----------|--------|-------|
| #001 | Medium | Testing | Open | Test coverage below 70% target |
| #002 | High | Database | Open | Missing composite indexes on (status, created_at) |
| #003 | Low | Error Messages | Open | Generic 500 errors, could be more specific |
| #004 | Low | Pagination | Open | Offset pagination only, no cursor support |

---

## Dependencies & Third-Party Updates

### Current Versions (as of 1.0.0)

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

### Dependency Security Notes

- No known CVEs in current dependencies (as of 2026-03-11)
- Recommend: Check for updates monthly
- Supabase JS updates: Pull at least quarterly for security patches
- Node.js: Currently on Node 20, plan upgrade to Node 22+ by Q4 2026

---

## Release Notes Archives

### 1.0.0 Release Notes

**Date:** March 10, 2026
**Type:** Initial Release

**What's New:**
- Complete webhook ingestion pipeline
- REST API for conversation queries
- Audit logging with write-ahead log
- Docker-ready deployment

**What to Know:**
- API key required for protected endpoints
- Webhooks processed asynchronously
- All data stored in Supabase PostgreSQL
- Deployable to EasyPanel or any Docker host

**Get Started:**
1. Set up Supabase project
2. Run migrations (`supabase/migrations/`)
3. Configure .env file
4. Deploy with Docker

---

## Document History

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-10 | 1.0 | Created initial changelog after MVP completion |
| 2026-03-10 | 1.1 | Updated with production deployment confirmation |
| 2026-03-11 | 1.2 | Phase 6 integration test results: incoming PASS, outgoing FAIL → Phase A needed |
| 2026-03-10 | 1.3 | Phase A implementation complete: bidirectional bridge, ChatAPI + WhatsApp Cloud API |

---

## Related Documentation

- [System Architecture](./system-architecture.md) — How components work together
- [Code Standards](./code-standards.md) — Development guidelines
- [API Documentation](./api-docs.md) — Endpoint reference
- [Development Roadmap](./development-roadmap.md) — Future plans
- [CLAUDE.md](../CLAUDE.md) — Project setup and commands
