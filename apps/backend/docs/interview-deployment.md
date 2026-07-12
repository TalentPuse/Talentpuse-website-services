# Interview Agent - Deployment Guide

## Overview

Guide for deploying the TalentPulse Interview Agent system to production.

---

## Prerequisites

### Infrastructure
- **PostgreSQL 13+** (with UUID extension enabled)
- **MinIO or S3** (for audio storage, future)
- **Redis** (optional, for caching sessions)
- **FastAPI server** (Uvicorn/Gunicorn)

### External Services
- **OpenAI API** or **Anthropic API** (for LLM)
- Optional: **OpenAI Whisper** (for STT, voice phase)
- Optional: **OpenAI TTS** or **ElevenLabs** (for TTS, voice phase)

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/talentpulse

# Interview Agent
INTERVIEW_MODEL=gpt-4o-mini
INTERVIEW_TEMPERATURE=0.7
INTERVIEW_MAX_TOKENS=2000
INTERVIEW_EVAL_MODEL=gpt-4o
INTERVIEW_EVAL_TEMPERATURE=0.3

# Voice (optional, future)
VOICE_ENABLED=false
VOICE_INPUT_ENABLED=false
VOICE_OUTPUT_ENABLED=false
VOICE_STT_SERVICE=openai
VOICE_STT_MODEL=whisper-1
VOICE_TTS_SERVICE=openai
VOICE_TTS_VOICE=alloy
```

---

## Deployment Steps

### 1. Database Setup

```bash
# Run migration to create interview tables
cd /d/TalentPulse/dashboard/backend
alembic upgrade head

# Verify tables created
psql $DATABASE_URL -c "\d interview_sessions"
```

### 2. Install Dependencies

```bash
cd /d/Talent_pulsE/dashboard/backend

# Install interview agent dependencies (when separated)
pip install langchain openai anthropic python-multipart

# Or if using the monorepo structure:
uv sync
```

### 3. Configuration

**File:** `app/services/interview_agent/config.py`

```python
from pydantic_settings import BaseSettings

class InterviewAgentConfig(BaseSettings):
    # Model settings
    model: str = "gpt-4o-mini"
    temperature: float = 0.7
    max_tokens: int = 2000
    
    # Evaluation settings
    eval_model: str = "gpt-4o"
    eval_temperature: float = 0.3
    
    # Interview settings
    default_num_questions: int = 5
    max_session_duration_minutes: int = 60
    
    class Config:
        env_prefix = "INTERVIEW_"

config = InterviewAgentConfig()
```

### 4. Include Router

**File:** `app/main.py`

```python
from app.services.interview_agent import interview_router

app.include_router(interview_router, prefix="/api/interview", tags=["interview"])
```

### 5. Environment Setup

**Create `.env` or update existing:**

```bash
# Interview Agent
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

INTERVIEW_MODEL=gpt-4o-mini
INTERVIEW_TEMPERATURE=0.7
```

---

## Docker Deployment

### Dockerfile

**Location:** `/d/TalentPulse/dashboard/backend/Dockerfile`

```dockerfile
# Multi-stage build for production
FROM python:3.11-slim as builder

WORKDIR /app

# Install dependencies
COPY pyproject.toml uv.lock ./
RUN pip install uv
RUN uv sync --frozen

# Copy application
COPY . .

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11
COPY --from=builder /usr/local/bin/uv /usr/local/bin/

# Copy application code
COPY app ./app
COPY alembic ./alembic
COPY app/services/interview_agent ./app/services/interview_agent

# Set environment
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Expose port
EXPOSE 8001

# Run with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

### Docker Compose

**File:** `/d/TalentPulse/dashboard/backend/docker-compose.yml`

```yaml
services:
  interview-backend:
    build: .
    ports:
      - "8001:8001"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - INTERVIEW_MODEL=${INTERVIEW_MODEL:-gpt-4o-mini}
      - INTERVIEW_TEMPERATURE=${INTERVIEW_TEMPERATURE:-0.7}
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    command: server /data
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  minio_data:
```

---

## Production Considerations

### Security

1. **API Key Management**
   - Store in environment variables, not in code
   - Rotate keys regularly
   - Use different keys for production vs development

2. **Database Security**
   - Use SSL for database connections
   - Enable row-level security where appropriate
   - Regular backups

3. **Rate Limiting**
   - Implement rate limiting on interview API
   - Prevent abuse: limit sessions per user per day
   - Example: 10 sessions/day, 100 messages/session

### Performance

1. **Connection Pooling**
   ```python
   # Already configured in app/core/database.py
   pool_size=5, max_overflow=0
   ```

2. **Async Operations**
   - All I/O operations are async (database, LLM, S3)
   - No blocking calls in request handlers

3. **Caching**
   - Cache evaluation prompts
   - Cache common user profile queries
   - Consider Redis for distributed caching

### Monitoring

1. **Application Metrics**
   ```python
   # Add Prometheus metrics
   - interview_session_created_total
   - interview_message_sent_total
   - interview_evaluation_duration_seconds
   - llm_api_latency_seconds
   ```

2. **Logging**
   - Structured JSON logs
   - Log session lifecycle events
   - Log LLM API calls (without PII)

3. **Alerting**
   - Alert on high error rates
   - Alert on LLM API failures
   - Alert on database connection issues

---

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.yml with multiple instances
services:
  interview-backend-1:
    <<: *backend-config
  interview-backend-2:
    <<: *backend-config
  interview-backend-3:
    <<: *backend-config

# Load balancer (nginx)
  nginx:
    image: nginx:alpine
    ports:
      - "8001:8001"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - interview-backend-1
      - interview-backend-2
      - interview-backend-3
