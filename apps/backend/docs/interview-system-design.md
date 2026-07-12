# TalentPulse Interview Agent - System Design Document

## Executive Summary

The TalentPulse Interview Agent is a **conversational AI-powered interview practice system** designed to help job seekers prepare for both **Technical** (coding, system design, architecture) and **Behavioral/HR** (STAR method, soft skills) interviews through interactive chatbot conversations.

### Key Features
- **Two Interview Modes**: Technical and Behavioral with specialized AI agents
- **Conversational Interface**: Chat-based interaction, not rigid Q&A forms
- **Real-time Coaching**: AI provides feedback during conversation (STAR coaching for behavioral mode)
- **Session Summaries**: End-of-session evaluation with scores, strengths, improvements
- **Voice-Ready**: Architecture designed for future STT/TTS integration

### Business Value
- **For Users**: Practice interviews anytime, receive instant feedback, track progress
- **For Platform**: Differentiation feature, increased engagement, premium offering potential

---

## High-Level System Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TalentPulse Platform                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ Dashboard UI  │  │   Chat Service   │  │  Job Market Service    │  │
│  │ (Next.js)     │  │  (FastAPI)       │  │  (existing)            │  │
│  └──────────────┘  └──────────────────┘  └──────────────────────┘  │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Interview Agent Service (This Feature)              ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │  FastAPI Router (/api/interview/*)                               ││
│  │        │                                                        ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   ││
│  │  │    Agent     │  │   Context    │  │   Evaluation   │   ││
│  │  │   (Tech/Behav) │  │ (Injection)  │  │  (Evaluator/Summarizer)│  ││
│  │  └─────────────┘  └─────────────┘  └──────────────────┘   ││
│  │        │                                                        ││
│  │  ┌───────────────────────────────────────────────────────┐   ││
│  │  │           Storage Layer (PostgreSQL)                  │   ││
│  │  │   interview_sessions, interview_messages               │   ││
│  │  └───────────────────────────────────────────────────────┘   ││
│  │        │                                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                             │                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌────────────────────────┐
                    │   LLM Services            │
                    │   (OpenAI / Anthropic)     │
                    └────────────────────────┘
```

---

## Data Flow

### Session Creation Flow

```
User creates session
    │
    ↓
POST /api/interview/sessions
    {
      "mode": "tech",
      "target_role": "Senior Backend Engineer",
      "num_questions": 5
    }
    │
    ↓
InterviewSession created in DB
    │
    ↓
TechInterviewAgent.greet()
    │
    ↓
AI: "Hello! I'm your technical interviewer today...
     Let's discuss your experience with distributed systems..."
```

### Chat Flow

```
User sends message (text or audio)
    │
    ↓
POST /api/interview/sessions/{id}/messages
    │
    ↓
Agent.process_answer()
    │
    ↓ (SSE streaming)
data: {"type": "token", "content": "That's a"}
data: {"type": "token", "content": "good approach"}
...
    │
    ↓
data: {"type": "done", "message": {...}}
    │
    ↓
Message saved to DB
```

### Session Completion Flow

```
User clicks "Complete Session"
    │
    ↓
POST /api/interview/sessions/{id}/complete
    │
    ↓
Summarizer.generate_summary()
    │
    ↓
Evaluation stored in session:
- overall_score
- overall_feedback
- improvement_plan
    │
    ↓
Return summary to frontend
```

---

## Component Design

### Agent Layer Design

**Base Agent Interface:**
```python
class BaseInterviewAgent(ABC):
    @abstractmethod
    async def greet(self) -> str: """Opening message"""
    
    @abstractmethod
    async def ask_question(self) -> str: """Next question"""
    
    @abstractmethod
    async def process_answer(self, answer: str) -> str:
        """Process user answer, return feedback or follow-up"""
    
    @abstractmethod
    async def generate_summary(self) -> Dict:
        """Generate session summary with score and feedback"""
```

**Tech Interview Agent:**
- Focuses on: System design, algorithms, coding
- Asks probing questions
- Evaluates: Problem-solving approach, technical depth, communication

**Behavioral Interview Agent:**
- Focuses on: STAR method, soft skills, culture fit
- Asks behavioral questions
- Evaluates: STAR structure, specificity, examples
- Provides real-time STAR coaching

---

### Context Injection

**User Profile Data:**
```yaml
Skills: ["Python", "PostgreSQL", "Docker"]
Experience Level: "senior"
Desired Titles: ["Backend Engineer", "DevOps Engineer"]
Preferred Cities: ["Ho Chi Minh", "Da Nang"]
Salary Range: 20M-40M VND
University: "FPT"
Graduation Year: 2023
```

**Injection Point:**
```python
@before_model
def inject_interview_context(state, runtime: Runtime):
    if runtime.context and runtime.context.profile:
        profile_text = _format_profile(runtime.context.profile)
        return {
            "messages": [
                SystemMessage(content=profile_text)
            ]
        }
    return None
```

---

### Evaluation System Design

**Two-Stage Evaluation:**

1. **Real-Time Feedback** (Optional)
   - Light evaluation during conversation
   - Quick STAR coaching for behavioral mode
   - Probing questions for technical mode
   - No scores, just guidance

2. **End-of-Session Summary** (Required)
   - Comprehensive evaluation
   - Overall score (1.0-5.0)
   - Strengths list (3-5 items)
   - Improvements list (3-5 items)
   - Actionable improvement plan

---

## API Design Philosophy

### RESTful + SSE

- **CRUD operations**: Standard REST verbs
- **Chat interface**: SSE for streaming
- **Session isolation**: Each session is independent

### Resource-Oriented URLs

```
/api/interview/sessions           # Collection of sessions
/api/interview/sessions/{id}      # Specific session
/api/interview/sessions/{id}/messages  # Messages in session
```

### Error Handling

```json
{
  "detail": "Interview session not found",
  "code": "SESSION_NOT_FOUND"
}
```

---

## Database Design Principles

### Separation of Concerns

**Why separate from existing chat?**
- Different lifecycle (sessions vs open-ended rooms)
- Different metadata (questions, scores, target roles)
- Different security contexts (interview practice vs career coaching)
- Allows independent evolution

**Why not reuse chat tables?**
- `chat_rooms` has simple structure
- `interview_sessions` needs specialized fields
- Cleaner data model for interview analytics

### Normalization

**Mode Values:**
- `tech`, `behavioral` (enum, not free text)

**Status Values:**
- `created`, `in_progress`, `completed`, `abandoned`

**Role Values:**
- `user`, `assistant` (enum, not free text)

---

## Integration Points

### With Existing TalentPulse Services

**Job Market Data:**
- Access `dbt_dev_gold.fct_jobs_daily` for question customization
- Use salary/benefits data for realistic questions

**User Profile:**
- Access `app.users` for skills, experience level
- Use career goals to personalize questions

**Job Match:**
- Access job matching logic to recommend relevant questions
- Suggest interviews for roles user matches

### External Services

**LLM Providers:**
- **Primary:** OpenAI GPT-4o-mini (conversational)
- **Secondary:** Anthropic Claude (if OpenAI unavailable)
- **Fallback:** Simple rule-based questions if LLM fails

**Storage:**
- **PostgreSQL:** Sessions and messages
- **MinIO/S3:** Audio files (future voice phase)

---

## Security Model

### Authentication
- JWT-based authentication required for all endpoints
- User can only access their own sessions
- Admin can view all sessions (for audit)

### Authorization

| Role | Permissions |
|------|-------------|
| User | Create sessions, send messages, view own sessions |
| Admin | View all sessions, delete abusive content, view analytics |

### Data Privacy

- **PII Protection:** Interview content contains career information
- **Encryption:** TLS in transit, encryption at rest (PostgreSQL, S3)
- **Retention:** 6 months default, configurable
- **Right to Deletion:** User can delete their sessions

---

## Performance Requirements

### Latency Targets

| Operation | Target |
|-----------|--------|
| Create session | <200ms |
| Send message | <100ms (before streaming) |
| First token | <2s |
| Complete session | <10s (summary generation) |

### Throughput Targets

| Metric | Target |
|--------|--------|
| Concurrent sessions | 100+ |
| Messages per second | 50+ |
| Daily sessions | 1000+ |

---

## Monitoring & Observability

### Metrics to Track

**Business Metrics:**
- Session creation rate
- Completion rate (sessions finished vs abandoned)
- Average session duration
- Average scores by mode/level

**Technical Metrics:**
- LLM API latency
- Database query performance
- SSE connection duration
- Error rates by endpoint

### Logging Strategy

**Structured Logs:**
```json
{
  "timestamp": "2025-05-30T10:00:00Z",
  "level": "INFO",
  "event": "interview_session_created",
  "user_id": "uuid",
  "mode": "tech",
  "session_id": "uuid",
  "target_role": "Senior Backend Engineer"
}
```

**Error Logs:**
```json
{
  "timestamp": "2025-05-30T10:05:00Z",
  "level": "ERROR",
  "event": "llm_api_error",
  "session_id": "uuid",
  "error": "Timeout connecting to OpenAI",
  "retry_attempt": 1
}
```

---

## Future Enhancements

### Phase 1: Voice Input (3-6 months)
- Browser STT integration (Web Speech API → Whisper)
- Audio upload endpoint
- Transcript storage

### Phase 2: Voice Output (6-9 months)
- OpenAI TTS / ElevenLabs integration
- Audio playback in UI
- Voice mode toggle

### Phase 3: Advanced Features (9-12 months)
- Real-time speech-to-speech conversation
- Voice analytics (speaking pace, filler words)
- Interview recording for review
- Multi-language support

### Phase 4: AI Enhancements (12+ months)
- Adaptive difficulty based on performance
- Personalized question banks
- Historical performance tracking
- Peer interview matching

---

## Comparison: Old vs New

### Old System (Q&A Form)

```
User → Select category → Form input → Submit → See score
```

**Limitations:**
- Static question bank
- No conversational follow-ups
- One-time evaluation at end
- No coaching during process

### New System (Chatbot)

```
User → Select mode → Chat with AI → Probing questions → Real-time feedback → Summary
```

**Advantages:**
- Dynamic question generation
- Natural conversation flow
- Real-time STAR coaching
- Adaptive difficulty
- Voice-ready

---

## Success Metrics

### User Engagement
- DAU (Daily Active Users) using interview feature
- Sessions completed per user per week
- Average session duration

### Quality Metrics
- Session completion rate >80%
- Average score improvement over time
- User satisfaction scores

### Business Metrics
- Premium conversion rate (if interview becomes paid feature)
- Time to first interview
- Retention rate after first interview

---

## Dependencies

### Internal Dependencies

| Service | Purpose | Critical |
|---------|---------|----------|
| User Database | User profiles | Yes |
| Job Market DB | Question content | Optional |
| LLM API | AI conversations | Yes |

### External Dependencies

| Service | Purpose | Critical |
|---------|---------|----------|
| OpenAI API | LLM services | Yes |
| Anthropic API | LLM backup | No |
| PostgreSQL | Data persistence | Yes |
| MinIO/S3 | Audio storage | Future |

---

## Trade-offs and Decisions

### Why Separate Agent System?

**Decision:** Create isolated `interview_agent` directory

**Rationale:**
1. **Separation of Concerns**: Interview logic different from career coaching
2. **Independent Evolution**: Can grow without affecting main chat
3. **Clearer Ownership:** Dedicated team can own this feature
4. **Testing**: Easier to test in isolation

### Why Not Extend Existing Chat?

**Decision:** Don't reuse `chat_rooms`/`chat_messages`

**Rationale:**
1. **Different Data Model**: Interviews need specialized metadata (scores, target_role, etc.)
2. **Different Lifecycle:** Sessions have clear start/end, chat rooms are ongoing
3. **Clean Analytics**: Separate tables make analytics easier
4. **No Migration Headache**: Zero impact on existing chat data

### Why SSE over WebSocket?

**Decision:** Use Server-Sent Events for streaming

**Rationale:**
1. **Simpler**: Easier to implement in FastAPI
2. **HTTP/2 Compatible**: Works with modern web infrastructure
3. **Authentication**: Works with standard JWT headers
4. **Sufficient**: Unidirectional server→client (no need for bidirectional)

### Why OpenAI GPT-4o-mini?

**Decision:** Primary model for interviews

**Rationale:**
1. **Cost-effective**: Much cheaper than GPT-4 ($0.15/1M tokens vs $5/1M tokens)
2. **Fast**: Lower latency than GPT-4
3. **Capable**: Good for both technical and behavioral interviews
4. **Upgrade Path**: Easy to switch to GPT-4 if needed

---

## Glossary

- **STAR Method**: Situation, Task, Action, Result — structured format for behavioral interview answers
- **STT**: Speech-to-Text — converting audio to text
- **TTS**: Text-to-Speech — converting text to audio
- **SSE**: Server-Sent Events — streaming data from server to client
- **LLM**: Large Language Model — AI model for generating text
- **SSE**: Server-Sent Events — streaming protocol

---

## Appendix

### Related Documentation

- [Architecture Overview](./interview-architecture.md) - Detailed architecture
- [API Specification](./interview-api-spec.md) - Complete API documentation
- [Database Schema](./interview-database-schema.md) - Database design
- [Evaluation System](./interview-evaluation.md) - Scoring and feedback logic
- [Voice Integration](./interview-voice-roadmap.md) - Voice features roadmap
- [Deployment Guide](./interview-deployment.md) - Production setup

### Quick Links

- **Repository**: `/d/TalentPulse/dashboard/backend/app/services/interview_agent/`
- **Documentation**: `/d/TalentPulse/dashboard/backend/docs/`
- **Skeleton Plan**: `/d/TalentPulse/dashboard/backend/app/services/interview_agent/SKELETON.md`
- **Deployment**: `docker-compose.yml` in backend root
- **Migration**: `alembic/versions/012_create_interview_sessions.py` (to be created)
