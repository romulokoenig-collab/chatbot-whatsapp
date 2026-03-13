# Kommo WhatsApp Backend - Documentation Index

## Quick Start (5 minutes)

New to the project? Start here:

1. **Read This First:** [System Architecture](./system-architecture.md) — Understand how the system works (10 min)
2. **Setup:** Follow commands in [CLAUDE.md](../CLAUDE.md#getting-started) at project root (5 min)
3. **Make Changes:** Reference [Code Standards](./code-standards.md) when coding (ongoing)

## Documentation by Role

### I'm a Backend Developer
- Start: [Code Standards](./code-standards.md) — File structure, patterns, testing
- Reference: [System Architecture](./system-architecture.md) — How components interact
- When coding: [Code Standards](./code-standards.md#code-patterns) — Patterns and examples
- Setup: [CLAUDE.md](../CLAUDE.md#getting-started) — Commands and environment

### I'm Integrating an API
- Start: [API Documentation](./api-docs.md) — All endpoints with examples
- Reference: [System Architecture](./system-architecture.md#webhook-processing-flow) — How webhooks work
- Examples: [API Documentation](./api-docs.md#example-workflows) — Real workflow examples

### I'm Managing the Project
- Start: [Development Roadmap](./development-roadmap.md) — Phases and timeline
- Monitor: [Project Changelog](./project-changelog.md) — What's been released
- Status: [Development Roadmap](./development-roadmap.md#project-status-overview) — Current metrics

### I'm Reviewing Code
- Reference: [Code Standards](./code-standards.md#code-review-checklist) — What to check
- Architecture: [System Architecture](./system-architecture.md) — Design principles
- Tests: [Code Standards](./code-standards.md#testing-standards) — Test expectations

### I'm New to the Company
- Start: [System Architecture](./system-architecture.md) — Full overview
- Then: [Development Roadmap](./development-roadmap.md) — Project status
- Finally: [Code Standards](./code-standards.md) — How we work
- Setup: [CLAUDE.md](../CLAUDE.md) — Your development environment

---

## All Documents

### System Documentation

**[System Architecture](./system-architecture.md)** (445 lines)
- Technology stack overview with Pino logging
- 9-layer architecture breakdown (Phase B + Phase A + Phase A3)
- How data flows through the system
- Webhook processing pipeline (3 paths: Kommo, ChatAPI, WhatsApp)
- Database schema with composite indexes
- Security implementation (API auth + HMAC signatures)
- Performance targets and deployment strategy
- Error handling with AppError class and Pino logger
- Observability with structured JSON logs

**[API Documentation](./api-docs.md)** (745 lines)
- All 9 API endpoints with full specs (Phase B + Phase A)
  - Kommo standard webhooks
  - Kommo ChatAPI webhooks + HMAC verification
  - WhatsApp Cloud API webhooks + signature verification
  - REST API endpoints
- Request/response examples with real payloads
- Query parameters and path variables
- Structured error codes with code + message fields
- Field reference (directions, types, content)
- Example workflows (3 real-world scenarios)
- Rate limiting guidelines
- Webhook timeout & performance specs

### Development Documentation

**[Code Standards](./code-standards.md)** (600+ lines)
- Directory structure (Phase A3 files included)
- File naming conventions (kebab-case)
- TypeScript strict mode configuration
- Naming conventions (camelCase, PascalCase, snake_case)
- Database reference conventions (snake_case)
- Code patterns:
  - Environment configuration (Zod validation)
  - Structured logging with Pino (object-first pattern)
  - Error handling with AppError class
  - Timing-safe comparisons for secrets
  - HMAC signature verification (SHA1, SHA256)
  - Kommo Chat History API client (Phase A3)
  - Service pattern (business logic)
  - HTTP client pattern (external APIs)
  - Message mapping service (bidirectional tracking)
  - Middleware pattern
  - Type definitions
  - Route handlers
  - Testing standards (Vitest, Supertest)
- Checklists: code review, security, performance, documentation
- Common pitfalls to avoid (12 items)

**[Development Roadmap](./development-roadmap.md)** (425+ lines)
- Project status overview (key metrics)
- Phase A3 (Current) — Structured logging, AppError, Chat History API
- Phase 2 (Future) — Planned features
- Known issues (tracked)
- Performance targets
- Release plan
- Success metrics

**[Project Changelog](./project-changelog.md)** (318 lines)
- Version 1.1.0-phase-a3 (Current)
  - Pino structured logging (JSON + pretty-print)
  - AppError class for structured responses
  - Kommo Chat History API client with HMAC-SHA1
  - Composite indexes for trigger optimization
  - 15+ files refactored for logging
- Version 1.1.0-phase-a2 (Released)
  - Message echo support with phone normalization
- Version 1.0.0 (Released)
  - Core webhook ingestion
- Unreleased features (v1.2.0, 2.0.0)
- Known issues log
- Breaking changes document
- Dependency security notes

**[Codebase Summary](./codebase-summary.md)** (380 lines)
- Quick overview of version 1.1.0-phase-a3
- Complete directory structure
- Core components and services
- Technology stack with versions
- Development scripts
- Security features
- Performance characteristics
- Docker build setup
- Deployment instructions
- Testing strategy
- Environment variables
- Known limitations
- Phase A3 details (logging, errors, Chat History API)

### Navigation

**[README.md](./README.md)** (287 lines)
- Quick navigation by audience
- Key concepts overview
- Common tasks with examples
- Development workflow
- Deployment instructions
- Performance targets and security checklist
- FAQ for common issues

**[Index.md](./index.md)** — This file
- Quick start paths
- Documentation by role
- Complete document listing
- Search and reference guide

---

## Find What You Need

### By Task

**"How do I set up my development environment?"**
→ [CLAUDE.md](../CLAUDE.md#getting-started)

**"What APIs are available?"**
→ [API Documentation](./api-docs.md)

**"How should I structure my code?"**
→ [Code Standards](./code-standards.md#file-organization)

**"What testing is required?"**
→ [Code Standards](./code-standards.md#testing-standards)

**"How do I secure my code?"**
→ [Code Standards](./code-standards.md#security-checklist)

**"What features are planned?"**
→ [Development Roadmap](./development-roadmap.md#phase-2-future)

**"What changed in the last release?"**
→ [Project Changelog](./project-changelog.md)

**"How do webhooks work?"**
→ [System Architecture](./system-architecture.md#webhook-processing-flow)

**"How is data stored?"**
→ [System Architecture](./system-architecture.md#data-layer)

**"What are the naming conventions?"**
→ [Code Standards](./code-standards.md#naming-conventions)

**"How do I add a new endpoint?"**
→ [Code Standards](./code-standards.md#route-handlers) and [README.md](./README.md#add-a-new-api-endpoint)

**"What's the deployment process?"**
→ [System Architecture](./system-architecture.md#deployment) and [README.md](./README.md#deployment)

**"How do I use the logger?"**
→ [Code Standards](./code-standards.md#structured-logging-with-pino)

**"How do I handle errors?"**
→ [Code Standards](./code-standards.md#error-handling-with-apperror)

---

## Document Statistics

| Document | Lines | Topics | Type |
|----------|-------|--------|------|
| System Architecture | 445 | 9 sections | Technical |
| API Documentation | 745 | 9 endpoints | Reference |
| Code Standards | 600+ | 12 sections | Guidelines |
| Development Roadmap | 425+ | 5 phases | Planning |
| Project Changelog | 318 | Versions | Reference |
| Codebase Summary | 380 | Components | Overview |
| README.md | 287 | 11 sections | Guide |
| Index.md | ~280 | Navigation | Guide |
| **Total** | **3,480+** | **100+** | **8 files** |

---

## How Documentation is Organized

### By Audience
- **Developers:** Code Standards, System Architecture, API Docs
- **Architects:** System Architecture, Development Roadmap
- **Project Leads:** Development Roadmap, Project Changelog
- **Integrators:** API Documentation, System Architecture
- **New Team Members:** README.md, System Architecture, Code Standards

### By Type
- **Technical Specs:** System Architecture, API Documentation
- **Implementation Guides:** Code Standards, Development Roadmap
- **Reference:** Code Standards, API Documentation, Project Changelog
- **Navigation:** README.md, Index.md, CLAUDE.md

### By Depth
- **5-minute overview:** README.md Quick Navigation
- **10-minute intro:** System Architecture overview
- **20-minute deep dive:** Code Standards or API Documentation
- **30-minute reference:** Any complete document

---

## Key Concepts at a Glance

### Architecture
- **Layers:** Entry → App → Routes → Services → Database
- **Async Processing:** Respond to webhooks fast (< 100ms), process async after
- **Write-Ahead Log:** All webhooks logged before processing (no data loss)
- **Stateless:** Can scale horizontally with load balancing

### Logging
- **Pino Logger:** Structured JSON logs (production) + pretty-print (dev)
- **Log Levels:** Configurable via `LOG_LEVEL` env var (default: info)
- **Object-First:** `logger.info({ data }, "message")` pattern
- **Replaces Console:** All console.log/error calls replaced with Pino

### Error Handling
- **AppError Class:** Structured errors with code + message fields
- **Structured Responses:** `{error: {code, message}}` format
- **Safe Details:** Stack traces only in non-production
- **Route Delegation:** Use `next(err)` to delegate to error handler

### Security
- **API Key Auth:** x-api-key header with timing-safe comparison
- **Input Validation:** Zod schemas for env and requests
- **Error Messages:** Safe (don't expose internals)
- **Data Protection:** Helmet, CORS, body size limits

### Performance
- **Webhook Response:** < 100ms (respond before processing)
- **API Endpoints:** < 500ms (with database indexes)
- **Scalability:** Stateless + Supabase auto-scaling
- **Composite Indexes:** Optimized trigger queries

### Data
- **4 Tables:** conversations, messages, webhook_raw_log, message_id_mapping
- **5 Enums:** status, direction, sender_type, content_type, source
- **Indexed Columns:** Optimized for queries
- **Composite Indexes:** Phase A3 optimization

---

## Keeping Documentation Updated

Documentation is updated when:
- New features are released (update Roadmap + Changelog)
- Code patterns change (update Code Standards)
- API endpoints change (update API Docs)
- Architecture evolves (update System Architecture)

See specific documents for "Last Updated" dates.

---

## Need Help?

### Documentation isn't clear?
- Check [README.md](./README.md#support--questions) for FAQ
- Reference [Code Standards](./code-standards.md) for examples
- Ask in team chat with specific question

### Something is missing?
- Check if it's in the Roadmap (might be planned)
- Note the gap
- Create issue or discuss with team lead

### Found an error?
- Update the document
- Or report to documentation maintainer

---

## Related Files at Project Root

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project setup, commands, quick reference |
| `package.json` | Dependencies, build scripts |
| `tsconfig.json` | TypeScript configuration |
| `Dockerfile` | Production deployment |
| `.env.example` | Environment variable template |
| `supabase/migrations/` | Database schema (SQL) |
| `src/` | Source code (TypeScript) |

---

## Quick Reference: File Locations

```
project-root/
├── CLAUDE.md                          # Setup & quick start
├── package.json                       # Dependencies
├── src/                               # Source code
├── supabase/migrations/               # Database schema
├── Dockerfile                         # Deployment config
└── docs/                              # You are here
    ├── index.md                       # This file
    ├── README.md                      # Navigation hub
    ├── system-architecture.md         # Technical design
    ├── api-docs.md                    # Endpoint reference
    ├── code-standards.md              # Development guide
    ├── codebase-summary.md            # Component overview
    ├── development-roadmap.md         # Project plan
    └── project-changelog.md           # Release history
```

---

## Navigation Tips

1. **Start with README.md** if you're new — it has quick navigation
2. **Use Ctrl+F** to search within any document for keywords
3. **Check tables of contents** at the top of each doc
4. **Follow links** between documents for related topics
5. **Reference the index** (this file) when lost

---

**Last Updated:** 2026-03-13
**Total Documentation:** 8 files, 3,480+ lines
**Coverage:** 100% of current features (Phase A3)
**Next Review:** End of Phase A3 (Kommo support confirmation)
