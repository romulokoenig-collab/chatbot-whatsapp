# Project Changelog - Kommo WhatsApp Backend

All notable changes to the Kommo WhatsApp Monitoring Backend are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.1.0-phase-a3] - 2026-03-13 (In Progress)

**Status:** In Progress — Awaiting Kommo Support for chat channel registration

### Added

#### Pino Structured Logging
- Replaced all `console.log/warn/error` with Pino structured logger across 15+ files
- JSON output in production, pretty-printed in development
- Log level configurable via `LOG_LEVEL` env var (default: `info`)
- Object-first pattern: `logger.info({ data }, "message")` for structured context

#### AppError Class & Structured Error Responses
- New `AppError` class (`src/utils/app-error.ts`) with `statusCode`, `code`, `isOperational`
- Static factories: `AppError.badRequest()`, `AppError.notFound()`, `AppError.internal()`
- Error handler returns `{ error: { code, message } }` instead of `{ error: string }`
- Stack traces included only in non-production environments
- Uses validated `env.NODE_ENV` instead of `process.env.NODE_ENV`

#### Kommo Chats API HMAC Client
- New `fetchChatHistory()` in `src/services/kommo-chats-api-client.ts`
- HMAC-SHA1 signing: `HMAC(secret, MD5("GET" + path))` per Kommo spec
- Reuses `generateHmacSha1`/`generateContentMd5` from shared `hmac-signature.ts` (DRY)
- Auto-pagination with `offset_id` cursor, `MAX_PAGES=20` safety cap
- Graceful error recovery: returns partial results on mid-pagination failures
- Throws early if `KOMMO_SCOPE_ID` or `KOMMO_CHANNEL_SECRET` not configured

#### Database Performance
- Composite index: `idx_conversations_status_last_incoming` (status + last_incoming_at DESC, WHERE active)
- Composite index: `idx_conversations_status_last_outgoing` (status + last_outgoing_at DESC, WHERE active)
- Contact filter index: `idx_conversations_contact_id` (kommo_contact_id WHERE NOT NULL)
- Migration: `006-add-composite-indexes.sql` — applied to production

### Changed
- Error response format: `{ error: string }` → `{ error: { code: string, message: string } }`
- `GET /api/conversations/:id/messages` returns `{data: [], count: 0}` for empty results (was 404)
- Trigger routes use `next(err)` delegation instead of inline error handling

### Fixed
- `AppError.internal()` no longer accepts unused message parameter
- Error handler uses validated `env.NODE_ENV` instead of raw `process.env.NODE_ENV`
- Removed duplicate crypto code in Chats API client (now uses shared `hmac-signature.ts`)

### Dependencies
- Added: `pino@^9.7.0` (structured logging)
- Added: `pino-pretty@^13.0.0` (dev dependency, pretty-print in development)

### Investigation: Outgoing Message Content Capture

#### Dead Ends (Confirmed)
1. `talks` scope — doesn't exist in Kommo
2. Events API `with=message_text` — 400 "Invalid with parameter"
3. Notes API on leads/contacts — 204 empty
4. Private Integration scope dropdown — only 4 scopes, no `talks`
5. REST API talks endpoint — metadata only, never returns message text
6. Kommo widgets UI — Private Integrations not visible in standard list
7. ChatAPI credentials request — denied by Kommo (provider-owned)
8. Periodic polling — rejected (5min too slow for AI conversations)

#### Pivot: Private Chat Channel Registration
Submitted request to Kommo Support (2026-03-13) to register a private chat channel linked to our Private Integration. Returns `scope_id` + `channel_secret` for Chats API access.

### Issues Resolved
- **#002** (High) — Missing composite indexes → Added 3 filtered indexes
- **#003** (Low) — Generic error messages → AppError with structured responses
- **#006** (Low) — ChatAPI bridge "dead code" → Reclassified as pre-built infrastructure

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

#### Deployment
- Meta Developers Portal: Webhook configured with URL `https://inicial-kommo-monitor.e8cf0x.easypanel.host/webhooks/whatsapp`
- Meta fields subscribed: `messages` + `smb_message_echoes`
- EasyPanel: `WHATSAPP_APP_SECRET` configured, Docker deployed successfully

**Production Finding (2026-03-12):** `smb_message_echoes` only fires for messages sent via WhatsApp Business App, NOT Cloud API. Since Kommo sends via Cloud API, echo content is not captured. Status tracking (sent/delivered/read) works and is sufficient for automation triggers.

---

## [1.1.0-phase-a] - 2026-03-10

**Status:** Phase A Implementation Complete (Bidirectional Bridge)

### Added (Phase A)

#### Webhook Integration (ChatAPI + WhatsApp Cloud API)
- Kommo ChatAPI custom channel webhook handler (`POST /webhooks/chatapi/:scopeId`)
- WhatsApp Cloud API webhook handler (`GET+POST /webhooks/whatsapp`)

#### Message Bridging Infrastructure
- Bidirectional message forwarding service (`message-bridge-service.ts`)
- Message ID mapping service (`message-mapping-service.ts`)

#### External API Clients
- Kommo ChatAPI HTTP client (`kommo-chatapi-client.ts`)
- WhatsApp Cloud API HTTP client (`whatsapp-api-client.ts`)

