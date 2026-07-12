# Interview Agent - Database Schema

## Overview

The interview agent uses two main tables for data persistence:

1. **`interview_sessions`** - Session metadata and results
2. **`interview_messages`** - Individual messages in conversations

Both tables are **isolated** from the existing chat system (`chat_rooms`, `chat_messages`) to allow independent evolution.

---

## Entity-Relationship Diagram

```
users (app.users)
    │
    │ (1:N)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    interview_sessions                        │
├─────────────────────────────────────────────────────────────┤
│ id: UUID (PK)                                              │
│ user_id: UUID (FK → users.id)                             │
│ mode: VARCHAR (tech | behavioral)                          │
│ status: VARCHAR (created | in_progress | completed)          │
│ target_role: VARCHAR (optional)                             │
│ question_count: INTEGER (default 0)                          │
│ overall_score: FLOAT (nullable)                             │
│ overall_feedback: TEXT (nullable)                            │
│ improvement_plan: TEXT (nullable)                            │
│ created_at: TIMESTAMP                                       │
│ updated_at: TIMESTAMP (auto)                                 │
└─────────────────────────────────────────────────────────────┘
    │
    │ (1:N)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    interview_messages                          │
├─────────────────────────────────────────────────────────────┤
│ id: UUID (PK)                                              │
│ session_id: UUID (FK → interview_sessions.id)               │
│ role: VARCHAR (user | assistant)                             │
│ content: TEXT (NOT NULL)                                    │
│ audio_url: VARCHAR (nullable, future)                        │
│ original_audio_url: VARCHAR (nullable, future)               │
│ created_at: TIMESTAMP                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Table Definitions

### interview_sessions

Stores interview session metadata and evaluation results.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT `uuid_generate_v4()` | Unique session identifier |
| `user_id` | UUID | FK, NOT NULL | References `users.id`, ON DELETE CASCADE |
| `mode` | VARCHAR(20) | NOT NULL | Interview mode: `tech` or `behavioral` |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT `'created'` | Session state: `created`, `in_progress`, `completed` |
| `target_role` | VARCHAR(255) | NULLABLE | User's target job role (e.g., "Senior Backend Engineer") |
| `question_count` | INTEGER | NOT NULL, DEFAULT `0` | Number of questions exchanged |
| `overall_score` | FLOAT | NULLABLE | Final session score (1.0-5.0 scale) |
| `overall_feedback` | TEXT | NULLABLE | AI-generated overall feedback narrative |
| `improvement_plan` | TEXT | NULLABLE | AI-generated improvement plan |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | Session creation time |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | Last update time (auto) |

**Indexes:**
```sql
CREATE INDEX idx_interview_sessions_user_id ON interview_sessions(user_id);
CREATE INDEX idx_interview_sessions_status ON interview_sessions(status);
CREATE INDEX idx_interview_sessions_created_at ON interview_sessions(created_at DESC);
```

---

### interview_messages

Stores individual messages in the interview conversation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT `uuid_generate_v4()` | Unique message identifier |
| `session_id` | UUID | FK, NOT NULL | References `interview_sessions.id`, ON DELETE CASCADE |
| `role` | VARCHAR(20) | NOT NULL | Message sender: `user` or `assistant` |
| `content` | TEXT | NOT NULL | Message content (text transcript) |
| `audio_url` | VARCHAR(512) | NULLABLE | TTS audio URL for assistant messages (future) |
| `original_audio_url` | VARCHAR(512) | NULLABLE | STT audio URL for user messages (future) |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | Message creation time |

**Indexes:**
```sql
CREATE INDEX idx_interview_messages_session_id ON interview_messages(session_id);
CREATE INDEX idx_interview_messages_created_at ON interview_messages(created_at);
```

---

## Status Flow

```
created → in_progress → completed
    ↓
   (abandoned - soft delete via user action)
```

- **`created`**: Session created, no messages yet
- **`in_progress`**: User has sent at least one message, conversation active
- **`completed`**: User clicked "Complete Session", summary generated

---

## Cascade Behavior

When a **user is deleted**:
- All their sessions are automatically deleted (`ON DELETE CASCADE`)
- All messages in those sessions are automatically deleted

When a **session is deleted**:
- All its messages are automatically deleted

---

## JSON Metadata Considerations

We could optionally add a `metadata` JSONB column to store flexible data:

```sql
ALTER TABLE interview_sessions ADD COLUMN metadata JSONB;

-- Example content:
{
  "evaluator_version": "1.0",
  "llm_model": "gpt-4o-mini",
  "total_tokens_used": 3420,
  "duration_seconds": 180,
  "question_scores": [
    {"question_index": 1, "score": 4.0, "category": "problem_solving"},
    {"question_index": 2, "score": 4.5, "category": "communication"}
  ]
}
```

However, the current schema keeps this in separate columns for better queryability.

---

## Migration Scripts

### Alembic Migration

```python
# alembic/versions/012_create_interview_tables.py

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

