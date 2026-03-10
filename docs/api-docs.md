# API Documentation - Kommo WhatsApp Backend

## Base URL

```
http://localhost:3000                                    (development)
https://inicial-kommo-monitor.e8cf0x.easypanel.host     (production, EasyPanel)
```

## Authentication

All `/api/*` endpoints require the `x-api-key` header:

```bash
curl -H "x-api-key: your-secret-api-key" \
  https://api.example.com/api/conversations
```

**Public Endpoints** (no auth required):
- `POST /webhooks/kommo`
- `GET /health`

## Response Format

All responses are JSON:

```json
{
  "data": { ... },
  "error": "message (on errors only)"
}
```

### Success Response (200)

```json
{
  "data": [ ... ]
}
```

### Error Response (400/401/500)

```json
{
  "error": "descriptive error message"
}
```

---

## Endpoints

### 1. Webhook: Receive Kommo Message

**Endpoint:** `POST /webhooks/kommo`

**Authentication:** None (public)

**Purpose:** Receive Kommo CRM webhooks for incoming/outgoing WhatsApp messages.

**Kommo Webhook Format:**
```json
{
  "message": {
    "add": [
      {
        "id": "123456",
        "chat_id": "789012",
        "contact_id": "111111",
        "lead_id": "222222",
        "type": "incoming",
        "text": "Hello, this is a WhatsApp message",
        "created_at": 1678901234,
        "author": {
          "id": "333333",
          "type": "customer"
        },
        "attachment": null
      }
    ]
  }
}
```

**Response:**
```json
{
  "ok": true
}
```

**Status Code:** `200 OK` (always, to prevent Kommo retries)

**Processing:**
1. Save raw payload to `webhook_raw_log` (write-ahead)
2. Respond 200 immediately
3. Parse message asynchronously
4. Upsert conversation record
5. Insert message record
6. Mark webhook as `processed` or `error`

**Payload Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| message.add | array | Yes | Array of incoming/outgoing messages |
| id | string | Yes | Unique message ID (Kommo) |
| chat_id | string | Yes | Kommo chat ID (links messages to conversation) |
| contact_id | string | No | Kommo contact ID |
| lead_id | string | No | Kommo lead ID |
| type | string | Yes | "incoming" or "outgoing" |
| text | string | No | Message text content |
| created_at | number | Yes | Unix timestamp (seconds) |
| author | object | No | {id, type} — type: "customer", "agent", "bot", "system" |
| attachment | object | No | {type, url} — type: image, video, file, voice, location, sticker |

---

### 2. Health Check

**Endpoint:** `GET /health`

**Authentication:** None (public)

**Purpose:** Verify server is running.

**Response:**
```json
{
  "status": "ok"
}
```

**Status Code:** `200 OK`

**Use Case:** Docker health checks, uptime monitoring

---

### 3. List Conversations

**Endpoint:** `GET /api/conversations`

**Authentication:** Required (`x-api-key` header)

**Purpose:** Query all conversations with optional filters.

**Query Parameters:**

| Param | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| status | string | No | - | Filter: "active" or "closed" |
| contact_id | string | No | - | Filter by Kommo contact ID |
| lead_id | string | No | - | Filter by Kommo lead ID |
| kommo_chat_id | string | No | - | Filter by exact chat ID |
| start_date | ISO string | No | - | Filter: created >= this date |
| end_date | ISO string | No | - | Filter: created <= this date |
| limit | number | No | 100 | Max results (1-1000) |
| offset | number | No | 0 | Pagination offset |

**Example Request:**
```bash
curl -H "x-api-key: secret-key" \
  "https://api.example.com/api/conversations?status=active&limit=50"
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "kommo_chat_id": "789012",
      "contact_id": "111111",
      "lead_id": "222222",
      "status": "active",
      "last_message_at": "2024-03-10T15:30:00Z",
      "created_at": "2024-03-10T10:00:00Z"
    }
  ],
  "count": 1,
  "total": 150
}
```

**Status Code:** `200 OK` | `401 Unauthorized` | `500 Server Error`

---

### 4. Get Conversation Message History

**Endpoint:** `GET /api/conversations/:id/messages`

**Authentication:** Required (`x-api-key` header)

**Purpose:** Fetch all messages for a specific conversation.

