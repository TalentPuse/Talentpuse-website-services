# TalentPulse Interview Agent - System Architecture

## Overview

The Interview Agent is a **conversational AI system** for practicing job interviews, supporting both **Technical** (coding, system design, architecture) and **Behavioral/HR** (STAR method, soft skills, culture fit) interviews.

### Key Characteristics
- **Conversational Interface**: Chatbot-style interaction, not Q&A forms
- **Dual Interview Modes**: Technical and Behavioral with specialized agents
- **Real-time Coaching**: AI provides feedback during the conversation
- **Session Summaries**: End-of-session evaluation with scores and improvement plans
- **Voice-Ready**: Architecture supports future STT/TTS integration

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  Interview Page (app/interview/page.tsx)                        │
│  ├── Mode selector (Tech / Behavioral)                             │
│  ├── Target role input (optional)                                  │
│  ├── ChatWindow component (real-time streaming)                  │
│  └── Summary modal (end-of-session)                                │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  │ HTTP (SSE)
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend (FastAPI)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  API Layer (api/routes.py)                                 │ │
│  │  ├── POST /api/interview/sessions (create session)         │ │
│  │  ├── GET /api/interview/sessions (list sessions)            │ │
│  │  ├── GET /api/interview/sessions/{id} (session detail)      │ │
│  │  ├── POST /api/interview/sessions/{id}/messages (chat)     │ │
│  │  ├── GET /api/interview/sessions/{id}/messages (history)   │ │
│  │  └── POST /api/interview/sessions/{id}/complete (summary)  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                   │                                 │
│                                   ▼                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Agent Layer (agents/)                                    │ │
│  │  ├── BaseInterviewAgent (abstract base)                   │ │
│  │  ├── TechInterviewAgent (technical interviews)            │ │
│  │  └── BehavioralInterviewAgent (behavioral interviews)     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                   │                                 │
│                                   ▼                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Context Layer (context/)                                   │ │
│  │  └── User profile injection (skills, experience, roles)   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                   │                                 │
│                                   ▼                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Evaluation Layer (evaluation/)                              │ │
│  │  ├── Evaluator (answer scoring, feedback)                 │ │
│  │  └── Summarizer (session summary, overall score)           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                   │                                 │
│                                   ▼                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Storage Layer (storage/)                                   │ │
│  │  ├── Models (InterviewSession, InterviewMessage)           │ │
│  │  └── Repository (CRUD operations)                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                   │                                 │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌────────────────────────┐
                    │   PostgreSQL Database    │
                    │  interview_sessions      │
                    │  interview_messages      │
                    └────────────────────────┘
```

---

## Component Breakdown

### 1. API Layer (`api/`)

**Purpose:** FastAPI endpoints for interview operations

**Endpoints:**
- `POST /api/interview/sessions` - Create new interview session
- `GET /api/interview/sessions` - List user's sessions
- `GET /api/interview/sessions/{id}` - Get session details
- `POST /api/interview/sessions/{id}/messages` - Send message (SSE streaming)
- `GET /api/interview/sessions/{id}/messages` - Get message history
- `POST /api/interview/sessions/{id}/complete` - Complete session, get summary

**Key Features:**
- SSE streaming for real-time chat experience
- Session isolation per user
- Automatic message persistence

---

### 2. Agent Layer (`agents/`)

**Purpose:** Interview conversation logic and AI integration

**Components:**
- **BaseInterviewAgent** - Abstract base class defining interview flow
- **TechInterviewAgent** - Technical interview specialist
- **BehavioralInterviewAgent** - Behavioral interview specialist with STAR coaching

**Agent Flow:**
1. `greet()` - Generate opening message
2. `ask_question()` - Generate next question based on context
3. `process_answer()` - Provide feedback or ask follow-up
4. `generate_summary()` - End-of-session evaluation

**LLM Integration:**
- Uses LangChain for agent orchestration
- Configurable model (GPT-4o, Claude, etc.)
- Streaming responses for real-time feel

---

### 3. Context Layer (`context/`)

**Purpose:** Inject user profile into agent for personalized interviews

**Context Data:**
- Skills (from user profile)
- Experience level (student, junior, senior, manager)
- Desired job titles
- Target role (for session)
- Preferred cities, salary range

**Injection Point:**
- Before each LLM call via middleware pattern
- Formats profile as system message context

---

### 4. Evaluation Layer (`evaluation/`)

**Purpose:** Assess answers and generate session summaries

**Components:**
- **Evaluator** - Scores individual answers (1.0-5.0 scale)
  - Technical: Problem-solving approach, code quality, communication
  - Behavioral: STAR structure, specificity, examples

- **Summarizer** - Generates end-of-session report
  - Overall score (weighted average)
  - Overall feedback narrative
  - Strengths list
  - Improvements list
  - Actionable improvement plan

**Evaluation Models:**
- Separate model for evaluation (lower temperature for consistency)
- JSON-structured output for parsing

---

### 5. Storage Layer (`storage/`)

**Purpose:** Database persistence for interviews

**Models:**
- **InterviewSession** - Session metadata
  - Fields: id, user_id, mode, status, target_role, question_count, overall_score, overall_feedback, timestamps
  
- **InterviewMessage** - Individual messages
  - Fields: id, session_id, role, content, audio_url (future), timestamp

**Repository:**
- CRUD operations for sessions and messages
- Transaction management
- Query optimization for history loading

---

## Conversation Flow

### Technical Interview Flow

```
User creates session (mode: "tech", target_role: "Senior Backend")
           ↓
