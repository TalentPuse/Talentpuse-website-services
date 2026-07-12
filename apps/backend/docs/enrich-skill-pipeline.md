# Plan: Enrich Skill Data Pipeline — Extract Skills từ Job Descriptions

## Context

Hiện tại `silver_skill_long` chỉ chứa skills từ structured tags của job boards (VietnamWorks API tags, ITviec comma-separated). **Full text** trong `job_description_text` và `job_requirement_text` đã lưu trong warehouse nhưng **hoàn toàn không dùng** để extract skills.

Mục tiêu: Build pipeline dùng LLM extract skills từ job descriptions → enrich warehouse → foundation cho AI agent sau.

## Gap Analysis

```
CÓ:
  ✓ silver_skill_long — structured tags (limited)
  ✓ silver_job_detail.job_description_text — full text, đã lưu
  ✓ silver_job_detail.job_requirement_text — requirements section
  ✓ normalization.skill_synonym table — schema + 120+ mappings sẵn
  ✓ LLM infrastructure — OpenAI client, DeepSeek model, đã config

THIẾU:
  ✗ LLM-based skill extraction từ job descriptions
  ✗ Skill taxonomy (categorization: language, framework, tool, platform, soft skill)
  ✗ Skill dedup + canonical mapping across sources
  ✗ Skill co-occurrence matrix (skills thường xuất hiện cùng nhau)
  ✗ Skill demand trends over time
```

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                 Pipeline Flow                         │
│                                                       │
│  silver_job_detail (job_description_text)             │
│       │                                               │
│       ▼                                               │
│  [LLM Skill Extractor] ← config.yaml                 │
│       │                                               │
│       ▼                                               │
│  silver_skill_enriched (NEW)                          │
│       │                                               │
│       ├─► normalization via skill_synonym             │
│       │                                               │
│       ▼                                               │
│  gold.mart_skill_demand_enriched (NEW)                │
│  gold.mart_skill_cooccurrence (NEW)                   │
│  gold.mart_skill_trend (NEW)                          │
└──────────────────────────────────────────────────────┘
```

## Step 1: Config — `pipeline_data/configs/skill_extraction.yaml`

```yaml
# ─── LLM Config ───
llm:
  model: "deepseek/deepseek-v4-flash"        # flash cho batch processing (rẻ + nhanh)
  base_url: "https://openrouter.ai/api/v1"
  max_concurrent: 5                            # parallel requests
  batch_size: 50                               # jobs per batch
  timeout: 60

# ─── Extraction Config ───
extraction:
  # Chỉ extract jobs chưa xử lý (incremental)
  source_tables:
    - "dbt_dev_silver.silver_job_detail"
  # Field chứa text cần extract
  text_fields:
    - "job_description_text"
    - "job_requirement_text"
  # Output table
  output_table: "dbt_dev_silver.silver_skill_enriched"
  # Track processed jobs
  processed_tracking: true

# ─── Skill Categories (Taxonomy) ───
taxonomy:
  programming_languages:
    - "python"
    - "java"
    - "javascript"
    - "typescript"
    - "go"
    - "rust"
    - "c++"
    - "c#"
    - "r"
    - "scala"
    - "kotlin"
    - "swift"
    - "ruby"
    - "php"
    - "sql"

  frameworks_libraries:
    - "pytorch"
    - "tensorflow"
    - "keras"
    - "scikit-learn"
    - "pandas"
    - "numpy"
    - "spring"
    - "react"
    - "vue"
    - "django"
    - "flask"
    - "fastapi"
    - "langchain"
    - "llamaindex"
    - "streamlit"
    - "next.js"

  cloud_platforms:
    - "aws"
    - "azure"
    - "gcp"
    - "aws bedrock"
    - "azure openai"
    - "aws sageaker"

  databases:
    - "postgresql"
    - "mysql"
    - "mongodb"
    - "redis"
    - "elasticsearch"
    - "cassandra"
    - "dynamodb"
    - "snowflake"
    - "bigquery"

  devops_tools:
    - "docker"
    - "kubernetes"
    - "jenkins"
    - "gitlab ci"
    - "github actions"
    - "terraform"
    - "ansible"
    - "prometheus"
    - "grafana"

  data_engineering:
    - "apache spark"
    - "apache kafka"
    - "apache airflow"
    - "dbt"
    - "snowflake"
    - "databricks"
    - "etl"
    - "data pipeline"

  ai_ml:
    - "machine learning"
    - "deep learning"
    - "nlp"
    - "computer vision"
    - "reinforcement learning"
    - "recommendation system"
    - "llm"
    - "generative ai"
    - "rag"
    - "prompt engineering"
    - "fine-tuning"
    - "embedding"
    - "vector database"
    - "agents"
    - "mlops"
    - "mlflow"
    - "model training"

  soft_skills:
    - "communication"
    - "problem solving"
    - "teamwork"
    - "leadership"
    - "analytical thinking"
    - "project management"