**Path Parameters:**

| Param | Type | Notes |
|-------|------|-------|
| id | UUID | Conversation ID from list endpoint |

**Query Parameters:**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| limit | number | 100 | Max messages (1-1000) |
| offset | number | 0 | Pagination offset |

**Example Request:**
```bash
curl -H "x-api-key: secret-key" \
  "https://api.example.com/api/conversations/550e8400-e29b-41d4-a716-446655440000/messages"
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "conversation_id": "uuid",
      "kommo_message_id": "123456",
      "direction": "incoming",
      "sender_type": "customer",
      "content_type": "text",
      "text_content": "Hello, is anyone there?",
      "media_url": null,
      "created_at": "2024-03-10T15:30:00Z"
    },
    {
      "id": "uuid",
      "conversation_id": "uuid",
      "kommo_message_id": "123457",
      "direction": "outgoing",
      "sender_type": "agent",
      "content_type": "text",
      "text_content": "Hi! How can I help?",
      "media_url": null,
      "created_at": "2024-03-10T15:31:00Z"
    }
  ],
  "count": 2,
  "total": 25
}
```

**Status Code:** `200 OK` | `401 Unauthorized` | `404 Not Found` | `500 Server Error`

---

### 5. Get Lead Response Status

**Endpoint:** `GET /api/leads/:kommoLeadId/status`

**Authentication:** Required (`x-api-key` header)

**Purpose:** Check if a Kommo lead has active conversations and their status.

**Path Parameters:**

| Param | Type | Notes |
|-------|------|-------|
| kommoLeadId | string | Kommo lead ID |

**Example Request:**
```bash
curl -H "x-api-key: secret-key" \
  "https://api.example.com/api/leads/222222/status"
```

**Response:**
```json
{
  "data": {
    "lead_id": "222222",
    "active_conversations": 1,
    "total_conversations": 3,
    "last_message_at": "2024-03-10T15:30:00Z",
    "last_message_direction": "incoming",
    "status": "waiting_for_response"
  }
}
```

**Status:** Values
- `waiting_for_response` — Last message is incoming, no agent response yet
- `waiting_for_followup` — Last message is outgoing, no customer reply yet
- `closed` — Conversation marked as closed

**Status Code:** `200 OK` | `401 Unauthorized` | `404 Not Found` | `500 Server Error`

---

### 6. Get Unresponded Leads (No Response Trigger)

**Endpoint:** `GET /api/triggers/no-response`

**Authentication:** Required (`x-api-key` header)

**Purpose:** Identify leads waiting for agent response (automation trigger).

**Query Parameters:**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| hours | number | 24 | Find conversations with no agent response in past N hours |

**Example Request:**
```bash
curl -H "x-api-key: secret-key" \
  "https://api.example.com/api/triggers/no-response?hours=2"
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "kommo_chat_id": "789012",
      "contact_id": "111111",
      "lead_id": "222222",
      "status": "active",
      "last_message_at": "2024-03-10T13:30:00Z",
      "last_message_text": "Are you there?",
      "hours_waiting": 1.5
    }
  ],
  "count": 3,
  "hours": 24
}
```

**Use Case:**
- Trigger automated reminders to agents
- Alert team members to inactive conversations
- Queue conversations by wait time

**Status Code:** `200 OK` | `400 Bad Request` | `401 Unauthorized` | `500 Server Error`

**Error Cases:**
```json
{
  "error": "hours must be a non-negative number"
}
```

---

### 7. Get Unfollowed Leads (No Follow-up Trigger)

**Endpoint:** `GET /api/triggers/no-followup`

**Authentication:** Required (`x-api-key` header)

**Purpose:** Identify leads waiting for customer follow-up after agent message.

**Query Parameters:**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| hours | number | 48 | Find conversations with no customer reply in past N hours |

**Example Request:**
```bash
curl -H "x-api-key: secret-key" \
  "https://api.example.com/api/triggers/no-followup?hours=48"
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "kommo_chat_id": "789012",
      "contact_id": "111111",
      "lead_id": "222222",
      "status": "active",
      "last_message_at": "2024-03-08T10:00:00Z",
      "last_message_text": "Let me know if you're interested",
      "hours_waiting": 47
    }
  ],
  "count": 5,
  "hours": 48
}
```

