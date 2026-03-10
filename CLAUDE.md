# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kommo WhatsApp Monitoring Backend** — A Node.js/TypeScript service that captures WhatsApp messages from Kommo CRM webhooks, stores them in Supabase, and exposes REST APIs for conversation querying and automation triggers.

**Key Purpose:** Enable real-time WhatsApp message monitoring, conversation tracking, and automated follow-up workflows via API.

### Tech Stack
- **Runtime:** Node.js 20 (TypeScript)
- **Database:** Supabase (PostgreSQL)
- **Framework:** Express.js
- **Deployment:** Docker (multi-stage build) → EasyPanel

### Core Capabilities
- Receives Kommo CRM webhooks for incoming/outgoing WhatsApp messages
- Stores messages with full context (sender type, content type, media URLs)
- Queries conversations with filtering (status, date range, contact ID, lead ID)
- Identifies stalled conversations (no-response, no-followup triggers)
- Fast async processing (responds to Kommo in < 100ms)
- Write-ahead audit logging (no data loss)

## Getting Started

### Setup & Commands

**Install dependencies:**
```bash
npm install
```

**Environment setup:**
```bash
cp .env.example .env
# Edit .env with your Supabase credentials and API_KEY
```

**Run in development:**
```bash
npm run dev
# Server runs on http://localhost:3000
```

**Build for production:**
```bash
npm run build
npm start
```

**Run tests:**
```bash
npm test                    # All tests
npm test -- --coverage      # With coverage report
npm test -- --watch        # Watch mode
```

**Lint TypeScript:**
```bash
npm run lint
```

**Docker build & run:**
```bash
docker build -t kommo-whatsapp .
docker run -p 3000:3000 \
  -e PORT=3000 \
  -e SUPABASE_URL="..." \
  -e SUPABASE_ANON_KEY="..." \
  -e SUPABASE_SERVICE_ROLE_KEY="..." \
  -e API_KEY="..." \
  kommo-whatsapp
```

### Project Structure

```
src/
├── server.ts                    # Entry point
├── app.ts                       # Express app
├── config/                      # Configuration
├── types/                       # TypeScript types
├── webhooks/                    # Kommo webhook handler
├── services/                    # Business logic
├── api/                         # Route handlers
├── middleware/                  # Express middleware
└── __tests__/                   # Unit & integration tests

supabase/migrations/            # SQL migrations
docs/                           # Project documentation
Dockerfile                      # Multi-stage Docker build
```

### Key Files

| File | Purpose |
|------|---------|
| `src/server.ts` | Starts Express app on PORT |
| `src/app.ts` | Registers routes and middleware |
| `src/webhooks/kommo-standard-handler.ts` | Parses Kommo webhooks |
| `src/services/trigger-service.ts` | Queries automation triggers |
| `src/middleware/api-auth-middleware.ts` | Validates x-api-key header |
| `.env.example` | Environment variable template |
| `supabase/migrations/` | Create tables, enums, indexes |

