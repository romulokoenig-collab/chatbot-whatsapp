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

**[System Architecture](./system-architecture.md)** (363 lines)
- Technology stack overview
- 8-layer architecture breakdown (Phase B + Phase A)
- How data flows through the system
- Webhook processing pipeline (3 paths: Kommo, ChatAPI, WhatsApp)
- Database schema (5 tables + enums)
- Security implementation (API auth + HMAC signatures)
- Performance targets and deployment strategy
- Error handling and observability

**[API Documentation](./api-docs.md)** (748 lines)
- All 9 API endpoints with full specs (Phase B + Phase A)
  - Kommo standard webhooks
  - Kommo ChatAPI webhooks + HMAC verification
  - WhatsApp Cloud API webhooks + signature verification
  - REST API endpoints
- Request/response examples with real payloads
- Query parameters and path variables
- Error codes and error handling
- Field reference (directions, types, content)
- Example workflows (3 real-world scenarios)
- Rate limiting guidelines
- Webhook timeout & performance specs

### Development Documentation

**[Code Standards](./code-standards.md)** (500+ lines)
- Directory structure (Phase B + Phase A files)
- File naming conventions (kebab-case)
- TypeScript strict mode configuration
- Naming conventions (camelCase, PascalCase, snake_case)
- Database reference conventions (snake_case)
- Code patterns:
  - Environment configuration (Zod validation)
  - Error handling with context logging
  - Timing-safe comparisons for secrets
  - HMAC signature verification (SHA1, SHA256)
  - Service pattern (business logic)
  - HTTP client pattern (external APIs)
  - Message mapping service (bidirectional tracking)
  - Middleware pattern
  - Type definitions
  - Route handlers
  - Testing standards (Vitest, Supertest)
- Checklists: code review, security, performance, documentation
- Common pitfalls to avoid

**[Development Roadmap](./development-roadmap.md)** (425+ lines)
- Project status overview (key metrics)
- Phase 1 (MVP) — COMPLETE ✓
  - Core webhook ingestion
  - REST API, database schema, security
  - Docker support, testing framework
- Phase A (Bidirectional Bridge) — COMPLETE ✓
  - ChatAPI + WhatsApp webhook handlers
  - HMAC-SHA1 & SHA256 signature verification
  - Message forwarding (bidirectional)
  - Message ID mapping service
  - External API clients
- Phase 2 (Future) — PLANNED
  - Enhanced filtering and pagination
  - Full-text search, performance optimizations
  - Database optimizations
- Phase 4 (Reporting) — PLANNED
  - Analytics endpoints
  - Dashboard summaries
  - Export capabilities
- Phase 5 (Advanced Features) — BACKLOG
  - Sentiment analysis
  - Auto-tagging
  - Rate limiting
  - Multi-channel support
- Known issues (4 tracked)
- Performance targets
- Release plan (v1.0.0 released, v1.1.0 next)
- Success metrics

**[Project Changelog](./project-changelog.md)** (318 lines)
- Version 1.0.0 (2024-03-10) — Released
  - 7 API endpoints
  - 3 database tables
  - Webhook receiver with write-ahead log
  - API key authentication
  - Docker multi-stage build
  - Vitest & Supertest setup
  - Complete documentation
- Unreleased features (v1.1.0, v1.2.0, 2.0.0)
- Known issues log
- Breaking changes document
- Migration guide template
- Dependency security notes

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
→ [Development Roadmap](./development-roadmap.md#phase-2-automation-triggers-current)

**"What changed in the last release?"**
→ [Project Changelog](./project-changelog.md#100---2024-03-10)

**"How do webhooks work?"**
→ [System Architecture](./system-architecture.md#webhook-processing-flow)

**"How is data stored?"**
→ [System Architecture](./system-architecture.md#data-layer)

**"What are the naming conventions?"**
→ [Code Standards](./code-standards.md#naming-conventions)

**"How do I add a new endpoint?"**
→ [Code Standards](./code-standards.md#add-a-new-api-endpoint) and [README.md](./README.md#add-a-new-api-endpoint)

**"What's the deployment process?"**
→ [System Architecture](./system-architecture.md#deployment) and [README.md](./README.md#deployment)

---

## Document Statistics

| Document | Lines | Topics | Type |
|----------|-------|--------|------|
| System Architecture | 395 | 8 sections | Technical |
| API Documentation | 478 | 7 endpoints | Reference |
| Code Standards | 424 | 9 sections | Guidelines |
| Development Roadmap | 342 | 5 phases | Planning |
| Project Changelog | 318 | Versions | Reference |
| README.md | 287 | 11 sections | Guide |
| Index.md | ~250 | Navigation | Guide |
| **Total** | **2,494** | **100+** | **7 files** |

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
- **Async Processing:** Respond to Kommo fast (< 100ms), process async after
- **Write-Ahead Log:** All webhooks logged before processing (no data loss)
- **Stateless:** Can scale horizontally with load balancing

### Security
- **API Key Auth:** x-api-key header with timing-safe comparison
- **Input Validation:** Zod schemas for env and requests
- **Error Messages:** Safe (don't expose internals)
- **Data Protection:** Helmet, CORS, body size limits

### Performance
- **Webhook Response:** < 100ms (respond before processing)
- **API Endpoints:** < 500ms (with database indexes)
- **Scalability:** Stateless + Supabase auto-scaling

### Data
- **3 Tables:** conversations, messages, webhook_raw_log
- **5 Enums:** status, direction, sender_type, content_type, source
- **Indexed Columns:** Optimized for queries

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

**Last Updated:** 2024-03-10
**Total Documentation:** 7 files, 2,494 lines
**Coverage:** 100% of current features
**Next Review:** End of Phase 2 (2024-03-20)
