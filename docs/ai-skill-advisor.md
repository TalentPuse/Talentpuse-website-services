# AI Career Skill Advisor — Ngành AI (GenAI vs ML)

## Mục tiêu

Feature AI Assistant recommend top 5 skills nên học cho ngành AI, chia 2 hướng:
1. **GenAI/Applied AI** — RAG, Prompt Engineering, LangChain, Vector DB, Agents
2. **Machine Learning thuần** — Toán, PyTorch, TensorFlow, Model Training, MLOps

Dựa trên: profile user (skills, target roles, level) + dữ liệu thị trường thực tế từ data warehouse.

## Architecture: Data + AI (Hybrid)

```
User: "Muốn làm ngành AI, nên học gì?"
  │
  ├─ 1. SQL Query: Top AI skills từ market data
  │     - Filter: jobs có category AI/ML/Deep Learning/NLP
  │     - Phân loại: GenAI skills vs ML skills
  │     - Loại skills user đã có → gap analysis
  │
  ├─ 2. LLM (DeepSeek): Nhận data + user profile
  │     - Phân tích background → recommend hướng phù hợp
  │     - Top 5 skills + lý do + lộ trình học
  │
  └─ 3. Response: Track recommendation + 5 skill cards
```

### Tại sao Hybrid thay vì AI 100%?
- AI không biết chính xác market VN → hallucinate số liệu
- Data warehouse có 500K+ jobs → demand + salary chính xác
- Kết hợp: AI suy luận cá nhân hóa + data thực tế

## Data Available

### Job Market (Data Warehouse)
| Table | Dữ liệu |
|-------|---------|
| `dbt_dev_silver.silver_skill_long` | Skills per job, normalized, có weight |
| `dbt_dev_gold.fct_jobs_daily` | Active jobs: title, category, level, salary |
| `dbt_dev_gold.mart_skill_demand` | Aggregated: skill → n_jobs, avg_salary |

### User Profile
| Field | Mô tả |
|-------|-------|
| `user.skills` | Skills hiện tại (từ CV/profile) |
| `user.desired_titles` | Target roles |
| `user.experience_level` | student / fresher / experienced / manager |

## AI Skill Taxonomy

### GenAI Track
```
prompt engineering, rag, langchain, llamaindex,
vector database, openai api, hugging face, agents,
fine-tuning, embedding, retrieval augmented generation,
lora, qlora, chain of thought, function calling,
crewai, autogen, semantic kernel, pinecone, weaviate,
chromadb, milvus, aws bedrock, azure openai
```

### ML Track
```
pytorch, tensorflow, keras, scikit-learn,
deep learning, neural network, computer vision,
nlp, natural language processing, reinforcement learning,
xgboost, lightgbm, convolutional neural network,
transformer, bert, random forest, gradient boosting,
bayesian, linear algebra, calculus, statistics, probability,
optimization, feature engineering, mlops, mlflow,
kubeflow, onnx, model training
```

## SQL Query — Skill Gap Analysis

```sql
-- Top skills demanded for AI jobs, user chưa có
SELECT
    sk.skill_name_norm AS skill,
    COUNT(DISTINCT sk.source_job_id) AS n_jobs,
    ROUND(AVG(f.salary_vnd_monthly_avg) / 1000000.0, 1) AS avg_salary_m
FROM dbt_dev_silver.silver_skill_long sk
JOIN dbt_dev_gold.fct_jobs_daily f
    ON f.source = sk.source AND f.source_job_id = sk.source_job_id
WHERE f.is_active = true
    AND (
        f.job_category ILIKE '%AI%'
        OR f.title ILIKE '%AI%'
        OR f.job_category ILIKE '%machine learning%'
        OR f.job_category ILIKE '%deep learning%'
        OR f.job_category ILIKE '%data scientist%'
        OR f.job_category ILIKE '%NLP%'
    )
GROUP BY sk.skill_name_norm
ORDER BY n_jobs DESC
```