TechInterviewAgent.greet()
           ↓
AI: "Hello! I'm your technical interviewer. You're applying for Senior Backend...
    Let's start with a system design question. Design a URL shortener service."
           ↓
User: (provides answer)
           ↓
TechInterviewAgent.process_answer()
           ↓
AI: "Good approach on distributed systems! I like your choice of Redis.
    Let me ask about edge cases..."
           ↓
[Repeat for num_questions]
           ↓
User clicks "Complete Session"
           ↓
Summarizer.generate_summary()
           ↓
Returns: {overall_score: 4.2, strengths: [...], improvements: [...]}
```

### Behavioral Interview Flow

```
User creates session (mode: "behavioral")
           ↓
BehavioralInterviewAgent.greet()
           ↓
AI: "Hi! I'll be asking behavioral questions. Remember the STAR method...
    First question: Tell me about a time you led a team through a challenge."
           ↓
User: (provides STAR-structured answer)
           ↓
BehavioralInterviewAgent.process_answer()
           ↓
AI: "Excellent STAR structure! Your Situation was clear, Task was specific...
    Let's talk about Teamwork. Describe a conflict you resolved..."
           ↓
[Repeat for num_questions]
           ↓
User clicks "Complete Session"
           ↓
Summarizer.generate_summary()
           ↓
Returns: {overall_score: 3.8, feedback: "Strong STAR usage throughout..."}
```

---

## SSE Streaming Architecture

### Frontend → Backend → Agent → Frontend

```
Frontend                      Backend                      Agent
  │                            │                           │
  │ POST /sessions/{id}/messages │                           │
  ├────────────────────────────►│                           │
  │                            │                           │
  │                            │ async for token in agent    │
  │                            ├────────────────────────────►│
  │                            │                           │
  │                            │ SSE: data: {"type":"token", │
  │◄───────────────────────────│   "content":"Hello"}        │
  │                            │   │                       │
  │                            │   │ (parse & display)       │
  │                            │   │                       │
  │                            │ SSE: data: {"type":"done"} │
  │◄───────────────────────────│                           │
```

### Event Types

```typescript
type SSEEvent = 
  | { type: "user_message", message: ChatMessage }  // Echo back user msg
  | { type: "token", content: string }                    // Streaming AI response
  | { type: "done", message: ChatMessage }               // Final AI msg saved
  | { type: "error", message: string }                   // Error occurred
```

---

## Voice Readiness (Future)

### Architecture for Voice Integration

```
┌────────────────────────────────────────────────────────┐
│                   Voice-Ready Chat Interface              │
├────────────────────────────────────────────────────────┤
│  [🎤 Mic Button] ←─────┬─→ Web Speech API (Browser STT)   │
│                       │                                   │
│  Input Area            │   Audio Blob ──┐                   │
│  [Text OR Voice]       │               │                   │
│                       │◄──────────────┘                   │
│  📜 Audio Player ◄─────┴─ TTS Response Audio               │
└────────────────────────────────────────────────────────┘
```

### Storage Changes for Voice

**Model Changes:**
```python
class InterviewMessage(Base):
    # ... existing fields ...
    audio_url: Optional[str] = None  # Store TTS audio
    original_audio_url: Optional[str] = None  # Store user's voice input