**Use Case:**
- Trigger automated follow-up messages
- Identify cold leads (no response for days)
- Re-engagement campaigns

**Status Code:** `200 OK` | `400 Bad Request` | `401 Unauthorized` | `500 Server Error`

---

## Error Codes

| Status | Reason | Example |
|--------|--------|---------|
| 200 | Success | Data returned |
| 400 | Bad Request | Invalid query parameters |
| 401 | Unauthorized | Missing or invalid API key |
| 404 | Not Found | Conversation/lead doesn't exist |
| 500 | Server Error | Database or processing error |

---

## Rate Limiting & Quotas

Currently **no rate limiting** is implemented. In production:
- Consider implementing per-API-key rate limits
- Recommend clients: max 100 requests/minute
- Large queries (limit > 500): use pagination

---

## Field Reference

### Message Direction

- `incoming` — Message from customer (WhatsApp user)
- `outgoing` — Message from agent or bot (Kommo user)

### Sender Type

- `customer` — End user (WhatsApp contact)
- `agent` — Human team member in Kommo
- `bot` — Automated response (Kommo automation)
- `system` — System-generated message

### Content Type

- `text` — Plain text message
- `image` — Photo/image file
- `video` — Video file
- `file` — Document or other file
- `voice` — Audio message
- `location` — Geographic location
- `sticker` — WhatsApp sticker

### Conversation Status

- `active` — Open, ongoing conversation
- `closed` — Archived or resolved

---

## Example Workflows

### Workflow 1: Monitor Unresponded Leads

```bash
# Every 5 minutes, check for leads waiting > 15 min
curl -H "x-api-key: key" \
  "https://api.example.com/api/triggers/no-response?hours=0.25"

# If count > 0, trigger notification or automation
if [ $count -gt 0 ]; then
  send_slack_alert "Leads waiting: $count"
fi
```

### Workflow 2: Get Full Conversation Context

```bash
# List active conversations
curl -H "x-api-key: key" \
  "https://api.example.com/api/conversations?status=active"

# For each conversation, fetch message history
for convo_id in $CONVERSATION_IDS; do
  curl -H "x-api-key: key" \
    "https://api.example.com/api/conversations/$convo_id/messages"
done
```

### Workflow 3: Lead Status Dashboard

```bash
# Get status for specific lead
curl -H "x-api-key: key" \
  "https://api.example.com/api/leads/222222/status"

# Response includes last message direction → display "Waiting for agent" or "Waiting for customer"
```

---

## Webhook Payload Examples

### Incoming Text Message

```json
{
  "message": {
    "add": [
      {
        "id": "msg_001",
        "chat_id": "chat_789",
        "contact_id": "contact_111",
        "lead_id": "lead_222",
        "type": "incoming",
        "text": "Hi, I'm interested in your product",
        "created_at": 1678901234,
        "author": {
          "id": "whatsapp_user_123",
          "type": "customer"
        },
        "attachment": null
      }
    ]
  }
}
```

### Outgoing Image Message

```json
{
  "message": {
    "add": [
      {
        "id": "msg_002",
        "chat_id": "chat_789",
        "contact_id": "contact_111",
        "lead_id": "lead_222",
        "type": "outgoing",
        "text": null,
        "created_at": 1678901300,
        "author": {
          "id": "agent_555",
          "type": "agent"
        },
        "attachment": {
          "type": "image",
          "url": "https://kommo.s3.example.com/image.jpg"
        }
      }
    ]
  }
}
```

### Multiple Messages in Single Webhook

```json
{
  "message": {
    "add": [
      { /* message 1 */ },
      { /* message 2 */ },
      { /* message 3 */ }
    ]
  }
}
```

All messages in a single webhook batch are processed together.

---

## Timeout & Performance

- **Webhook response time**: < 100ms (responds before processing)
- **API endpoint latency**: 100-500ms typical (depends on query complexity)
- **Database timeout**: 30 seconds per query
- **Max payload size**: 50KB (Kommo webhooks typically < 10KB)

---

## Related Documentation

- [System Architecture](./system-architecture.md) — How components interact
- [Code Standards](./code-standards.md) — Implementation patterns
- [Development Roadmap](./development-roadmap.md) — Future features