# ─── LLM Prompt ───
prompt:
  system: |
    Bạn là HR data analyst. Trích xuất skills từ job description.
    
    Quy tắc:
    - Trích xuất TẤT CẢ skills/technologies/tools được mention (explicit + implicit)
    - Normalize: lowercase, bỏ version numbers (Python 3.10 → python)
    - Phân loại mỗi skill vào 1 category từ taxonomy
    - Đánh giá importance: "required" = bắt buộc, "preferred" = plus, "mentioned" = chỉ nhắc
    - confidence: "high" = ghi rõ requirement, "medium" = infer từ context, "low" = đoán
    - Chỉ trả JSON
    
  schema: |
    {
      "skills": [
        {
          "name": "string — normalized lowercase",
          "name_raw": "string — original text",
          "category": "programming_languages|frameworks_libraries|cloud_platforms|databases|devops_tools|data_engineering|ai_ml|soft_skills|other",
          "importance": "required|preferred|mentioned",
          "confidence": "high|medium|low"
        }
      ],
      "experience_years_min": "int|null",
      "seniority_level": "string|null"
    }
```

## Step 2: Skill Extractor Script — `pipeline_data/src/skill_extractor.py`

```python
"""
LLM-based skill extraction from job descriptions.
Incremental: only processes new/updated jobs.
Batch processing with concurrency control.
"""
import asyncio
import json
import logging
from dataclasses import dataclass
from pathlib import Path

import yaml
import asyncpg
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

@dataclass
class ExtractedSkill:
    name: str
    name_raw: str
    category: str
    importance: str
    confidence: str

@dataclass
class ExtractionResult:
    source: str
    source_job_id: str
    skills: list[ExtractedSkill]
    experience_years_min: int | None
    seniority_level: str | None

class SkillExtractor:
    def __init__(self, config_path: str):
        self.config = self._load_config(config_path)
        self.client = AsyncOpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=self.config["llm"]["base_url"],
        )
        self.semaphore = asyncio.Semaphore(self.config["llm"]["max_concurrent"])

    async def extract_skills(self, text: str) -> list[ExtractedSkill]:
        """Extract skills from a single job description text."""
        async with self.semaphore:
            response = await self.client.chat.completions.create(
                model=self.config["llm"]["model"],
                messages=[
                    {"role": "system", "content": self.config["prompt"]["system"]},
                    {"role": "user", "content": f"Phân tích job description:\n\n{text[:3000]}"},
                ],
                temperature=0,
                response_format={"type": "json_object"},
                timeout=self.config["llm"]["timeout"],
            )
            data = json.loads(response.choices[0].message.content)
            return [ExtractedSkill(**s) for s in data.get("skills", [])]

    async def process_batch(self, jobs: list[dict]) -> list[ExtractionResult]:
        """Process a batch of jobs concurrently."""
        tasks = [self._process_one(job) for job in jobs]
        return await asyncio.gather(*tasks, return_exceptions=True)

    async def run_incremental(self, pool: asyncpg.Pool):
        """Process only jobs not yet in silver_skill_enriched."""
        # 1. Query jobs not yet processed
        # 2. Batch process
        # 3. INSERT INTO silver_skill_enriched
        # 4. Track progress
        ...
```

## Step 3: New Silver Table — `silver_skill_enriched`

```sql
CREATE TABLE IF NOT EXISTS dbt_dev_silver.silver_skill_enriched (
    source          VARCHAR NOT NULL,
    source_job_id   VARCHAR NOT NULL,
    skill_name      VARCHAR NOT NULL,         -- normalized canonical
    skill_name_raw  VARCHAR,                  -- original text
    skill_category  VARCHAR,                  -- taxonomy category
    importance      VARCHAR,                  -- required|preferred|mentioned
    confidence      VARCHAR,                  -- high|medium|low
    extraction_method VARCHAR DEFAULT 'llm',  -- 'llm' (new) vs 'source_tag' (old)
    extracted_at    TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (source, source_job_id, skill_name)
);
```

## Step 4: Merge — Unified Skill View

New DBT model `silver_skill_unified.sql`:
```sql
-- Merge source tags + LLM-extracted skills into unified view
-- Dedup via skill_synonym normalization
-- Priority: source_tag > llm_high > llm_medium > llm_low

SELECT DISTINCT ON (source, source_job_id, skill_canonical)
    source, source_job_id, skill_canonical, skill_category, importance