```

### Load Balancer Configuration

```nginx
# nginx.conf
upstream interview_backends {
    server interview-backend-1:8001;
    server interview-backend-2:8001;
    server interview-backend-3:8001;
    least_conn;
}

server {
    listen 8001;
    location / {
        proxy_pass http://interview_backends;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Database Scaling

For high traffic:
- Use RDS (AWS) or Cloud SQL (GCP)
- Enable connection pooling (already configured)
- Consider read replicas for read-only queries

---

## CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy-interview-agent.yml

name: Deploy Interview Agent

on:
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          pip install uv
          uv sync
      - name: Run tests
        run: |
          uv run pytest tests/
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: |
          docker build -t talentpulse-interview:${{ github.sha }} .
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          # Deploy to server
          ssh deploy@talentpuse.io.vn "cd /var/www/talentpuse && git pull && docker-compose up -d --build interview-backend"
```

---

## Rollback Strategy

### Database Migration Rollback

```bash
# Roll to previous migration
alembic downgrade -1

# Verify
alembic current
```

### Application Rollback

```bash
# Revert to previous git commit
git revert HEAD

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

### Blue-Green Deployment

1. Deploy new version to staging environment
2. Run smoke tests
3. Switch traffic via load balancer
4. Monitor for issues
5. Rollback if needed

---

## Troubleshooting

### Common Issues

**Issue:** Module import error for `interview_agent`

**Solution:**
```bash
# Ensure PYTHONPATH includes the app directory
export PYTHONPATH="${PYTHONPATH}:/d/TalentPulse/dashboard/backend"

# Or use -m module flag
python -m app.services.interview_agent.agents.tech_interview
```

**Issue:** Database connection fails

**Solution:**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Check alembic migrations
alembic history
```

**Issue:** LLM API timeout

**Solution:**
- Check API key is valid
- Increase timeout in configuration
- Implement retry logic

**Issue:** SSE connection drops

**Solution:**
- Check nginx timeout configuration
- Implement client-side auto-reconnect
- Add heartbeat events

---

## Monitoring & Observability

### Health Check Endpoint

```python
# app/services/interview_agent/api/routes.py

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": await check_db_connection(),
        "llm_api": await check_llm_connection(),
        "timestamp": datetime.utcnow().isoformat()
    }
```

### Prometheus Metrics

```python
# app/services/interview_agent/monitoring.py

from prometheus_client import Counter

session_created_counter = Counter(
    'interview_sessions_created_total',
    'Total number of interview sessions created'
)

evaluation_duration_gauge = Histogram(
    'interview_evaluation_duration_seconds',
    'Time taken to evaluate an answer'
)
```

### Structured Logging

```python
import structlog

logger = structlog.get_logger()
logger.info("interview_session_created", user_id=user_id, mode=mode, session_id=session_id)
logger.error("llm_api_error", error=str(e), session_id=session_id)
```

---

## Backup Strategy

### Database Backups

- Automated daily backups via pg_dump
- Point-in-time recovery (PITR) for 30 days
- Weekly full backups to offsite storage

### Audio Backups (Future)

- MinIO/S3 versioning enabled
- Cross-region replication (for critical data)
- 30-day retention policy with auto-delete

---

## Cost Management

### LLM API Costs

| Operation | Tokens per Session | Cost (GPT-4o-mini) |
|-----------|-------------------|---------------------|
| Chat (5 questions × 5 turns) | ~15,000 | ~$0.01/session |
| Evaluation (5 answers) | ~10,000 | ~$0.006/session |
| Summary generation | ~5,000 | ~$0.003/session |
| **Total per session** | **~30,000 tokens** | **~$0.02/session** |

### Scaling Estimates

| Volume | Sessions/Month | Tokens/Month | Cost/Month |
|--------|--------------|--------------|-----------|
| 100 | ~500 | ~3M | ~$2 |
| 1,000 | ~5,000 | ~30M | ~$20 |
| 10,000 | ~50,000 | ~300M | ~$200 |

---

## Maintenance

### Regular Tasks

1. **Daily**
   - Check error logs
   - Monitor API costs
   - Review session completion rates

2. **Weekly**
   - Review feedback quality
   - Update evaluation prompts based on patterns
   - Clean up abandoned sessions (>30 days old)

3. **Monthly**
   - Review and rotate API keys
   - Analyze metrics and optimize
   - Update prompts if needed

---

## Related Documentation

- [Architecture Overview](./interview-architecture.md) - System architecture
- [API Specification](./interview-api-spec.md) - API endpoints
- [Database Schema](./interview-database-schema.md) - Database design
- [Evaluation System](./interview-evaluation.md) - Scoring logic
- [Voice Integration](./interview-voice-roadmap.md) - Voice features

---

## Quick Start (Development)

```bash
# 1. Create virtual environment
cd /d/TalentPulse/dashboard/backend
python -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install fastapi uvicorn[standard] langchain openai anthropic
pip install sqlalchemy[asyncpg] alembic python-jose[cryptography]

# 3. Run migrations
alembic upgrade head

# 4. Set environment variables
export DATABASE_URL="postgresql+asyncpg://..."
export OPENAI_API_KEY="sk-..."

# 5. Run server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

---

## Quick Start (Docker)

```bash
# 1. Build and start services
cd /d/TalentPulse/dashboard/backend
docker-compose up -d

# 2. Run migrations
docker-compose exec backend alembic upgrade head

# 3. View logs
docker-compose logs -f interview-backend

# 4. Scale (if needed)
docker-compose up -d --scale interview-backend=3
```
