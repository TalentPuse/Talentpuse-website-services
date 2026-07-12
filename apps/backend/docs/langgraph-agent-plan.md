# Plan: LangGraph AI Agent — Skill Advisor cho Ngành AI

## Context
Build AI Assistant dùng **LangGraph** (orchestration) + **LangChain** (LLM/tools) thay vì raw OpenAI calls. Agent recommend top 5 skills cho ngành AI (GenAI vs ML). Config lưu trong `.yaml`, architecture chuẩn scale.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  YAML Config                     │
│  (model, prompts, taxonomy, memory settings)    │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│              LangGraph StateGraph                │
│                                                  │
│  START → classify_intent                         │
│            ├─ "skill" → query_skill_gap          │
│            │             → generate_skill_resp   │
│            │             → END                   │
│            └─ "general" → generate_general_resp  │
│                            → END                 │
│                                                  │
│  Tools: query_ai_skill_market, get_user_profile  │
│  Memory: PostgresSaver (conversation history)    │
└──────────────────────────────────────────────────┘
```

## Files to Create/Modify

### Backend (NEW — separate agent module)

```
backend/app/
├── agent/                          # NEW: LangGraph agent module
│   ├── __init__.py
│   ├── config.yaml                 # NEW: all agent configuration
│   ├── loader.py                   # NEW: load YAML config → dataclass
│   ├── state.py                    # NEW: AgentState TypedDict
│   ├── tools.py                    # NEW: @tool functions (SQL queries)
│   ├── nodes.py                    # NEW: graph node functions
│   ├── graph.py                    # NEW: StateGraph build + compile
│   └── prompts.py                  # NEW: system prompt templates
├── api/
│   └── chat.py                     # NEW: POST /api/chat endpoint
├── main.py                         # EDIT: register chat.router
└── requirements.txt                # EDIT: add langgraph, langchain deps
```

---

## Step 1: `agent/config.yaml` — Configuration

```yaml
# ─── Model ───
model:
  provider: "openai"                          # openai | anthropic
  name: "deepseek/deepseek-v4-pro"
  base_url: "https://openrouter.ai/api/v1"
  temperature: 0.7
  max_tokens: 2048
  timeout: 120

# ─── Memory ───
memory:
  checkpointer: "postgres"                    # postgres | memory
  max_conversation_turns: 20

# ─── Intent Classification ───
intent:
  skill_keywords:
    - "gợi ý skill"
    - "nên học"
    - "skill hot"
    - "recommend"
    - "ngành ai"
    - "genai"
    - "machine learning"
    - "hướng nào"
    - "top skill"
    - "lộ trình học"
    - "career path"

# ─── Skill Advisor ───
skill_advisor:
  top_skills_per_track: 15
  ai_job_filters:
    - "AI Engineer"
    - "Machine Learning"
    - "Deep Learning"
    - "Data Scientist"
    - "NLP"
  tracks:
    genai:
      label: "GenAI / Applied AI"
      description: "Ứng dụng LLM vào sản phẩm — RAG, Prompt Engineering, Agents"
      skills:
        - "prompt engineering"
        - "rag"
        - "langchain"
        - "llamaindex"
        - "vector database"
        - "openai api"
        - "hugging face"
        - "agents"
        - "fine-tuning"
        - "embedding"
        - "retrieval augmented generation"
        - "lora"
        - "chain of thought"
        - "function calling"
        - "crewai"
        - "autogen"
        - "semantic kernel"
        - "pinecone"
        - "weaviate"
        - "chromadb"
        - "milvus"
        - "aws bedrock"
        - "azure openai"
    ml:
      label: "Machine Learning thuần"
      description: "Nghiên cứu & training model — Toán, PyTorch, MLOps"
      skills:
        - "pytorch"
        - "tensorflow"
        - "keras"
        - "scikit-learn"
        - "deep learning"
        - "neural network"
        - "computer vision"
        - "nlp"
        - "reinforcement learning"
        - "xgboost"
        - "lightgbm"
        - "transformer"
        - "bert"
        - "random forest"
        - "gradient boosting"
        - "bayesian"
        - "linear algebra"
        - "calculus"
        - "statistics"
        - "optimization"
        - "feature engineering"
        - "mlops"
        - "mlflow"
        - "model training"

