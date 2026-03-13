# Documentation - Kommo WhatsApp Backend

Welcome! This directory contains complete documentation for the Kommo WhatsApp Monitoring Backend project.

## Quick Navigation

### For Developers Starting Out
1. **Start Here:** [System Architecture](./system-architecture.md) — Overview of how everything works
2. **Then Read:** [Code Standards](./code-standards.md) — How to write code that fits this project
3. **Setup:** See `../CLAUDE.md` for environment setup and commands

### For API Integration
- **[API Documentation](./api-docs.md)** — All endpoints, request/response examples, authentication

### For Project Management
- **[Development Roadmap](./development-roadmap.md)** — Current phase, planned features, timeline
- **[Project Changelog](./project-changelog.md)** — What's been released, what's coming

### For Reference
- **[Code Standards](./code-standards.md)** — File structure, naming conventions, testing patterns, security checklist
- **[Codebase Summary](./codebase-summary.md)** — Quick overview of project structure and components

---

## Documentation Structure

```
docs/
├── README.md                          # This file
├── index.md                           # Full navigation guide
├── system-architecture.md             # Architecture overview & data flow
├── api-docs.md                        # API endpoints & examples
├── code-standards.md                  # Code patterns & guidelines
├── codebase-summary.md                # Component overview & structure
├── development-roadmap.md             # Phases & timeline
└── project-changelog.md               # Version history
```

## At a Glance

| Document | Audience | Read Time |
|----------|----------|-----------|
| System Architecture | Developers, Architects | 10 min |
| API Documentation | Integrators, Frontend Devs | 15 min |
| Code Standards | Backend Developers | 15 min |
| Codebase Summary | Everyone (overview) | 5 min |
| Development Roadmap | Project Managers, Leads | 10 min |
| Project Changelog | Everyone (reference) | 5 min |

---

## Key Concepts

### Architecture Layers

1. **Entry Point** (`src/server.ts`) — Loads config, starts Express with Pino logging
2. **Application** (`src/app.ts`) — Routes, middleware, global error handling
3. **Routes** (`src/api/`, `src/webhooks/`) — HTTP handlers with AppError throwing
4. **Services** (`src/services/`) — Business logic with structured logging
5. **Database** (Supabase) — PostgreSQL with audit logging and composite indexes

### Data Flow

```
Kommo Webhook
    ↓
POST /webhooks/kommo (fast response)
    ↓
Log to webhook_raw_log (write-ahead)
    ↓
Async: Parse → Upsert Conversation → Insert Message → Log completion
    ↓
Mark webhook as processed/error with Pino logger
```

### API Authentication

- **Public Endpoints:** `/webhooks/kommo`, `/health` (no auth)
- **Protected Endpoints:** `/api/*` (require `x-api-key` header)
- **Validation:** Timing-safe comparison prevents timing attacks

### Database Tables

- **conversations** — Chat sessions with metadata (Phase A3: added last_incoming_at, last_outgoing_at)
- **messages** — Individual messages (text, images, video, etc.)
- **webhook_raw_log** — Audit trail of all webhooks received
- **message_id_mapping** — WhatsApp ↔ Kommo ID tracking (Phase A3: added delivery_status)

### Logging & Error Handling

- **Pino Logger:** Structured JSON logs in production, pretty-printed in dev
- **Log Levels:** Configurable via `LOG_LEVEL` env var (default: info)
- **AppError Class:** Structured errors with `{error: {code, message}}` format
- **Safe Responses:** Stack traces only in non-production environments

---

## Common Tasks

### Add a New API Endpoint

1. Create route handler in `src/api/{name}-routes.ts`
2. Create service method in `src/services/{name}-service.ts`
3. Register route in `src/app.ts`
4. Add tests in `src/__tests__/{name}-routes.test.ts`
5. Document in `api-docs.md`
6. Use AppError for validation errors: `throw AppError.badRequest("message")`