#### Signature Verification Utilities
- HMAC signature utilities (`hmac-signature.ts`)

#### Database
- New `message_id_mapping` table (migration `005-create-message-id-mapping.sql`)

---

## [1.0.1] - 2026-03-11

**Status:** Released (Integration Test Complete)

### Added
- Webhook registered in Kommo production via UI
- 17 real WhatsApp incoming messages captured and processed successfully

### Tested
- **Incoming messages: PASS** — All captured with correct direction, sender_type, text_content
- **Outgoing messages: FAIL** — Kommo does NOT send webhooks for agent replies

---

## [1.0.0] - 2026-03-10

**Status:** Released (MVP)

### Added

#### Core Features
- Express.js REST API server with TypeScript
- Kommo CRM webhook receiver (`POST /webhooks/kommo`)
- Message parser supporting text, image, video, file, voice, location, sticker
- Conversation upsert logic with deduplication by `kommo_chat_id`
- Write-ahead logging for webhook audit trail

#### API Endpoints
- `POST /webhooks/kommo` — Receive Kommo standard webhooks (public)
- `GET /health` — Server health check (public)
- `GET /api/conversations` — Query conversations with filters (protected)
- `GET /api/conversations/:id/messages` — Message history (protected)
- `GET /api/leads/:kommoLeadId/status` — Lead status check (protected)
- `GET /api/triggers/no-response?hours=24` — Unresponded leads (protected)
- `GET /api/triggers/no-followup?hours=48` — Unfollowed leads (protected)

#### Database Schema
- `conversations`, `messages`, `webhook_raw_log` tables
- Enum types: conversation_status, message_direction, sender_type, content_type, webhook_source

#### Security
- API key authentication via `x-api-key` header
- Timing-safe key comparison
- Helmet security middleware
- Environment variable validation with Zod
- Request body size limit (50KB)

#### Infrastructure
- Docker multi-stage build (Node 20 Alpine)
- Non-root user execution in container
- TypeScript strict mode
- ESM modules

---

## [Unreleased]

### Planned Features (Phase 2)
- Webhook retry logic with exponential backoff
- Performance monitoring and metrics

### Planned Features (Phase 3)
- Cursor-based pagination
- Full-text search on message content
- Advanced filtering

### Planned Features (Phase 4+)
- Analytics & reporting endpoints
- Sentiment analysis
- Rate limiting by API key

---

## Version History Summary

| Version | Release Date | Status | Phase |
|---------|--------------|--------|-------|
| 1.0.0 | 2026-03-10 | Released | MVP - Standard Webhooks Only |
| 1.1.0-phase-a | 2026-03-10 | Released | Phase A - Bidirectional Bridge |
| 1.1.0-phase-a2 | 2026-03-12 | Released | Phase A2 - Coexistence Support |
| 1.1.0-phase-a3 | 2026-03-13 | In Progress | Phase A3 - Chats API + Infra Improvements |
| 1.1.0 | Planned: 2026-04-15 | Backlog | Phase 2 - Enhancements |
| 1.2.0 | Planned: 2026-05-15 | Backlog | Phase 3 - Advanced Filtering |
| 2.0.0 | Planned: 2026-07-01 | Backlog | Phase 4 - Analytics |

---

## Breaking Changes Log

### Version 1.1.0-phase-a3
- Error response format changed: `{ error: string }` → `{ error: { code, message } }`
- New env vars: `LOG_LEVEL` (optional, default: `info`)

### Version 1.1.0-phase-a2
- `WHATSAPP_APP_SECRET` now required (was optional)

### Version 1.1.0-phase-a
- No breaking changes

### Version 1.0.0
- Initial release, no breaking changes

---

## Known Issues

| ID | Severity | Component | Status | Notes |
|----|----------|-----------|--------|-------|
| #001 | Medium | Testing | Resolved | Test coverage 66/66 passing |
| #002 | High | Database | Resolved | Composite indexes added (migration 006) |
| #003 | Low | Error Messages | Resolved | AppError class with structured responses |
| #004 | Low | Pagination | Open | Offset pagination only, no cursor support |
| #005 | High | Kommo API | Blocked | Chats API requires channel registration |
| #006 | Low | Code | Clarified | ChatAPI bridge is pre-built infrastructure |

---

## Document History

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-10 | 1.0 | Created initial changelog after MVP completion |
| 2026-03-10 | 1.1 | Updated with production deployment confirmation |
| 2026-03-11 | 1.2 | Phase 6 integration test results |
| 2026-03-10 | 1.3 | Phase A implementation complete |
| 2026-03-11 | 1.4 | Phase A2 implementation complete |
| 2026-03-12 | 1.5 | Phase A2 deployed to production |
| 2026-03-13 | 1.6 | Phase A3: Kommo investigation, API testing |
| 2026-03-13 | 1.7 | Phase A3: talks scope pivot to Chats API |
| 2026-03-13 | 1.8 | Phase A3: Pino logging, AppError, Chats API client, indexes, code review |

---

## Related Documentation

- [System Architecture](./system-architecture.md) — How components work together
- [Code Standards](./code-standards.md) — Development guidelines
- [API Documentation](./api-docs.md) — Endpoint reference
- [Development Roadmap](./development-roadmap.md) — Future plans
- [CLAUDE.md](../CLAUDE.md) — Project setup and commands