```

**New Endpoints:**
- `POST /api/interview/sessions/{id}/messages/audio` - Send voice message
- Returns: transcription + AI response + TTS audio URL

**Future STT/TTS Options:**
- OpenAI Whisper + TTS
- Google Speech-to-Text + Text-to-Speech
- ElevenLabs for natural voice
- Azure Speech Services

---

## Database Relationships

```
users (app.users)
  │ 1:N
  ▼
interview_sessions
  │ 1:N
  ▼
interview_messages

interview_sessions.metadata (JSONB)
  ├── mode: "tech" | "behavioral"
  ├── target_role: str
  ├── question_count: int
  ├── overall_score: float
  ├── overall_feedback: str
  └── question_scores: array of {question, score, feedback}
```

---

## Configuration

### Environment Variables

```bash
# Interview Agent Configuration
INTERVIEW_MODEL="gpt-4o-mini"              # Main conversation model
INTERVIEW_EVAL_MODEL="gpt-4o"            # Evaluation model
INTERVIEW_TEMPERATURE=0.7                 # Conversational temperature
INTERVIEW_EVAL_TEMPERATURE=0.3           # Evaluation temperature
INTERVIEW_MAX_TOKENS=2000                 # Max response tokens
INTERVIEW_DEFAULT_NUM_QUESTIONS=5         # Default questions per session
INTERVIEW_MAX_SESSION_DURATION_MINUTES=60 # Max session length
```

### Config Structure

```python
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
    
    # Question bank paths
    tech_questions_path: str = "prompts/tech_question_bank.yaml"
    behavioral_questions_path: str = "prompts/behavioral_question_bank.yaml"
    
    class Config:
        env_prefix = "INTERVIEW_"
```

---

## Security & Privacy

### Authentication
- All endpoints require JWT authentication
- User can only access their own sessions
- Admin can view all sessions (audit capability)

### Data Isolation
```python
# Repository enforces user ownership
async def get_session(self, session_id: str, user_id: str):
    return await db.execute(
        select(InterviewSession)
        .where(InterviewSession.id == session_id)
        .where(InterviewSession.user_id == user_id)
    )
```

### Privacy Considerations
- Interview content contains sensitive career information
- All messages encrypted at rest in PostgreSQL
- Audio files stored securely in MinIO/S3 (future)
- No data sharing with third-party LLM providers for training

---

## Monitoring & Observability

### Metrics to Track
- Session creation rate
- Average session duration
- Average questions per session
- Average scores (by mode, by experience level)
- Completion rate (sessions finished vs abandoned)

### Logging
- Structured logs for all agent calls
- Evaluation results with scores
- Errors and failures with context
- Performance metrics (LLM latency, token usage)

---

## Deployment Considerations

### Scalability
- Stateless API servers (FastAPI)
- Connection pooling for PostgreSQL
- Async LLM calls for non-blocking operations
- SSE connections can be long-lived — ensure proper timeout handling

### Resource Requirements
- **CPU**: High during LLM inference
- **Memory**: Moderate for agent context + message history
- **Database**: PostgreSQL with connection pooling
- **LLM API**: External service dependency (OpenAI, Anthropic, etc.)

### High Availability
- Graceful degradation if LLM API fails
- Retry logic with exponential backoff
- Circuit breaker pattern for external services

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| API | FastAPI + Python | Async web framework |
| Agents | LangChain + Python | Agent orchestration |
| LLM | OpenAI GPT-4o / Anthropic Claude | AI conversations |
| Database | PostgreSQL + SQLAlchemy | Data persistence |
| Streaming | Server-Sent Events (SSE) | Real-time chat |
| Frontend | Next.js + TypeScript | User interface |
| Future Voice | Web Speech API / Whisper STT | Voice I/O |

---

## Related Documentation

- [API Specification](./interview-api-spec.md) - Detailed API endpoints
- [Database Schema](./interview-database-schema.md) - Database design
- [Evaluation System](./interview-evaluation.md) - Scoring and feedback
- [Voice Integration Plan](./interview-voice-roadmap.md) - Future voice features
- [Deployment Guide](./interview-deployment.md) - Production setup