### API Endpoints Quick Reference

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /webhooks/kommo` | No | Receive Kommo webhooks |
| `GET /health` | No | Health check |
| `GET /api/conversations` | Yes | List conversations |
| `GET /api/conversations/:id/messages` | Yes | Message history |
| `GET /api/triggers/no-response?hours=24` | Yes | Unresponded leads |
| `GET /api/triggers/no-followup?hours=48` | Yes | Unfollowed leads |

See `docs/api-docs.md` for full details.

### Database Schema

**Tables:**
- `conversations` — Chat sessions (kommo_chat_id, contact_id, lead_id, status)
- `messages` — Individual messages (direction, sender_type, content_type, text, media_url)
- `webhook_raw_log` — Audit trail (source, status, payload, error_message)

**Enums:**
- `conversation_status`: active, closed
- `message_direction`: incoming, outgoing
- `sender_type`: customer, agent, bot, system
- `content_type`: text, image, video, file, voice, location, sticker

See `supabase/migrations/` for SQL.

### Important Notes

1. **Environment Variables Required:**
   - `SUPABASE_URL` — Supabase project URL
   - `SUPABASE_ANON_KEY` — Anon key (for migrations)
   - `SUPABASE_SERVICE_ROLE_KEY` — Service role key (full access)
   - `API_KEY` — Secret key for protected endpoints
   - `PORT` — Server port (default: 3000)

2. **Security:**
   - Never commit `.env` file
   - API keys use timing-safe comparison
   - Request body limited to 50KB
   - Helmet enables security headers

3. **Processing Flow:**
   - Webhook received → logged to `webhook_raw_log`
   - Response sent immediately (200 OK)
   - Messages parsed and stored asynchronously
   - Webhook marked as processed/error

4. **Error Handling:**
   - All errors logged to console
   - Webhook processing errors logged in `webhook_raw_log`
   - 500 errors include error message (safe for internal use)

## Documentation

Comprehensive documentation is in the `docs/` directory:

| Document | Purpose |
|----------|---------|
| `docs/system-architecture.md` | How components interact, data flow, deployment |
| `docs/api-docs.md` | All endpoints with examples, response formats |
| `docs/code-standards.md` | Naming conventions, patterns, testing, security |
| `docs/development-roadmap.md` | Phases, features, timeline, blockers |
| `docs/project-changelog.md` | Version history, breaking changes, releases |

Start with `docs/system-architecture.md` for an overview, then refer to specific docs as needed.

## Universal Development Guidelines

### Code Quality Standards
- Write clean, readable, and maintainable code
- Follow consistent naming conventions across the project
- Use meaningful variable and function names
- Keep functions focused and single-purpose
- Add comments for complex logic and business rules

### Git Workflow
- Use descriptive commit messages following conventional commits format
- Create feature branches for new development
- Keep commits atomic and focused on single changes
- Use pull requests for code review before merging
- Maintain a clean commit history

### Documentation
- Keep README.md files up to date
- Document public APIs and interfaces
- Include usage examples for complex features
- Maintain inline code documentation
- Update documentation when making changes

### Testing Approach
- Write tests for new features and bug fixes
- Maintain good test coverage
- Use descriptive test names that explain the expected behavior
- Organize tests logically by feature or module
- Run tests before committing changes

### Security Best Practices
- Never commit sensitive information (API keys, passwords, tokens)
- Use environment variables for configuration
- Validate input data and sanitize outputs
- Follow principle of least privilege
- Keep dependencies updated

## Project Structure Guidelines

### File Organization
- Group related files in logical directories
- Use consistent file and folder naming conventions
- Separate source code from configuration files
- Keep build artifacts out of version control
- Organize assets and resources appropriately

### Configuration Management
- Use configuration files for environment-specific settings
- Centralize configuration in dedicated files
- Use environment variables for sensitive or environment-specific data
- Document configuration options and their purposes
- Provide example configuration files

## Development Workflow

### Before Starting Work
1. Pull latest changes from main branch
2. Create a new feature branch
3. Review existing code and architecture
4. Plan the implementation approach

### During Development
1. Make incremental commits with clear messages
2. Run tests frequently to catch issues early
3. Follow established coding standards
4. Update documentation as needed

### Before Submitting
1. Run full test suite
2. Check code quality and formatting
3. Update documentation if necessary
4. Create clear pull request description

## Common Patterns

### Error Handling
- Use appropriate error handling mechanisms for the language
- Provide meaningful error messages
- Log errors appropriately for debugging
- Handle edge cases gracefully
- Don't expose sensitive information in error messages

### Performance Considerations
- Profile code for performance bottlenecks
- Optimize database queries and API calls
- Use caching where appropriate
- Consider memory usage and resource management
- Monitor and measure performance metrics

### Code Reusability
- Extract common functionality into reusable modules
- Use dependency injection for better testability
- Create utility functions for repeated operations
- Design interfaces for extensibility
- Follow DRY (Don't Repeat Yourself) principle

## Review Checklist

Before marking any task as complete:
- [ ] Code follows established conventions
- [ ] Tests are written and passing
- [ ] Documentation is updated
- [ ] Security considerations are addressed
- [ ] Performance impact is considered
- [ ] Code is reviewed for maintainability