def upgrade():
    # Create interview_sessions table
    op.create_table(
        'interview_sessions',
        sa.Column('id', sa.UUID(), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('mode', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='created'),
        sa.Column('target_role', sa.String(length=255), nullable=True),
        sa.Column('question_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('overall_score', sa.Float(), nullable=True),
        sa.Column('overall_feedback', sa.Text(), nullable=True),
        sa.Column('improvement_plan', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    
    # Create foreign key
    op.create_foreign_key(
        'interview_sessions_user_id_fkey',
        'interview_sessions', 'users',
        ['user_id'],
        ondelete='CASCADE'
    )
    
    # Create indexes
    op.create_index('idx_interview_sessions_user_id', 'interview_sessions', ['user_id'])
    op.create_index('idx_interview_sessions_status', 'interview_sessions', ['status'])
    op.create_index('idx_interview_sessions_created_at', 'interview_sessions', ['created_at'])
    
    # Create interview_messages table
    op.create_table(
        'interview_messages',
        sa.Column('id', sa.UUID(), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('session_id', sa.UUID(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('audio_url', sa.String(length=512), nullable=True),
        sa.Column('original_audio_url', sa.String(length=512), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    
    # Create foreign key
    op.create_foreign_key(
        'interview_messages_session_id_fkey',
        'interview_messages', 'interview_sessions',
        ['session_id'],
        ondelete='CASCADE'
    )
    
    # Create indexes
    op.create_index('idx_interview_messages_session_id', 'interview_messages', ['session_id'])
    op.create_index('idx_interview_messages_created_at', 'interview_messages', ['created_at'])

def downgrade():
    op.drop_index('idx_interview_messages_created_at', 'interview_messages')
    op.drop_index('idx_interview_messages_session_id', 'interview_messages')
    op.drop_table('interview_messages')
    
    op.drop_index('idx_interview_sessions_created_at', 'interview_sessions')
    op.drop_index('idx_interview_sessions_status', 'interview_sessions')
    op.drop_index('idx_interview_sessions_user_id', 'interview_sessions')
    op.drop_table('interview_sessions')
```

---

## Query Examples

### Get User's Sessions with Latest Message

```sql
SELECT 
    s.id,
    s.mode,
    s.status,
    s.target_role,
    s.overall_score,
    s.created_at,
    (SELECT content 
     FROM interview_messages 
     WHERE session_id = s.id 
     ORDER BY created_at DESC 
     LIMIT 1) AS last_message
FROM interview_sessions s
WHERE s.user_id = $1
ORDER BY s.created_at DESC
LIMIT 20 OFFSET $2;
```

### Get Session with All Messages

```sql
SELECT 
    s.id,
    s.mode,
    s.status,
    s.target_role,
    s.question_count,
    s.overall_score,
    s.overall_feedback,
    s.improvement_plan,
    json_agg(
        json_build_object(
            'id', m.id,
            'role', m.role,
            'content', m.content,
            'audio_url', m.audio_url,
            'created_at', m.created_at
        ) ORDER BY m.created_at
    ) AS messages
FROM interview_sessions s
LEFT JOIN interview_messages m ON m.session_id = s.id
WHERE s.id = $1
GROUP BY s.id;
```

### Statistics Queries

```sql
-- Average score by mode
SELECT mode, AVG(overall_score) as avg_score
FROM interview_sessions
WHERE status = 'completed' AND overall_score IS NOT NULL
GROUP BY mode;

-- Completion rate
SELECT 
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
    COUNT(*) FILTER (WHERE status = 'created') AS created
FROM interview_sessions
WHERE user_id = $1;

-- Questions per session distribution
SELECT 
    question_count,
    COUNT(*) AS num_sessions
FROM interview_sessions
WHERE status = 'completed'
GROUP BY question_count
ORDER BY question_count;
```

---

## Storage Estimation

Assuming:
- 10,000 users
- 5 sessions per user
- 10 messages per session
- Average message length: 500 characters

**Estimated storage:**
- `interview_sessions`: ~50 KB (10,000 × 5 sessions × 1KB/session)
- `interview_messages`: ~250 MB (10,000 × 5 × 10 × 500 chars)
- **Total: ~300 MB** (excluding indexes)

With overhead and indexes: **~400 MB**

---

## Backup Strategy

- Database-level backups include interview tables
- No separate backup needed
- For legal/compliance: consider exporting user interview data on request

---

## Data Retention

Recommended: **6 months** for inactive sessions, then:

```sql
DELETE FROM interview_messages
WHERE session_id IN (
    SELECT id FROM interview_sessions
    WHERE updated_at < NOW() - INTERVAL '6 months'
    AND status IN ('completed', 'in_progress')
);

DELETE FROM interview_sessions
WHERE updated_at < NOW() - INTERVAL '6 months'
    AND status IN ('completed', 'in_progress');
```

Or soft delete: add `deleted_at` column.

---

## Future: Voice Audio Storage

When voice is implemented:

1. **Store in S3/MinIO** (not PostgreSQL):
   - `audio_url` → S3 object URL
   - `original_audio_url` → S3 object URL
   
2. **Naming Convention:**
   ```
   {user_id}/{session_id}/{message_id}.{extension}
   example: "a1b2c3d4/5e6f7g8h-9i0j-1k2l-m3n4o5p6q7r8s9t0/audio.webm"
   ```

3. **Storage Class:**
   - Standard: 30 days
   - Glacier: 1 year (for compliance)

---

## PostgreSQL Configuration

Ensure timezone is set correctly (in existing init_db):

```python
def _set_timezone(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("SET TIME ZONE 'Asia/Ho_Chi_Minh'")
    cursor.close()
```

This ensures `created_at` and `updated_at` use Vietnam timezone.