See [Code Standards](./code-standards.md#route-handlers) for pattern.

### Query Conversations

```typescript
// Example: Get conversations for a specific lead
const conversations = await getConversations({
  lead_id: "222222",
  status: "active",
  limit: 50
});
```

See [API Documentation](./api-docs.md) for full endpoint reference.

### Monitor Webhook Processing

All webhooks are logged before processing. Check `webhook_raw_log` table:
- `status: pending` — Received, not yet processed
- `status: processed` — Successfully stored
- `status: error` — Processing failed (see error_message)

Check Pino logs in stdout/stderr for structured error details.

### Debug Issues

1. Check Pino JSON logs (structured logging in production, pretty-print in dev)
2. Query `webhook_raw_log` for raw payloads
3. Check `messages` and `conversations` tables for stored data
4. Verify `.env` file has all required variables
5. Check `LOG_LEVEL` env var for debugging (set to `debug` for verbose output)

---

## Development Workflow

### Before Starting Work

1. Read [Code Standards](./code-standards.md) for this project's patterns
2. Check [Development Roadmap](./development-roadmap.md) for context
3. Pull latest changes: `git pull origin main`

### During Development

1. Write tests first (TDD approach recommended)
2. Implement feature following patterns in Code Standards
3. Keep files under 200 lines
4. Use Pino logger, not console.log: `import { logger } from "../config/logger.js"`
5. Use AppError for validation: `throw AppError.badRequest("message")`
6. Run tests: `npm test`
7. Commit with clear message: `feat: add no-response trigger`

### Before Submitting

1. Run lint: `npm run lint`
2. Run tests: `npm test -- --coverage`
3. Verify no secrets in code
4. Verify no console.log/console.error calls (use Pino logger)
5. Update docs if needed
6. Create pull request

---

## Deployment

### Local Development
```bash
npm install
cp .env.example .env
# Edit .env with Supabase credentials and LOG_LEVEL (optional)
npm run dev
```

### Docker
```bash
docker build -t kommo-whatsapp .
docker run -p 3000:3000 -e LOG_LEVEL=info kommo-whatsapp
```

### EasyPanel (Production)
1. Build Docker image
2. Push to registry
3. Create new container on EasyPanel
4. Set environment variables (including LOG_LEVEL)
5. Configure health check: `GET /health`
6. Set port mapping (3000 → external)

---

## Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Webhook response | < 100ms | Respond before async processing |
| API endpoint | < 500ms | Query + serialize response |
| Message insert | < 50ms | Direct database write |
| Conversation query | < 200ms | Even with 1M+ records (with composite indexes) |
| Trigger queries | < 1000ms | Optimized with Phase A3 composite indexes |

---

## Security Checklist

Before deployment, ensure:
- [ ] All env vars in `.env`, not hardcoded
- [ ] API key validation enabled
- [ ] Helmet security headers active
- [ ] Request body size limited (50KB)
- [ ] Error messages don't expose internals (use AppError)
- [ ] No console.* calls in production code (use Pino logger)
- [ ] Docker runs as non-root user
- [ ] CORS configured appropriately
- [ ] Webhook signatures verified (HMAC-SHA1 for Kommo, X-Hub-Signature for WhatsApp)
- [ ] Stack traces not visible in production error responses

---

## Support & Questions

### Common Issues

**Q: Webhook not processing?**
- Check `webhook_raw_log` for errors
- Check Pino logs for structured error details with error code
- Verify `SUPABASE_SERVICE_ROLE_KEY` is valid
- Check `LOG_LEVEL=debug` for verbose output

**Q: API returns 401?**
- Verify `x-api-key` header is set
- Check header value matches `API_KEY` env var
- Check for extra spaces in header value

**Q: Database queries slow?**
- Check query complexity with `EXPLAIN ANALYZE`
- Verify indexes exist on filter columns
- Check for composite indexes on trigger columns
- Consider limiting result set

**Q: How do I use the logger?**
- Import: `import { logger } from "../config/logger.js"`
- Use: `logger.info({ data }, "[ModuleName] Message")`
- Levels: trace, debug, info, warn, error, fatal
- See [Code Standards](./code-standards.md#structured-logging-with-pino)

**Q: How do I handle errors in routes?**
- Use AppError: `throw AppError.badRequest("message")`
- Use `next(err)` to delegate to global error handler
- See [Code Standards](./code-standards.md#error-handling-with-apperror)

**Q: Can I add a new field to messages?**
- Add column to `messages` table via migration
- Update TypeScript types in `src/types/database-types.ts`
- Update message insertion in `message-service.ts`
- Update API response documentation in `api-docs.md`

---

## Document Maintenance

| Document | Last Updated | Status |
|----------|--------------|--------|
| system-architecture.md | 2026-03-13 | Phase A3 |
| api-docs.md | 2026-03-13 | Phase A3 |
| code-standards.md | 2026-03-13 | Phase A3 |
| codebase-summary.md | 2026-03-13 | Phase A3 |
| development-roadmap.md | 2026-03-12 | Phase A3 |
| project-changelog.md | 2026-03-12 | Phase A3 |

Update docs whenever you:
- Release a new version
- Add/remove API endpoints
- Change database schema
- Update code patterns
- Add new logging or error handling patterns

---

## Related Files

- `../CLAUDE.md` — Project setup, commands, environment
- `../package.json` — Dependencies, scripts
- `../Dockerfile` — Deployment configuration
- `../supabase/migrations/` — Database schema
- `../src/` — Source code (TypeScript)

---

## Questions?

Refer to the appropriate doc:
- **How does it work?** → [System Architecture](./system-architecture.md)
- **What APIs are available?** → [API Documentation](./api-docs.md)
- **How should I code?** → [Code Standards](./code-standards.md)
- **What's the structure?** → [Codebase Summary](./codebase-summary.md)
- **What's planned?** → [Development Roadmap](./development-roadmap.md)
- **What changed?** → [Project Changelog](./project-changelog.md)
- **Need navigation?** → [Index](./index.md)

Good luck, and happy coding!
