# Interview Agent Skeleton

## 🎯 Overview

Complete skeleton structure for TalentPulse Interview Agent — a separate, isolated agent system for interview practice via conversational chatbot.

**Status:** ✅ Skeleton complete (26 files created). Ready for implementation.

---

## 📁 Directory Structure

```
app/services/interview_agent/
├── __init__.py                      # Package exports
├── SKELETON.md                      # This file
│
├── config/                          # Configuration (YAML + env vars)
│   ├── __init__.py                  # YAML loader with ${ENV_VAR} substitution
│   └── interview_agent.yaml         # LLM, voice, storage config
│
├── middleware/                      # Context injection (@before_model)
│   ├── __init__.py
│   └── interview_context.py        # InterviewContext dataclass + inject functions
│
├── services/                        # Core services
│   ├── __init__.py
│   ├── llm_factory.py               # LLM factory (interview + evaluation models)
│   ├── stt_service.py              # Speech-to-Text service stub (future)
│   └── tts_service.py              # Text-to-Speech service stub (future)
│
├── prompts/                         # System prompts
│   ├── __init__.py
│   ├── tech_prompts.py              # Technical interview system prompts
│   └── behavioral_prompts.py        # Behavioral interview + STAR coaching prompts
│
├── chains/                          # LangChain agent wiring
│   ├── __init__.py
│   ├── tech_interview_chain.py      # Technical interview agent
│   └── behavioral_interview_chain.py # Behavioral interview agent
│
├── tools/                           # LangChain tools (empty for now)
│   └── __init__.py                  # Reserved for future tools
│
├── models/                          # Pydantic schemas
│   ├── __init__.py
│   └── schemas.py                   # All request/response models
│
├── evaluation/                      # Evaluation services
│   ├── __init__.py
│   ├── evaluator.py                 # Answer evaluators (tech + behavioral)
│   └── summarizer.py                # Session summary generator
│
├── storage/                         # Database operations
│   ├── __init__.py
│   ├── session_store.py             # InterviewSession CRUD
│   └── message_store.py             # InterviewMessage CRUD
│
├── api/                             # FastAPI endpoints
│   ├── __init__.py
│   └── interview_router.py          # All /api/interview/* endpoints with SSE
│
└── knowledge/                       # YAML knowledge bases
    └── __init__.py                  # Reserved for future question banks
```

---

## 📝 Files Created (26 total)

### Core (5 files)
1. ✅ `__init__.py` - Package exports (interview_router, InterviewContext)
2. ✅ `config/__init__.py` - YAML config loader with ${ENV_VAR} substitution
3. ✅ `config/interview_agent.yaml` - LLM (gpt-4o-mini), evaluation (gpt-4o), voice config
4. ✅ `middleware/__init__.py` - Middleware exports
5. ✅ `middleware/interview_context.py` - InterviewContext + inject_user_profile/interview_context

### Services (4 files)
6. ✅ `services/__init__.py` - Service exports
7. ✅ `services/llm_factory.py` - create_interview_llm(), create_evaluation_llm()
8. ✅ `services/stt_service.py` - transcribe_audio() stub (future voice)
9. ✅ `services/tts_service.py` - synthesize_speech() stub (future voice)

### Prompts (3 files)
10. ✅ `prompts/__init__.py` - Prompt exports
11. ✅ `prompts/tech_prompts.py` - TECH_INTERVIEWER_SYSTEM + follow-ups + feedback templates
12. ✅ `prompts/behavioral_prompts.py` - BEHAVIORAL_INTERVIEWER_SYSTEM + STAR coaching + questions

### Chains (3 files)
13. ✅ `chains/__init__.py` - Chain exports
14. ✅ `chains/tech_interview_chain.py` - get_tech_interview_agent()
15. ✅ `chains/behavioral_interview_chain.py` - get_behavioral_interview_agent()

