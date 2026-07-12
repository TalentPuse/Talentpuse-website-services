# Interview Agent - API Specification

## Base URL
```
/api/interview
```

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

---

## Endpoints

### 1. Create Interview Session

**Endpoint:** `POST /api/interview/sessions`

Create a new interview practice session.

**Request Body:**
```json
{
  "mode": "tech" | "behavioral",
  "target_role": "string (optional)",
  "num_questions": 5,
  "time_limit_seconds": 600 (optional)
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "mode": "tech",
  "status": "created",
  "created_at": "2025-05-30T10:00:00Z"
}
```

**Example:**
```bash
curl -X POST https://api.talentpuse.io.vn/api/interview/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "tech",
    "target_role": "Senior Backend Engineer",
    "num_questions": 5
  }'
```

---

### 2. List Interview Sessions

**Endpoint:** `GET /api/interview/sessions`

Get all interview sessions for the authenticated user.

**Query Parameters:**
- `mode` (optional): Filter by mode (`tech`, `behavioral`)
- `limit` (optional): Number of sessions (default 20, max 100)
- `offset` (optional): Pagination offset (default 0)

**Response (200):**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "mode": "tech",
      "status": "completed",
      "target_role": "Senior Backend Engineer",
      "question_count": 5,
      "overall_score": 4.2,
      "created_at": "2025-05-30T10:00:00Z",
      "updated_at": "2025-05-30T10:45:00Z"
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

---

### 3. Get Session Details

**Endpoint:** `GET /api/interview/sessions/{session_id}`

Get detailed information about a specific session.

**Path Parameters:**
- `session_id`: UUID of the session

**Response (200):**
```json
{
  "id": "uuid",
  "mode": "tech",
  "status": "completed",
  "target_role": "Senior Backend Engineer",
  "question_count": 5,
  "overall_score": 4.2,
  "overall_feedback": "Strong technical skills demonstrated...",
  "created_at": "2025-05-30T10:00:00Z",
  "updated_at": "2025-05-30T10:45:00Z"
}
```

**Error Responses:**
- `404` - Session not found or doesn't belong to user
- `401` - Invalid or missing authentication

---

### 4. Send Message (Chat) - SSE Streaming

**Endpoint:** `POST /api/interview/sessions/{session_id}/messages`

Send a message to the interviewer and stream the AI response.

**Path Parameters:**
- `session_id`: UUID of the session

**Request Body:**
```json
{
  "content": "My answer to the question..."
}
```

**Response:** Server-Sent Events (SSE) stream

**Event Types:**
```typescript
// User message confirmation
{
  "type": "user_message",
  "message": {
    "id": "uuid",
    "role": "user",
    "content": "My answer...",
    "timestamp": "2025-05-30T10:01:00Z"
  }
}

// Streaming token
{
  "type": "token",
  "content": "That's a great"
}

// Final assistant message saved
{
  "type": "done",
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "That's a great answer...",
    "timestamp": "2025-05-30T10:01:05Z"
  }
}

// Error occurred
{
  "type": "error",
  "message": "Failed to connect to LLM service"
}
```

**Example JavaScript:**
```javascript
const response = await fetch(`/api/interview/sessions/${sessionId}/messages`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ content: answerText }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const event = JSON.parse(line.slice(6));
      
      if (event.type === 'token') {
        // Append token to chat display
        appendMessage(event.content);
      } else if (event.type === 'done') {
        // Replace temp message with final saved version
        finalizeMessage(event.message);
      }
    }
  }
}
```

---

### 5. Get Message History

**Endpoint:** `GET /api/interview/sessions/{session_id}/messages`

Get chat history for a session (useful for reconnection).

**Path Parameters:**
- `session_id`: UUID of the session

**Query Parameters:**
- `limit` (optional): Number of messages (default 50, max 200)

**Response (200):**
```json
{
  "messages": [
    {
      "id": "uuid",
      "role": "assistant",
      "content": "Hello! I'm your technical interviewer...",
      "timestamp": "2025-05-30T10:00:05Z"
    },
    {
      "id": "uuid",
      "role": "user",
      "content": "My answer...",
      "timestamp": "2025-05-30T10:01:00Z"
    }
  ],
  "total": 10
}
```