Backend sẽ:
1. Chạy query trên
2. Phân loại mỗi skill vào GenAI hoặc ML bucket
3. Loại skills user đã có
4. Trả top 15 mỗi track cho LLM

## LLM Prompt — AI Career Advisor

```
Bạn là AI Career Advisor chuyên ngành AI tại Việt Nam.

Ngành AI chia 2 hướng chính:

1. GenAI/Applied AI: Ứng dụng LLM vào sản phẩm
   - RAG, Prompt Engineering, LangChain, Vector DB
   - Phù hợp: thích build product, giải quyết business problem

2. Machine Learning thuần: Nghiên cứu & training model
   - Toán: Linear Algebra, Calculus, Statistics
   - Framework: PyTorch, TensorFlow
   - Phù hợp: thích toán, nghiên cứu, hiểu sâu thuật toán

User profile:
- Skills hiện tại: {user.skills}
- Target: {user.desired_titles}
- Level: {user.experience_level}

Dữ liệu thị trường (skills hot, user CHƯA có):

GenAI track:
{top 15 genai gap skills + n_jobs + salary}

ML track:
{top 15 ml gap skills + n_jobs + salary}

Nhiệm vụ:
1. Phân tích background → suggest hướng phù hợp hơn
2. Recommend TOP 5 skills cho hướng đó
3. Mỗi skill: lý do, sức hút thị trường, lộ trình học

JSON format:
{
  "recommended_track": "genai" | "ml" | "both",
  "track_reason": "tại sao hướng này phù hợp",
  "recommendations": [
    {
      "rank": 1,
      "skill": "string",
      "category": "genai" | "ml",
      "reason": "tại sao nên học",
      "market_demand": "e.g. 150 jobs, avg 28M VND",
      "learning_path": "lộ trình 2-3 bước",
      "priority": "must_have" | "should_have" | "nice_to_have"
    }
  ]
}
```

## API

### POST /api/chat

```
Request:
{
  "message": "Muốn làm AI Engineer nên học gì?"
}

Response:
{
  "reply": "Dựa vào background của bạn với Python và SQL, tôi recommend hướng GenAI...",
  "recommendations": {
    "recommended_track": "genai",
    "track_reason": "Với background Python + SQL, GenAI track phù hợp vì...",
    "recommendations": [
      {
        "rank": 1,
        "skill": "Prompt Engineering",
        "category": "genai",
        "reason": "Foundation skill cho mọi ứng dụng LLM",
        "market_demand": "120 jobs, avg 25M VND",
        "learning_path": "1. Học basic prompting → 2. Chain of thought → 3. Function calling",
        "priority": "must_have"
      },
      ...
    ]
  }
}
```

## Files to Create/Modify

### Backend
| File | Action | Mô tả |
|------|--------|-------|
| `app/services/skill_advisor.py` | CREATE | Skill taxonomy, SQL gap analysis, LLM advisor |
| `app/api/chat.py` | CREATE | POST /api/chat endpoint |
| `app/main.py` | EDIT | Register chat router |

### Frontend
| File | Action | Mô tả |
|------|--------|-------|
| `lib/api.ts` | EDIT | Chat API types + function |
| `lib/chat-types.ts` | EDIT | Add skills message type |
| `components/chat/SkillCard.tsx` | CREATE | Skill recommendation card UI |
| `components/chat/ChatBubble.tsx` | EDIT | Render skills message type |
| `app/assistant/page.tsx` | EDIT | Connect to real API |

## Reuse Existing Code
- `get_current_user` (`app/core/security.py`) — auth
- `OpenAI` client pattern (`app/services/cv_parser.py`) — LLM calls
- `fct_jobs_daily`, `silver_skill_long` (`app/models/analytics.py`) — SQL tables
- `ChatWindow`, `ChatBubble` — existing chat components

## Verification
1. SQL query returns real AI skill demand data
2. LLM generates track recommendation + top 5 based on real data
3. Frontend: "nên học gì để làm AI" → track banner + 5 skill cards
4. Each card: demand, reason, learning path, priority