FROM (
    -- Source tags (existing)
    SELECT source, source_job_id,
           skill_name_norm AS skill_canonical,
           'source_tag'::text AS method,
           skill_weight
    FROM dbt_dev_silver.silver_skill_long

    UNION ALL

    -- LLM extracted (new)
    SELECT source, source_job_id,
           se.skill_name AS skill_canonical,
           'llm'::text AS method,
           CASE se.importance
               WHEN 'required' THEN 80
               WHEN 'preferred' THEN 50
               ELSE 20
           END AS skill_weight
    FROM dbt_dev_silver.silver_skill_enriched se
) combined
ORDER BY source, source_job_id, skill_canonical, skill_weight DESC
```

## Step 5: Gold Analytics — New DBT Models

### `gold.mart_skill_demand_enriched.sql`
```sql
-- Replaces mart_skill_demand with enriched data
-- Adds: category breakdown, importance distribution, trend
SELECT
    skill_canonical AS skill,
    skill_category,
    COUNT(DISTINCT source_job_id) AS n_jobs,
    ROUND(COUNT(DISTINCT source_job_id)::numeric / total_jobs * 100, 2) AS pct_of_jobs,
    ROUND(AVG(salary_vnd_monthly_avg) / 1000000.0, 1) AS avg_salary_m,
    COUNT(*) FILTER (WHERE importance = 'required') AS n_required,
    COUNT(*) FILTER (WHERE importance = 'preferred') AS n_preferred,
    COUNT(*) FILTER (WHERE extraction_method = 'llm') AS n_llm_extracted,
    snapshot_date
FROM silver_skill_unified su
JOIN fct_jobs_daily f ON ...
GROUP BY skill_canonical, skill_category, snapshot_date
```

### `gold.mart_skill_cooccurrence.sql`
```sql
-- Skills thường xuất hiện cùng nhau
-- Dùng cho: "học Python rồi nên học gì tiếp?"
SELECT
    a.skill_canonical AS skill_a,
    b.skill_canonical AS skill_b,
    COUNT(DISTINCT a.source_job_id) AS cooccurrence_count
FROM silver_skill_unified a
JOIN silver_skill_unified b
    ON a.source = b.source
    AND a.source_job_id = b.source_job_id
    AND a.skill_canonical < b.skill_canonical  -- avoid duplicates
GROUP BY a.skill_canonical, b.skill_canonical
HAVING COUNT(DISTINCT a.source_job_id) >= 5
ORDER BY cooccurrence_count DESC
```

### `gold.mart_skill_trend.sql`
```sql
-- Skill demand over time (weekly/monthly)
-- Dùng cho: "skill nào đang trending lên/xuống"
SELECT
    skill_canonical AS skill,
    DATE_TRUNC('week', snapshot_date)::date AS week,
    COUNT(DISTINCT source_job_id) AS n_jobs_that_week,
    ROUND(AVG(salary_vnd_monthly_avg) / 1000000.0, 1) AS avg_salary_m
FROM silver_skill_unified su
JOIN fct_jobs_daily f ON ...
GROUP BY skill_canonical, DATE_TRUNC('week', snapshot_date)
```

## Step 6: DBT Model Directory

```
dbt_transform/models/
├── silver/
│   ├── silver_skill_enriched.sql       -- NEW: LLM-extracted skills
│   └── silver_skill_unified.sql        -- NEW: merged source + LLM
├── gold/
│   ├── mart_skill_demand_enriched.sql  -- NEW: enriched demand
│   ├── mart_skill_cooccurrence.sql     -- NEW: skill pairs
│   └── mart_skill_trend.sql            -- NEW: weekly trends
```

## Processing Strategy

| Phase | What | Jobs/day | Time |
|-------|------|----------|------|
| **Backfill** | Extract skills từ all existing jobs | ~50K jobs | ~3-4 hours |
| **Incremental** | Chỉ extract jobs mới mỗi ngày | ~200-500 jobs | ~5-10 min |
| **Cost** | DeepSeek Flash @ ~$0.01/1K tokens | ~50K jobs × 2K tokens | ~$1-2 total |

## Scalability

| Concern | Solution |
|---------|----------|
| New job sources | Add parser → text lands in silver_job_detail → auto-extracted |
| New skill categories | Update taxonomy in config.yaml — no code change |
| Better extraction | Swap LLM model in config.yaml |
| Performance | Batch processing + semaphore + async |
| Monitoring | Log extraction stats, confidence distribution |

## What Agent Gets After Enrichment

```
TRƯỚC:  silver_skill_long — ~500 skills từ structured tags, limited coverage
SAU:    silver_skill_unified — ~2000+ skills từ tags + LLM, categorized, weighted
        + cooccurrence matrix — "skills hay đi kèm"
        + trend data — "skills đang hot lên"
        + category taxonomy — phân loại rõ ràng
```

Agent có thể:
1. Skill gap analysis chính xác hơn (nhiều skills hơn)
2. Recommend learning path dựa trên co-occurrence ("ai học Python thường học thêm Docker")
3. Show trend ("RAG đang tăng 40% tháng này")
4. Phân loại skill theo category

## Verification
1. Run extraction on 100 test jobs → check skill coverage vs manual review
2. Compare enriched vs source-tag-only: count new skills discovered
3. Spot check: job descriptions with known skills → verify extraction
4. DBT models run without errors
5. Analytics queries return meaningful data