# ─── Prompts ───
prompts:
  system: |
    Bạn là AI Career Advisor của TalentPulse, chuyên tư vấn ngành AI tại Việt Nam.
    
    Trả lời bằng tiếng Việt. Ngắn gọn, actionable, data-driven.

  skill_recommendation: |
    Ngành AI chia 2 hướng:
    
    1. **GenAI/Applied AI**: RAG, Prompt Engineering, LangChain, Vector DB, Agents
       Phù hợp: thích build product, giải quyết business problem
    
    2. **Machine Learning thuần**: Toán, PyTorch, TensorFlow, Model Training, MLOps  
       Phù hợp: thích toán, nghiên cứu, hiểu sâu thuật toán
    
    User profile: {user_profile}
    
    Dữ liệu thị trường (skills hot, user CHƯA có):
    
    GenAI track:
    {genai_data}
    
    ML track:
    {ml_data}
    
    Nhiệm vụ:
    1. Dựa background → suggest hướng phù hợp hơn
    2. Recommend TOP 5 skills cho hướng đó
    3. Mỗi skill: lý do, sức hút thị trường, lộ trình học
    
    JSON format:
    {{
      "recommended_track": "genai" | "ml" | "both",
      "track_reason": "tại sao phù hợp",
      "recommendations": [
        {{
          "rank": 1,
          "skill": "string",
          "category": "genai" | "ml",
          "reason": "tại sao nên học",
          "market_demand": "e.g. 150 jobs, avg 28M VND",
          "learning_path": "lộ trình 2-3 bước",
          "priority": "must_have" | "should_have" | "nice_to_have"
        }}
      ]
    }}
```

## Step 2: `agent/loader.py` — Config Loader

```python
from dataclasses import dataclass, field
from pathlib import Path
import yaml

@dataclass
class ModelConfig:
    provider: str = "openai"
    name: str = "deepseek/deepseek-v4-pro"
    base_url: str = "https://openrouter.ai/api/v1"
    temperature: float = 0.7
    max_tokens: int = 2048
    timeout: int = 120

@dataclass
class MemoryConfig:
    checkpointer: str = "postgres"
    max_conversation_turns: int = 20

@dataclass
class TrackConfig:
    label: str = ""
    description: str = ""
    skills: list[str] = field(default_factory=list)

@dataclass
class SkillAdvisorConfig:
    top_skills_per_track: int = 15
    ai_job_filters: list[str] = field(default_factory=list)
    tracks: dict[str, TrackConfig] = field(default_factory=dict)

@dataclass
class AgentConfig:
    model: ModelConfig = field(default_factory=ModelConfig)
    memory: MemoryConfig = field(default_factory=MemoryConfig)
    skill_advisor: SkillAdvisorConfig = field(default_factory=SkillAdvisorConfig)
    intent: dict = field(default_factory=dict)
    prompts: dict = field(default_factory=dict)

_config: AgentConfig | None = None

def load_config() -> AgentConfig:
    global _config
    if _config:
        return _config
    path = Path(__file__).parent / "config.yaml"
    with open(path) as f:
        raw = yaml.safe_load(f)
    _config = AgentConfig(
        model=ModelConfig(**raw.get("model", {})),
        memory=MemoryConfig(**raw.get("memory", {})),
        skill_advisor=SkillAdvisorConfig(
            **{k: v for k, v in raw.get("skill_advisor", {}).items() if k != "tracks"},
            tracks={k: TrackConfig(**v) for k, v in raw.get("skill_advisor", {}).get("tracks", {}).items()},
        ),
        intent=raw.get("intent", {}),
        prompts=raw.get("prompts", {}),
    )
    return _config
```

## Step 3: `agent/state.py` — Agent State

```python
from typing import TypedDict, Annotated
from langgraph.graph import add_messages

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]      # conversation history
    user_profile: dict                            # skills, titles, level
    intent: str | None                            # "skill" | "general"
    skill_gap_data: dict | None                   # SQL query results
    recommendations: dict | None                  # LLM structured output
```

## Step 4: `agent/tools.py` — LangChain Tools

```python
from langchain_core.tools import tool

@tool
async def query_ai_skill_market(
    target_titles: list[str],
    user_skills: list[str],
    db_session,          # injected via graph config
) -> dict:
    """Query top AI skills from data warehouse, split by GenAI/ML tracks,
    excluding skills user already has. Returns {genai: [...], ml: [...]}."""
    # SQL against silver_skill_long + fct_jobs_daily
    # Classify each skill into genai/ml bucket using taxonomy
    # Filter out user's existing skills
    # Return top N per track with n_jobs + avg_salary

@tool
async def get_user_profile(user_id: str, db_session) -> dict:
    """Get user profile: skills, desired_titles, experience_level."""
    # Query app.users