### Tools (1 file)
16. ✅ `tools/__init__.py` - Empty (interviews don't need tools, just conversation)

### Models (2 files)
17. ✅ `models/__init__.py` - Schema exports
18. ✅ `models/schemas.py` - All Pydantic models (Request/Response + SSE events)

### Evaluation (3 files)
19. ✅ `evaluation/__init__.py` - Evaluation exports
20. ✅ `evaluation/evaluator.py` - evaluate_tech_answer(), evaluate_behavioral_answer()
21. ✅ `evaluation/summarizer.py` - generate_session_summary()

### Storage (3 files)
22. ✅ `storage/__init__.py` - Storage exports
23. ✅ `storage/session_store.py` - create_session(), get_session(), update_session(), list_user_sessions()
24. ✅ `storage/message_store.py` - create_message(), get_session_messages(), create_message_batch()

### API (2 files)
25. ✅ `api/__init__.py` - API exports
26. ✅ `api/interview_router.py` - All endpoints (POST /sessions, POST /messages, POST /complete, DELETE)

### Knowledge (1 file)
27. ✅ `knowledge/__init__.py` - Reserved for YAML question banks

---

## 🚀 Next Steps (Implementation Order)

### Phase 1: Database Models (1-2 hours) ⏳
1. ⏳ Create `app/models/interview.py` with InterviewSession, InterviewMessage
2. ⏳ Create Alembic migration: `012_create_interview_tables.py`
3. ⏳ Test: Run migration, verify tables created

### Phase 2: Include Router (30 minutes) ⏳
1. ⏳ Add to `app/main.py`:
   ```python
   from app.services.interview_agent import interview_router
   app.include_router(interview_router)
   ```
2. ⏳ Test: Visit `/docs`, see /api/interview/* endpoints

### Phase 3: Agent Integration (4-6 hours) ⏳
1. ⏳ Implement `_generate_agent_response()` in `interview_router.py`
2. ⏳ Connect LangChain agents from `chains/`
3. ⏳ Test conversation flow: create session → send message → receive response
4. ⏳ Verify middleware injects profile/context

### Phase 4: Evaluation Integration (3-4 hours) ⏳
1. ⏳ Call evaluator after each answer (optional feature)
2. ⏳ Integrate summarizer on session completion
3. ⏳ Store evaluation results in session.overall_score, feedback
4. ⏳ Test scoring quality with sample sessions

### Phase 5: Frontend Integration (separate task) ⏳
1. ⏳ Rewrite `/app/interview/page.tsx` for new endpoints
2. ⏳ Implement SSE client for streaming
3. ⏳ Add voice controls (future)

---

## 🔗 Key Patterns Used (from existing agent)

### 1. Config Pattern with Env Var Substitution
```python
# config/__init__.py
@lru_cache
def load_config() -> dict:
    raw = re.sub(r"\$\{(\w+)\}", _resolve, yaml.safe_load(...))
    return yaml.safe_load(raw)

# Usage:
cfg["llm"]["model"]  # Resolves ${INTERVIEW_MODEL:-gpt-4o-mini}
```

### 2. Middleware Pattern with @before_model
```python
# middleware/interview_context.py
@before_model
def inject_user_profile(state, runtime: Runtime):
    if runtime.context and runtime.context.profile:
        return {"messages": [SystemMessage(content=_format_profile(...))]}
```

### 3. Agent Factory Pattern
```python
# chains/tech_interview_chain.py
def get_tech_interview_agent(context: InterviewContext):
    llm = create_interview_llm()
    return create_agent(
        model=llm,
        system_prompt=TECH_INTERVIEWER_SYSTEM.format(target_role=...),
        middleware=[inject_user_profile, inject_interview_context],
        context_schema=InterviewContext,
    )
```

### 4. SSE Streaming Pattern
```python
# api/interview_router.py
async def event_generator():
    for token in response:
        yield SSETokenEvent(content=token).model_dump_json()
    yield SESEndEvent(message=...).model_dump_json()

return EventSourceResponse(event_generator())
```

### 5. SQLAlchemy Async Pattern
```python
# storage/session_store.py
async with async_session_factory() as db_sess:
    session = InterviewSession(...)
    db_sess.add(session)
    await db_sess.commit()
    await db_sess.refresh(session)
```

---

## 📦 Dependencies

### Already in Project ✅
- FastAPI
- SQLAlchemy (async)
- LangChain
- LangChain OpenAI
- Pydantic
- sse-starlette
- PyYAML

### Need to Verify ❓
- UUID support in models (sqlalchemy.dialects.postgresql.UUID)
- Interview model definitions (need to create `app/models/interview.py`)
- get_current_user dependency (app.api.dependencies)

---

## 🧪 Quick Testing

```bash
# 1. Test import
python -c "from app.services.interview_agent import interview_router, InterviewContext; print('✅ Import OK')"

# 2. Test config load
python -c "from app.services.interview_agent.config import cfg; print(f'✅ Config: {cfg[\"llm\"][\"model\"]}')"

# 3. Test LLM factory
python -c "from app.services.interview_agent.services import create_interview_llm; llm = create_interview_llm(); print(f'✅ LLM: {llm.model_name}')"

# 4. Test database (after migration)
python -c "from app.services.interview_agent.storage import create_session; print('✅ Storage ready')"

# 5. Test API (after including router)
curl -X POST http://localhost:8000/api/interview/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "behavioral", "target_role": "Backend Engineer", "num_questions": 5}'
```

---

## 🎯 Success Criteria

### Completed ✅
- [x] All 26 files created
- [x] Follows existing agent patterns (config, middleware, chains)
- [x] OOP structure (factory, middleware, dataclass, base classes)
- [x] Ready for LangChain integration
- [x] SSE streaming architecture
- [x] Voice-ready (STT/TTS stubs in place)
- [x] Separation of concerns (api/, evaluation/, storage/, chains/)

### Ready for Implementation ⏳
- [ ] Database models + migration
- [ ] Agent LLM integration
- [ ] Evaluation integration
- [ ] Frontend connection

---

## 📞 Reference Documentation

- **Architecture:** `/d/TalentPulse/dashboard/backend/docs/interview-architecture.md`
- **API Spec:** `/d/TalentPulse/dashboard/backend/docs/interview-api-spec.md`
- **Database:** `/d/TalentPulse/dashboard/backend/docs/interview-database-schema.md`
- **Evaluation:** `/d/TalentPulse/dashboard/backend/docs/interview-evaluation.md`
- **Deployment:** `/d/TalentPulse/dashboard/backend/docs/interview-deployment.md`
- **System Design:** `/d/TalentPulse/dashboard/backend/docs/interview-system-design.md`
- **Voice Roadmap:** `/d/TalentPulse/dashboard/backend/docs/interview-voice-roadmap.md`

---

## 🔍 Files to Modify for Integration

### Backend (3 files)
1. **`app/main.py`** - Include interview_router
2. **`alembic/versions/`** - Create migration for interview tables
3. **`app/models/interview.py`** - Create database models (NEW file)

### Frontend (2 files)
1. **`app/interview/page.tsx`** - Rewrite for new endpoints
2. **`lib/api.ts`** - Add interview types

---

**Created:** 2026-05-30
**Status:** ✅ Skeleton Complete
**Next:** Create database models + migration
