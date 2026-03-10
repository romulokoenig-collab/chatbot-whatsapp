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

---

## Documentation Structure

```
docs/
├── README.md                          # This file
├── system-architecture.md             # Architecture overview & data flow
├── api-docs.md                        # API endpoints & examples
├── code-standards.md                  # Code patterns & guidelines
├── development-roadmap.md             # Phases & timeline
└── project-changelog.md               # Version history
```

## At a Glance

| Document | Audience | Read Time |
|----------|----------|-----------|
| System Architecture | Developers, Architects | 10 min |
| API Documentation | Integrators, Frontend Devs | 15 min |
| Code Standards | Backend Developers | 15 min |
| Development Roadmap | Project Managers, Leads | 10 min |
| Project Changelog | Everyone (reference) | 5 min |

---

## Key Concepts

### Architecture Layers

1. **Entry Point** (`src/server.ts`) — Loads config, starts Express
2. **Application** (`src/app.ts`) — Routes, middleware, error handling
3. **Routes** (`src/api/`, `src/webhooks/`) — HTTP handlers
4. **Services** (`src/services/`) — Business logic
5. **Database** (Supabase) — PostgreSQL with audit logging

### Data Flow

```
Kommo Webhook
    ↓
POST /webhooks/kommo (fast response)
    ↓
Log to webhook_raw_log
    ↓
Async: Parse → Upsert Conversation → Insert Message
    ↓
Mark webhook as processed/error
```

### API Authentication

- **Public Endpoints:** `/webhooks/kommo`, `/health` (no auth)
- **Protected Endpoints:** `/api/*` (require `x-api-key` header)
- **Validation:** Timing-safe comparison prevents timing attacks

### Database Tables

- **conversations** — Chat sessions with metadata
- **messages** — Individual messages (text, images, video, etc.)
- **webhook_raw_log** — Audit trail of all webhooks received

---

## Common Tasks

### Add a New API Endpoint

1. Create route handler in `src/api/{name}-routes.ts`
2. Create service method in `src/services/{name}-service.ts`
3. Register route in `src/app.ts`
4. Add tests in `src/__tests__/{name}-routes.test.ts`
5. Document in `api-docs.md`

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

### Debug Issues

1. Check `console.error` logs (prefix: `[ModuleName]`)
2. Query `webhook_raw_log` for raw payloads
3. Check `messages` and `conversations` tables for stored data
4. Verify `.env` file has all required variables

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
4. Run tests: `npm test`
5. Commit with clear message: `feat: add no-response trigger`

### Before Submitting

1. Run lint: `npm run lint`
2. Run tests: `npm test -- --coverage`
3. Verify no secrets in code
4. Update docs if needed
5. Create pull request

---

## Deployment

### Local Development
```bash
npm install
cp .env.example .env
# Edit .env with Supabase credentials
npm run dev
```

### Docker
```bash
docker build -t kommo-whatsapp .
docker run -p 3000:3000 -e ... kommo-whatsapp
```

### EasyPanel (Production)
1. Build Docker image
2. Push to registry
3. Create new container on EasyPanel
4. Set environment variables
5. Configure health check: `GET /health`
6. Set port mapping (3000 → external)

---

## Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Webhook response | < 100ms | Respond before async processing |
| API endpoint | < 500ms | Query + serialize response |
| Message insert | < 50ms | Direct database write |
| Conversation query | < 200ms | Even with 1M+ records (with indexes) |

---

## Security Checklist

Before deployment, ensure:
- [ ] All env vars in `.env`, not hardcoded
- [ ] API key validation enabled
- [ ] Helmet security headers active
- [ ] Request body size limited (50KB)
- [ ] Error messages don't expose internals
- [ ] No console.log in production code
- [ ] Docker runs as non-root user
- [ ] CORS configured appropriately

---

## Support & Questions

### Common Issues

**Q: Webhook not processing?**
- Check `webhook_raw_log` for errors
- Verify `SUPABASE_SERVICE_ROLE_KEY` is valid
- Check server logs for parsing errors

**Q: API returns 401?**
- Verify `x-api-key` header is set
- Check header value matches `API_KEY` env var
- Check for extra spaces in header value

**Q: Database queries slow?**
- Check query complexity with `EXPLAIN ANALYZE`
- Verify indexes exist on filter columns
- Consider limiting result set

**Q: Can I add a new field to messages?**
- Add column to `messages` table via migration
- Update TypeScript types in `src/types/database-types.ts`
- Update message insertion in `message-service.ts`
- Update API response documentation

---

## Document Maintenance

| Document | Last Updated | Reviewer |
|----------|--------------|----------|
| system-architecture.md | 2024-03-10 | - |
| api-docs.md | 2024-03-10 | - |
| code-standards.md | 2024-03-10 | - |
| development-roadmap.md | 2024-03-10 | - |
| project-changelog.md | 2024-03-10 | - |

Update docs whenever you:
- Release a new version
- Add/remove API endpoints
- Change database schema
- Update code patterns

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
- **How does it work?** → System Architecture
- **What APIs are available?** → API Documentation
- **How should I code?** → Code Standards
- **What's planned?** → Development Roadmap
- **What changed?** → Project Changelog

Good luck, and happy coding!