```

## Step 5: `agent/nodes.py` — Graph Nodes

```python
# Node 1: Classify intent
async def classify_intent(state: AgentState) -> dict:
    # Check last user message against intent.skill_keywords from config
    # Return {"intent": "skill"} or {"intent": "general"}

# Node 2: Query skill gap data
async def query_skill_gap(state: AgentState) -> dict:
    # Call query_ai_skill_market tool
    # Return {"skill_gap_data": {...}}

# Node 3: Generate skill recommendation
async def generate_skill_response(state: AgentState) -> dict:
    # Build prompt from config.prompts.skill_recommendation
    # Inject user_profile + skill_gap_data
    # Call LLM with JSON response format
    # Parse structured output
    # Return {"recommendations": {...}, "messages": [AIMessage]}

# Node 4: Generate general response
async def generate_general_response(state: AgentState) -> dict:
    # Build prompt from config.prompts.system + user context
    # Call LLM
    # Return {"messages": [AIMessage]}

# Router
def route_by_intent(state: AgentState) -> str:
    if state["intent"] == "skill":
        return "query_skill_gap"
    return "generate_general_response"
```

## Step 6: `agent/graph.py` — Build & Compile

```python
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
from langchain_openai import ChatOpenAI

def build_agent(config: AgentConfig) -> CompiledGraph:
    graph = StateGraph(AgentState)
    
    # Nodes
    graph.add_node("classify_intent", classify_intent)
    graph.add_node("query_skill_gap", query_skill_gap)
    graph.add_node("generate_skill_response", generate_skill_response)
    graph.add_node("generate_general_response", generate_general_response)
    
    # Edges
    graph.add_edge(START, "classify_intent")
    graph.add_conditional_edges("classify_intent", route_by_intent)
    graph.add_edge("query_skill_gap", "generate_skill_response")
    graph.add_edge("generate_skill_response", END)
    graph.add_edge("generate_general_response", END)
    
    # Checkpointer (Postgres — reuse existing DB)
    checkpointer = PostgresSaver.from_conn_string(DATABASE_URL)
    
    return graph.compile(
        checkpointer=checkpointer,
        name="talentpulse-skill-advisor",
    )
```

## Step 7: `api/chat.py` — API Endpoint

```python
from fastapi import APIRouter, Depends
from langchain_core.messages import HumanMessage

router = APIRouter(prefix="/api/chat", tags=["chat"])

@router.post("")
async def chat(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = get_agent()  # singleton compiled graph
    
    config = {
        "configurable": {
            "thread_id": str(current_user.id),  # per-user conversation
        },
        "db_session": db,
        "user_profile": {
            "skills": current_user.skills,
            "desired_titles": current_user.desired_titles,
            "experience_level": current_user.experience_level,
        },
    }
    
    result = await agent.ainvoke(
        {"messages": [HumanMessage(content=body.message)]},
        config=config,
    )
    
    # Extract last AI message + recommendations
    return ChatResponse(
        reply=last_ai_message,
        recommendations=result.get("recommendations"),
    )
```

## Step 8: `main.py` — Register

```python
from app.api import chat
app.include_router(chat.router)
```

## Step 9: `requirements.txt` — Add Dependencies

```
langgraph>=1.0
langchain>=1.0
langchain-core>=1.0
langchain-openai>=0.1.0
langsmith>=0.3.0
pyyaml>=6.0
```

## Step 10: Frontend Changes

(Same as previous plan)
- `lib/api.ts` — add ChatResponse types + assistantApi
- `lib/chat-types.ts` — add SkillCard type
- `components/chat/SkillCard.tsx` — new component
- `components/chat/ChatBubble.tsx` — render skills type
- `app/assistant/page.tsx` — connect to POST /api/chat

## Scalability Notes

| Concern | Solution |
|---------|----------|
| New career tracks | Add to `config.yaml` tracks section — no code change |
| New intents (CV review, salary advice) | Add node + conditional edge in graph |
| Multiple LLM providers | Change `model.provider` in YAML, loader handles rest |
| Conversation memory | PostgresSaver — persists across restarts |
| Rate limiting | Add FastAPI middleware on /api/chat |
| Streaming | Use `agent.astream_events()` for real-time tokens |
| Monitoring | LangSmith integration via `LANGCHAIN_TRACING_V2` env var |

## Verification
1. `pip install -r requirements.txt` — deps install
2. Agent compiles: graph builds without errors
3. POST /api/chat with AI keyword → triggers skill recommendation flow
4. POST /api/chat with general message → triggers general chat flow
5. YAML config loads correctly, tracks taxonomy works
6. Conversation memory persists across requests (same thread_id)