---

### 6. Complete Session & Get Summary

**Endpoint:** `POST /api/interview/sessions/{session_id}/complete`

Mark session as complete and generate evaluation summary.

**Path Parameters:**
- `session_id`: UUID of the session

**Response (200):**
```json
{
  "session_id": "uuid",
  "mode": "tech",
  "overall_score": 4.2,
  "overall_feedback": "Strong technical foundation demonstrated...",
  "strengths": [
    "Clear problem decomposition",
    "Good consideration of edge cases",
    "Solid database design knowledge"
  ],
  "improvements": [
    "Consider mentioning more specific technologies",
    "Could elaborate on scalability trade-offs",
    "Practice more system design communication"
  ],
  "improvement_plan": "Focus on: 1) Studying distributed patterns...",
  "question_count": 5,
  "completed_at": "2025-05-30T10:45:00Z"
}
```

**Error Responses:**
- `400` - Session already completed or invalid state
- `404` - Session not found
- `500` - Failed to generate summary

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (invalid input, invalid state) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (not your session) |
| 404 | Not Found |
| 422 | Validation Error (malformed JSON, invalid fields) |
| 500 | Internal Server Error |

---

## Common Errors

### Validation Error (422)
```json
{
  "detail": [
    {
      "loc": ["body", "mode"],
      "msg": "field required",
      "type": "value_error.missing"
    },
    {
      "loc": ["body", "num_questions"],
      "msg": "ensure this value is greater than or equal to 1",
      "type": "value_error.number.not_ge"
    }
  ]
}
```

### Unauthorized (401)
```json
{
  "detail": "Invalid authentication credentials"
}
```

### Session Not Found (404)
```json
{
  "detail": "Interview session not found"
}
```

---

## Rate Limiting

TBD: Rate limits per user (e.g., 10 sessions/day, 100 messages/hour)

---

## WebSocket vs SSE

We use **SSE (Server-Sent Events)** instead of WebSocket because:
- Simpler implementation (unidirectional server → client)
- Works with HTTP/2 and HTTP/3
- Easier authentication (standard JWT header)
- Sufficient for chat use case (client sends, server streams)

---

## SDK Examples

### Python (httpx)

```python
import httpx
import json

async def create_interview_session(token: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.talentpuse.io.vn/api/interview/sessions",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "mode": "tech",
                "target_role": "Senior Backend Engineer",
                "num_questions": 5
            }
        )
        return response.json()

async def send_message_streaming(token: str, session_id: str, content: str):
    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            f"https://api.talentpuse.io.vn/api/interview/sessions/{session_id}/messages",
            headers={"Authorization": f"Bearer {token}"},
            json={"content": content}
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith(b"data: "):
                    event = json.loads(line[5:].decode())
                    if event["type"] == "token":
                        print(event["content"], end="", flush=True)
                    elif event["type"] == "done":
                        print("\n\nMessage saved!")
```

### TypeScript/JavaScript

```typescript
import { sendMessageStream, completeSession } from './lib/interview-api';

// Create session
const session = await createInterviewSession(token, {
  mode: 'behavioral',
  numQuestions: 5
});

// Stream chat
const events = sendMessageStream(token, session.id, "My answer...");
for await (const event of events) {
  if (event.type === 'token') {
    appendToChat(event.content);
  } else if (event.type === 'done') {
    saveMessage(event.message);
  }
}

// Complete and get summary
const summary = await completeSession(token, session.id);
console.log(summary.overall_score);
console.log(summary.strengths);
```

---

## OpenAPI Spec (Snippet)

```yaml
openapi: 3.0.0
info:
  title: TalentPulse Interview Agent API
  version: 1.0.0
paths:
  /api/interview/sessions:
    post:
      summary: Create interview session
      tags:
        - Sessions
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateSessionRequest'
      responses:
        "201":
          description: Session created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SessionResponse'
    get:
      summary: List interview sessions
      tags:
        - Sessions
      security:
        - BearerAuth: []
      parameters:
        - name: mode
          in: query
          schema:
            type: string
            enum: [tech, behavioral]
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        "200":
          description: List of sessions
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SessionListResponse'

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```
