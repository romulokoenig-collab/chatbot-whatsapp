# Project Changelog - Kommo WhatsApp Backend

All notable changes to the Kommo WhatsApp Monitoring Backend are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.1.0-phase-a2] - 2026-03-12

**Status:** Deployed to Production (Monitoring Live Traffic)

### Added (Phase A2 - WhatsApp Coexistence)

#### Message Echo Support
- WhatsApp Coexistence `smb_message_echoes` webhook field processing
- Outgoing message capture directly from Meta webhooks (parallel to ChatAPI approach)
- Echo processing loop in webhook handler alongside existing incoming message processing
- Full bidirectional message flow: Coexistence (native) + ChatAPI (custom channel)

#### Utilities
- `normalizePhone()` utility for consistent phone number formatting
  - Strips `+`, spaces, dashes from phone numbers
  - Prevents duplicate conversations from format mismatches (e.g., `+5551...` vs `5551...`)

#### Webhook Enhancements
- `WhatsAppMessageEcho` type definition for echo payload structure
- `parseWhatsAppEcho()` function for normalizing echo messages
- Exported `parseWhatsAppMessage()` for testability
- Echo conversation ID creation using normalized phone numbers
- Message ID mapping creation for echo messages (enables status tracking)

#### Status Mapping Fallback
- Status webhook processing enhancement: check for existing mapping before creating
- If no mapping exists, create mapping-only record (NOT ghost messages)
- Handles out-of-order delivery: status arrives before echo
- Prevents race condition where status creates skeletal record and echo gets deduped

#### Security
- `WHATSAPP_APP_SECRET` now required (was optional)
- All webhook events protected via signature verification
- Same SHA256 signature verification applies to all webhook types

#### Testing
- New test files:
  - `src/__tests__/normalize-phone.test.ts` — 3 test cases
  - `src/__tests__/whatsapp-echo-handler.test.ts` — 8 test cases
- Total tests: 66/66 passing
- New tests cover: text echoes, media echoes, null ID edge cases, timestamp fallback, phone normalization

#### Database
- No schema changes — uses existing `messages` and `message_id_mapping` tables
- Outgoing messages stored in `messages` table with `direction=outgoing`
- Echo message ID to Kommo conversation mapping in `message_id_mapping`

#### Deployment
- Meta Developers Portal: Webhook configured with URL `https://inicial-kommo-monitor.e8cf0x.easypanel.host/webhooks/whatsapp`
- Meta fields subscribed: `messages` + `smb_message_echoes`
- EasyPanel: `WHATSAPP_APP_SECRET` configured, Docker deployed successfully
- Health check: GET /health (passing)
- 4 unused Meta apps deleted (cleaned up duplicates)

### Architecture (Phase A2)

**Message Flow (Coexistence + ChatAPI parallel):**
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

Both paths active simultaneously.

**Production Finding (2026-03-12):** `smb_message_echoes` only fires for messages sent via WhatsApp Business App, NOT Cloud API. Since Kommo sends via Cloud API, echo content is not captured. Status tracking (sent/delivered/read) works and is sufficient for automation triggers.

### Testing Notes
- No Supabase mocks — all tests are pure function tests
- Tests use fixture data only
- Echo parsing tested independently of database/webhooks
- Phone normalization tested with various formats

### Risk Mitigation
- **Echo never arrives**: Mapping record exists but no message record — acceptable (no content-less records in timeline)
- **Out-of-order events**: Handled by status check-then-create pattern
- **Duplicate echoes**: Existing `ignoreDuplicates: true` on upsert
- **Cast echo to WhatsAppMessage**: Safe because echo has same media sub-objects; graceful null returns if structure differs

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
- `GET /api/conversations/:id/messages` — Message history (protected)
- `GET /api/leads/:kommoLeadId/status` — Lead status check (protected)
- `GET /api/triggers/no-response?hours=24` — Unresponded leads (protected)
- `GET /api/triggers/no-followup?hours=48` — Unfollowed leads (protected)

#### Database Schema
- `conversations` table — Track unique chat sessions
- `messages` table — Store individual messages
- `webhook_raw_log` table — Audit trail
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
- Unit test examples

#### Documentation
- System architecture overview
- API documentation with examples
- Code standards and patterns
- Development roadmap
- Environment configuration guide

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

---

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
| 1.1.0-phase-a2 | 2026-03-12 | Released | Phase A2 - Coexistence Support |
| 1.1.0 | Planned: 2026-04-15 | Backlog | Phase 2 - Enhancements |
| 1.2.0 | Planned: 2026-05-15 | Backlog | Phase 3 - Advanced Filtering |
| 2.0.0 | Planned: 2026-07-01 | Backlog | Phase 4 - Analytics |

---

## Breaking Changes Log

### Version 1.0.0
- Initial release, no breaking changes

### Version 1.1.0-phase-a
- No breaking changes

### Version 1.1.0-phase-a2
- `WHATSAPP_APP_SECRET` now required (was optional)

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

### Upgrading from 1.0.0 to 1.1.0-phase-a
- No database migrations required
- No API changes expected
- Update .env file with any new variables (see CLAUDE.md)

### Upgrading from 1.1.0-phase-a to 1.1.0-phase-a2
- No database migrations required
- `WHATSAPP_APP_SECRET` must be configured in .env
- Redeploy Docker image with updated environment

### Upgrading to 2.0.0
- Database migration guide will be provided
- API response format may change
- Breaking changes documented in release notes

---

## Known Issues

| ID | Severity | Component | Status | Notes |
|----|----------|-----------|--------|-------|
| #001 | Medium | Testing | Resolved | Test coverage now 66/66 passing |
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

- No known CVEs in current dependencies (as of 2026-03-12)
- Recommend: Check for updates monthly
- Supabase JS updates: Pull at least quarterly for security patches
- Node.js: Currently on Node 20, plan upgrade to Node 22+ by Q4 2026

---

## Document History

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-10 | 1.0 | Created initial changelog after MVP completion |
| 2026-03-10 | 1.1 | Updated with production deployment confirmation |
| 2026-03-11 | 1.2 | Phase 6 integration test results: incoming PASS, outgoing FAIL → Phase A needed |
| 2026-03-10 | 1.3 | Phase A implementation complete: bidirectional bridge, ChatAPI + WhatsApp Cloud API |
| 2026-03-11 | 1.4 | Phase A2 implementation complete: Coexistence message_echoes support, 66/66 tests passing |
| 2026-03-12 | 1.5 | Phase A2 deployed to production: Meta webhook configured, live monitoring active |

---

## Related Documentation

- [System Architecture](./system-architecture.md) — How components work together
- [Code Standards](./code-standards.md) — Development guidelines
- [API Documentation](./api-docs.md) — Endpoint reference
- [Development Roadmap](./development-roadmap.md) — Future plans
- [CLAUDE.md](../CLAUDE.md) — Project setup and commands
