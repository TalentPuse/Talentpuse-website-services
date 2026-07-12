# Agent Quality Evaluation Plan

> **Ngày**: 2026-05-24
> **Scope**: Đánh giá chất lượng đầu ra của 3 tính năng chính của AI Agent
> **Features**: (1) Real-time Job Search, (2) CV Coaching, (3) Skill Recommendations

---

## 1. Context & Motivation

### Vấn đề

AI Agent hiện tại (LangChain `create_agent` + MCP tools) đã code xong 3 features:
1. **Skill Recommendations** — `query_skill_gap` tool + LLM
2. **CV Coaching** — `get_cv_writing_guide` tool + knowledge base YAML
3. **Real-time Job Search** (sắp triển khai) — `search_jobs_realtime` tool + jobspy

Nhưng **không có cách nào đo lường chất lượng đầu ra**:
- LLM có recommend skills đúng không?
- CV advice có thực tế, actionable không?
- Job search results có relevant với user không?
- Agent có gọi đúng tool khi cần không?

### Mục tiêu

Xây dựng **evaluation framework** cho phép:
- Chấm điểm tự động mỗi feature trên bộ test cases định sẵn
- Track quality theo thời gian (khi đổi prompt, model, tools)
- Phát hiện regression khi deploy mới
- Có baseline để cải thiện dần

---

## 2. Evaluation Framework Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  EVALUATION FRAMEWORK                     │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Golden Test  │  │ LLM-as-    │  │ Automated   │     │
│  │ Cases (YAML) │  │ Judge      │  │ Metrics     │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │              │
│         ▼                ▼                ▼              │
│  ┌──────────────────────────────────────────────────┐   │
│  │              eval_runner.py                       │   │
│  │  • Load test cases                               │   │
│  │  • Call agent với each input                     │   │
│  │  • Collect outputs                               │   │
│  │  • Score với rubric                              │   │
│  │  • Generate report                               │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Output: evaluation_report_{date}.json                   │
└──────────────────────────────────────────────────────────┘
```

### 3 Layers of Evaluation

| Layer | Method | Chi phí | Độ tin cậy |
|-------|--------|---------|------------|
| **Layer 1: Deterministic** | Assert output structure, tool calls | Rẻ (free) | Cao |
| **Layer 2: LLM-as-Judge** | GPT/DeepSeek chấm điểm output | Trung bình | Trung bình |
| **Layer 3: Human Review** | Người review sample outputs | Đắt | Cao nhất |

---

## 3. Feature 1: Skill Recommendations

### Hiện trạng code

- **Agent prompt**: `prompts/skill_advisor_prompt.py` — System prompt instructs AI recommend TOP 5 skills
- **Tool**: `tools/skill_tools.py` → `query_skill_gap(user_skills)` → MCP server → `skill_repo.gap()`
- **Middleware**: `middleware/profile_injection.py` → inject user profile vào context
- **Chain**: `chains/skill_advisor_chain.py` → `create_agent()` với tools + middleware

### Evaluation Criteria

| # | Criterion | Weight | Layer |
|---|-----------|--------|-------|
| 1 | **Tool call correctness**: Agent gọi `query_skill_gap` khi user hỏi skills | 20% | L1 Deterministic |
| 2 | **User skills truyền đúng**: user_skills từ profile được truyền vào tool | 15% | L1 Deterministic |
| 3 | **Output structure**: Có phân tích background + TOP 5 + lý do + learning path | 15% | L1 Deterministic |
| 4 | **Relevance**: Skills recommend có phù hợp với background user không | 20% | L2 LLM Judge |
| 5 | **Data accuracy**: Market data (số jobs, lương) khớp với tool output | 15% | L1+L2 |
| 6 | **Language quality**: Tiếng Việt tự nhiên, format dễ đọc | 10% | L2 LLM Judge |
| 7 | **No hallucination**: Không bịa data không có trong tool response | 5% | L2 LLM Judge |

### Golden Test Cases

```yaml
# eval/test_cases/skill_recommendations.yaml

test_cases:
  - id: "skill_001"
    name: "Junior Python dev hỏi hướng AI"
    user_profile:
      skills: ["Python", "SQL", "Pandas", "Git"]
      desired_titles: ["Data Engineer", "AI Engineer"]
      experience_level: "fresher"
      preferred_cities: ["Ho Chi Minh City"]
    input: "Mình đang làm Python developer, muốn chuyển sang AI. Nên học gì?"
    expected_tool_calls:
      - tool: "query_skill_gap"
        args_should_contain: ["Python", "SQL", "Pandas", "Git"]
    expected_output_contains:
      - "GenAI"
      - "Machine Learning"
      - "TOP 5"
    rubric:
      relevance: "Recommend skills phù hợp cho fresher Python dev chuyển AI"
      structure: "Có phân tích background + 2 hướng + TOP 5 với lý do"

  - id: "skill_002"
    name: "Senior Data Scientist hỏi nâng cao"
    user_profile:
      skills: ["Python", "TensorFlow", "PyTorch", "SQL", "MLOps", "Docker", "Kubernetes"]
      desired_titles: ["ML Engineer", "AI Research"]
      experience_level: "senior"
    input: "Mình đã biết ML thuần rồi, nên bổ sung gì để lên lead?"
    expected_tool_calls:
      - tool: "query_skill_gap"
    rubric:
      relevance: "Recommend leadership/architect skills, không recommend basics"
      no_redundancy: "Không recommend skills user đã có (TensorFlow, PyTorch...)"

  - id: "skill_003"
    name: "Student chưa có skills hỏi lộ trình"
    user_profile:
      skills: []
      desired_titles: ["Data Analyst"]
      experience_level: "student"
      university: "HCMUT"
      graduation_year: 2027
    input: "Mình là sinh viên năm 3, muốn làm Data Analyst thì cần học gì?"
    expected_tool_calls:
      - tool: "query_skill_gap"
        args_should_contain: []  # empty skills
    rubric:
      relevance: "Recommend foundational skills cho student, không recommend senior stuff"
      empathy: "Phản hồi thân thiện, khích lệ"

  - id: "skill_004"
    name: "User hỏi chung không trigger tool"
    user_profile:
      skills: ["Java"]
    input: "Cảm ơn bạn nhiều nha"
    expected_tool_calls: []  # không gọi tool
    expected_output_contains: []  # response tự do
    rubric:
      no_unnecessary_tool: "Không gọi tool cho message cảm ơn"

  - id: "skill_005"
    name: "User hỏi salary + skills kết hợp"
    user_profile:
      skills: ["Python", "Docker"]
      desired_titles: ["DevOps Engineer"]
    input: "Skill nào trả lương cao nhất cho DevOps ở HCM?"
    expected_tool_calls:
      - tool: "query_skill_gap"
    rubric:
      data_driven: "Trả lời dựa trên data, có số lương cụ thể"
```

### Scoring Script

```python
# eval/eval_skill_recommendations.py

class SkillRecommendationScorer:
    """Chấm điểm skill recommendation outputs."""

    def score_tool_call(self, output, expected):
        """Layer 1: Kiểm tra agent có gọi đúng tool không."""
        score = 0

        # 1. Tool called?
        if expected.tool_calls:
            for expected_call in expected.tool_calls:
                if expected_call.tool in output.tool_calls:
                    score += 0.5
                    # 2. Args contain expected skills?
                    if expected_call.args_should_contain:
                        actual_args = output.tool_calls[expected_call.tool]
                        if all(s in actual_args for s in expected_call.args_should_contain):
                            score += 0.5
                    else:
                        score += 0.5
        elif not expected.tool_calls:
            # Should NOT call tool
            score = 1.0 if not output.tool_calls else 0.0

        return score

    def score_structure(self, output):
        """Layer 1: Kiểm tra output structure."""
        checks = {
            "has_background_analysis": any(
                kw in output.text for kw in ["background", "hiện tại", "profile"]
            ),
            "has_top5": any(
                kw in output.text for kw in ["TOP 5", "top 5", "1.", "2.", "3."]
            ),
            "has_reason": any(
                kw in output.text for kw in ["lý do", "vì", "do", "reason"]
            ),
            "has_learning_path": any(
                kw in output.text for kw in ["lộ trình", "bước", "path", "học"]
            ),
            "has_market_data": any(
                kw in output.text for kw in ["jobs", "triệu", "VND", "lương"]
            ),
        }
        return sum(checks.values()) / len(checks)

    def score_relevance(self, output, test_case, judge_llm):
        """Layer 2: LLM-as-Judge chấm relevance."""
        prompt = f"""Bạn là AI evaluator. Chấm điểm chất lượng của response sau.

User profile: {test_case.user_profile}
User input: {test_case.input}
Agent response: {output.text}

Tiêu chí: {test_case.rubric.relevance}

Chấm điểm 1-5:
1 = Hoàn toàn không relevant
2 = Ít relevant
3 = Tạm được
4 = Rất relevant
5 = Hoàn hảo

Trả về JSON: {{"score": <1-5>, "reason": "<giải thích>"}}"""
        return judge_llm.invoke(prompt)

    def score_no_hallucination(self, output, tool_response):
        """Layer 2: Check agent không bịa data."""
        # So sánh số jobs/lương trong agent output vs tool response
        # Nếu agent nói "150 jobs" nhưng tool chỉ trả 120 → hallucination
        ...
```

---

## 4. Feature 2: CV Coaching

### Hiện trạng code

- **Tool**: `tools/cv_coach_tool.py` → `get_cv_writing_guide(topic, role)` → YAML knowledge base
- **Knowledge base**: `knowledge/cv_coaching.yaml` — chứa guidelines cho 7 topics + 6 roles
- **Agent prompt**: Có instruction "trả lời bằng tiếng Việt"
- **Không có tool gọi MCP** — purely local YAML knowledge

### Evaluation Criteria

| # | Criterion | Weight | Layer |
|---|-----------|--------|-------|
| 1 | **Tool call correctness**: Gọi `get_cv_writing_guide` khi user hỏi CV | 20% | L1 |
| 2 | **Topic param đúng**: topic truyền vào khớp với user intent | 15% | L1 |
| 3 | **Knowledge utilization**: Response sử dụng data từ knowledge base | 20% | L2 |
| 4 | **Actionability**: Advice có thể apply ngay không | 20% | L2 |
| 5 | **Examples quality**: Có ví dụ cụ thể (good/bad) | 15% | L1+L2 |
| 6 | **Language**: Tiếng Việt tự nhiên, chuyên ngành | 10% | L2 |

### Golden Test Cases

```yaml
# eval/test_cases/cv_coaching.yaml

test_cases:
  - id: "cv_001"
    name: "Hỏi cách viết bullet points"
    user_profile:
      skills: ["Python", "SQL"]
      desired_titles: ["Data Engineer"]
    input: "Cách viết bullet points trong CV cho đẹp?"
    expected_tool_calls:
      - tool: "get_cv_writing_guide"
        args:
          topic: "bullet_points"
    rubric:
      knowledge_used: "Response phải chứa content từ cv_coaching.yaml topic bullet_points"
      has_examples: "Có ví dụ bullet point tốt/xấu"

  - id: "cv_002"
    name: "Hỏi CV tips cho role backend"
    user_profile:
      skills: ["Java", "Spring Boot"]
      desired_titles: ["Backend Developer"]
    input: "Tips viết CV cho Backend Developer?"
    expected_tool_calls:
      - tool: "get_cv_writing_guide"
        args:
          topic: "role_tips"
          role: "backend"
    rubric:
      role_specific: "Advice specific cho Backend, không generic"

  - id: "cv_003"
    name: "Hỏi về ATS optimization"
    input: "CV mình hay bị lọt ATS, làm sao fix?"
    expected_tool_calls:
      - tool: "get_cv_writing_guide"
        args:
          topic: "ats"
    rubric:
      actionable: "Cho tips cụ thể: keywords, format, structure"

  - id: "cv_004"
    name: "Hỏi sửa CV trực tiếp — không có tool"
    user_profile:
      skills: ["Python", "SQL", "Docker"]
    input: "Mình gửi CV bạn xem sửa giùm nha: [paste CV text]"
    expected_tool_calls: []  # CV review không có tool, LLM tự đánh giá
    rubric:
      practical: "Cho feedback cụ thể từng section, không chung chung"
      constructive: "Chỉ lỗi + gợi ý cách sửa"

  - id: "cv_005"
    name: "Hỏi project description"
    input: "Mình làm project churn prediction, viết mô tả sao cho impress?"
    expected_tool_calls:
      - tool: "get_cv_writing_guide"
        args:
          topic: "project_description"
    rubric:
      star_method: "Có gợi ý STAR method hoặc tương đương"
      quantifiable: "Khuyến khích thêm metrics/numbers"

  - id: "cv_006"
    name: "Hỏi mistakes thường gặp"
    input: "Mistakes nào hay mắc khi viết CV ngành IT?"
    expected_tool_calls:
      - tool: "get_cv_writing_guide"
        args:
          topic: "mistakes"
    rubric:
      comprehensive: "Cover ít nhất 5 mistakes"
      it_specific: "Mistakes liên quan ngành IT, không generic"
```

---

## 5. Feature 3: Real-time Job Search

### Hiện trạng code

- **MCP Tool** (sắp code): `search_jobs_realtime(query, location, sources, results_wanted)`
- **Service**: `services/jobspy_service.py` → `jobspy.scrape_jobs()`
- **Agent tool**: `tools/job_search_tools.py` → `call_mcp_tool("search_jobs_realtime", ...)`
- **Prompt**: Updated để hướng dẫn agent khi nào gọi tool

### Evaluation Criteria

| # | Criterion | Weight | Layer |
|---|-----------|--------|-------|
| 1 | **Tool trigger**: Agent gọi tool khi user hỏi tìm việc | 20% | L1 |
| 2 | **Query extraction**: Search term được extract chính xác từ user message | 15% | L1 |
| 3 | **Location handling**: Location param đúng (city vs "Vietnam") | 10% | L1 |
| 4 | **Result relevance**: Jobs trả về có match query không | 20% | L2 |
| 5 | **Output formatting**: Danh sách jobs dễ đọc, có title/company/salary/link | 15% | L1 |
| 6 | **Completeness**: Không bỏ sót jobs quan trọng trong top results | 10% | L2 |
| 7 | **Response time**: Tổng thời gian < 30 giây | 10% | L1 |

### Golden Test Cases

```yaml
# eval/test_cases/job_search.yaml

test_cases:
  - id: "job_001"
    name: "Tìm job Data Engineer ở HCM"
    user_profile:
      skills: ["Python", "SQL", "Spark"]
      preferred_cities: ["Ho Chi Minh City"]
    input: "Tìm job Data Engineer ở HCM cho mình với"
    expected_tool_calls:
      - tool: "search_jobs_realtime"
        args:
          query: "Data Engineer"
          location: "Ho Chi Minh City"
    rubric:
      relevance: "Jobs phải liên quan Data Engineer, không trả Data Analyst hay Software Engineer"
      location_match: "Đa số jobs ở HCM hoặc remote"

  - id: "job_002"
    name: "Tìm việc remote"
    input: "Có job AI nào làm remote không?"
    expected_tool_calls:
      - tool: "search_jobs_realtime"
        args:
          query: "AI"
          is_remote: true
    rubric:
      remote_flag: "Tool phải được gọi với is_remote=true"
      format: "Có format list với link apply"

  - id: "job_003"
    name: "Tìm job rộng không chỉ định city"
    input: "Job Python Developer nào đang tuyển?"
    expected_tool_calls:
      - tool: "search_jobs_realtime"
        args:
          query: "Python Developer"
          location: "Vietnam"  # default
    rubric:
      broad_search: "Search toàn Vietnam, không giới hạn city"

  - id: "job_004"
    name: "Tìm + filter + recommend kết hợp"
    user_profile:
      skills: ["React", "TypeScript", "Next.js"]
      desired_titles: ["Frontend Developer"]
      desired_salary_min: 20
    input: "Tìm job Frontend ở HCM, lương trên 20M, và recommend mình nên bổ sung skill gì?"
    expected_tool_calls:
      - tool: "search_jobs_realtime"
      - tool: "query_skill_gap"
    rubric:
      multi_tool: "Agent phải gọi cả 2 tools"
      integration: "Kết hợp job results + skill gap data để recommend"

  - id: "job_005"
    name: "Không tìm thấy jobs"
    input: "Tìm job Quantum Computing ở Vietnam"
    expected_tool_calls:
      - tool: "search_jobs_realtime"
        args:
          query: "Quantum Computing"
    rubric:
      graceful_empty: "Khi không có results → gợi ý search term khác hoặc mở rộng location"

  - id: "job_006"
    name: "Hỏi salary thị trường — không trigger search"
    input: "Mức lương AI Engineer ở Việt Nam bao nhiêu?"
    expected_tool_calls: []  # Không nên gọi search, dùng analytics data
    rubric:
      correct_routing: "Agent nên dùng get_salary_analysis hoặc trả từ knowledge"
```

---

## 6. Cross-cutting Quality Checks

### 6.1 Tool Selection Accuracy (Intent Routing)

Đây là metric quan trọng nhất — agent có chọn đúng tool cho đúng intent?

```yaml
# eval/test_cases/intent_routing.yaml

test_cases:
  - input: "Nên học gì để làm AI?"
    expected_tools: ["query_skill_gap"]
    forbidden_tools: ["search_jobs_realtime", "get_cv_writing_guide"]

  - input: "Tìm việc Data Engineer HCM"
    expected_tools: ["search_jobs_realtime"]
    forbidden_tools: ["query_skill_gap", "get_cv_writing_guide"]

  - input: "Sửa bullet points CV"
    expected_tools: ["get_cv_writing_guide"]
    forbidden_tools: ["query_skill_gap", "search_jobs_realtime"]

  - input: "Tìm job + recommend skills cho mình"
    expected_tools: ["search_jobs_realtime", "query_skill_gap"]  # both

  - input: "Lương AI Engineer bao nhiêu?"
    expected_tools: []  # general knowledge, no tool needed
    forbidden_tools: ["search_jobs_realtime"]

  - input: "CV mình có ổn không? [paste CV]"
    expected_tools: []  # LLM evaluates directly
    forbidden_tools: ["query_skill_gap", "search_jobs_realtime"]

  - input: "So sánh GenAI và ML career path"
    expected_tools: ["query_skill_gap"]
    forbidden_tools: ["search_jobs_realtime", "get_cv_writing_guide"]
```

### 6.2 Profile Utilization Check

Agent có thực sự dùng profile data trong response không?

```python
# eval/checkers/profile_utilization.py

def check_profile_usage(output: str, profile: dict) -> dict:
    """Check if agent mentions user's actual skills/context in response."""
    checks = {}

    # Agent có nhắc skills user đã có?
    if profile.get("skills"):
        mentioned_skills = [s for s in profile["skills"] if s.lower() in output.lower()]
        checks["skills_mentioned"] = len(mentioned_skills) / len(profile["skills"])
    else:
        checks["skills_mentioned"] = 1.0  # N/A

    # Agent có mention desired titles?
    if profile.get("desired_titles"):
        checks["titles_mentioned"] = any(
            t.lower() in output.lower() for t in profile["desired_titles"]
        )

    # Agent có mention experience level?
    if profile.get("experience_level"):
        checks["level_acknowledged"] = profile["experience_level"].lower() in output.lower()

    # Agent KHÔNG hỏi lại info đã có trong profile?
    forbidden_asks = ["bạn tên gì", "kỹ năng gì", "muốn làm gì", "ở đâu"]
    checks["no_redundant_questions"] = not any(
        ask in output.lower() for ask in forbidden_asks
    )

    return checks
```

### 6.3 Response Quality Metrics

```python
# eval/metrics.py

class ResponseMetrics:
    """General quality metrics cho mọi response."""

    @staticmethod
    def response_length(output: str) -> dict:
        """Check response length is appropriate."""
        words = len(output.split())
        return {
            "word_count": words,
            "too_short": words < 30,
            "too_long": words > 800,
            "optimal": 50 <= words <= 500,
        }

    @staticmethod
    def has_formatting(output: str) -> dict:
        """Check response uses proper formatting."""
        return {
            "has_bold": "**" in output,
            "has_list": any(c in output for c in ["1.", "- ", "* "]),
            "has_link": "http" in output,
            "has_structure": output.count("\n") > 3,
        }

    @staticmethod
    def vietnamese_quality(output: str) -> dict:
        """Check Vietnamese language quality."""
        # Common issues
        return {
            "has_diacritics": any(
                c in output for c in "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ"
            ),
            "no_mixed_lang_issues": True,  # placeholder for more sophisticated check
        }
```

---

## 7. Evaluation Runner

### File Structure

```
dashboard/backend/eval/
├── README.md                          # How to run evaluations
├── conftest.py                        # Shared fixtures
├── run_evaluation.py                  # Main runner script
├── test_cases/                        # Golden test cases
│   ├── skill_recommendations.yaml
│   ├── cv_coaching.yaml
│   ├── job_search.yaml
│   └── intent_routing.yaml
├── checkers/                          # Scoring logic
│   ├── tool_call_checker.py
│   ├── profile_utilization.py
│   ├── output_structure.py
│   └── llm_judge.py
├── metrics.py                         # General metrics
└── reports/                           # Generated reports
    └── eval_2026-05-24.json
```

### Main Runner

```python
# eval/run_evaluation.py

"""
Agent Quality Evaluation Runner.

Usage:
    python -m eval.run_evaluation --feature skill_recommendations
    python -m eval.run_evaluation --feature cv_coaching
    python -m eval.run_evaluation --feature job_search
    python -m eval.run_evaluation --feature intent_routing
    python -m eval.run_evaluation --all
"""

import asyncio
import json
import time
from datetime import datetime
from pathlib import Path

import yaml
from langchain_core.messages import HumanMessage

from app.services.agent.chains.skill_advisor_chain import get_agent
from app.services.agent.middleware import AgentContext


async def run_single_test(test_case: dict, agent) -> dict:
    """Run một test case và thu thập output."""
    profile = test_case.get("user_profile", {})
    context = AgentContext(profile=profile)

    start = time.time()
    try:
        result = await agent.ainvoke(
            {"messages": [HumanMessage(content=test_case["input"])]},
            config={"context": context},
        )
        elapsed = time.time() - start

        # Extract output
        last_msg = result["messages"][-1]
        output_text = last_msg.content if hasattr(last_msg, "content") else str(last_msg)

        # Extract tool calls from message history
        tool_calls = extract_tool_calls(result["messages"])

        return {
            "test_id": test_case["id"],
            "input": test_case["input"],
            "output": output_text,
            "tool_calls": tool_calls,
            "elapsed_seconds": round(elapsed, 1),
            "error": None,
        }
    except Exception as e:
        return {
            "test_id": test_case["id"],
            "input": test_case["input"],
            "output": None,
            "tool_calls": [],
            "elapsed_seconds": time.time() - start,
            "error": str(e),
        }


async def run_evaluation(feature: str) -> dict:
    """Run toàn bộ evaluation cho một feature."""
    # Load test cases
    test_file = Path(__file__).parent / "test_cases" / f"{feature}.yaml"
    with open(test_file) as f:
        suite = yaml.safe_load(f)

    agent = get_agent()
    results = []

    for tc in suite["test_cases"]:
        result = await run_single_test(tc, agent)
        result["scores"] = score_result(result, tc)
        results.append(result)

    # Aggregate
    report = {
        "feature": feature,
        "timestamp": datetime.now().isoformat(),
        "total_cases": len(results),
        "results": results,
        "summary": aggregate_scores(results),
    }

    # Save report
    report_path = Path(__file__).parent / "reports" / f"eval_{feature}_{datetime.now():%Y%m%d_%H%M%S}.json"
    report_path.parent.mkdir(exist_ok=True)
    with open(report_path, "w") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    return report


def score_result(result: dict, test_case: dict) -> dict:
    """Layer 1 scoring — deterministic checks."""
    scores = {}

    # Tool call accuracy
    expected_tools = test_case.get("expected_tool_calls", [])
    actual_tools = result["tool_calls"]

    if expected_tools:
        expected_names = [t["tool"] for t in expected_tools]
        actual_names = [t["tool"] for t in actual_tools]
        scores["tool_call_accuracy"] = len(set(expected_names) & set(actual_names)) / len(expected_names)
    else:
        scores["tool_call_accuracy"] = 1.0 if not actual_tools else 0.0

    # Forbidden tools
    forbidden = test_case.get("forbidden_tools", [])
    if forbidden:
        used_forbidden = [t for t in actual_tools if t["tool"] in forbidden]
        scores["no_forbidden_tools"] = 1.0 if not used_forbidden else 0.0

    # Output structure
    if result["output"]:
        output = result["output"]
        rubric = test_case.get("rubric", {})

        # Check expected content
        expected_contains = test_case.get("expected_output_contains", [])
        if expected_contains:
            found = sum(1 for kw in expected_contains if kw.lower() in output.lower())
            scores["content_coverage"] = found / len(expected_contains)

        # Response quality
        scores["response_length_ok"] = 30 <= len(output.split()) <= 800
        scores["has_formatting"] = output.count("\n") > 3

    # Time
    scores["response_time_ok"] = result["elapsed_seconds"] < 30

    return scores


def aggregate_scores(results: list[dict]) -> dict:
    """Aggregate scores across all test cases."""
    all_scores = {}
    for r in results:
        for key, value in r.get("scores", {}).items():
            if key not in all_scores:
                all_scores[key] = []
            all_scores[key].append(float(value))

    return {
        key: {"avg": round(sum(vals) / len(vals), 3), "min": min(vals), "max": max(vals)}
        for key, vals in all_scores.items()
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--feature", choices=["skill_recommendations", "cv_coaching", "job_search", "intent_routing"])
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()

    if args.all:
        for feature in ["skill_recommendations", "cv_coaching", "job_search", "intent_routing"]:
            report = asyncio.run(run_evaluation(feature))
            print(f"\n{'='*60}")
            print(f"Feature: {report['feature']}")
            print(f"Cases: {report['total_cases']}")
            for key, val in report["summary"].items():
                print(f"  {key}: {val['avg']:.1%}")
    else:
        report = asyncio.run(run_evaluation(args.feature))
        print(json.dumps(report["summary"], indent=2))
```

---

## 8. LLM-as-Judge Implementation

```python
# eval/checkers/llm_judge.py

"""LLM-as-Judge scoring for subjective quality criteria."""

JUDGE_PROMPT = """Bạn là AI evaluator chuyên nghiệp. Đánh giá response của AI Career Advisor.

## User Context
- Profile: {user_profile}
- Input: {user_input}

## Agent Response
{agent_response}

## Tool Outputs (raw data từ tools)
{tool_outputs}

## Đánh giá theo rubric
{rubric}

## Chấm điểm
Cho mỗi tiêu chí điểm 1-5:
1 = Rất kém
2 = Kém
3 = Tạm được
4 = Tốt
5 = Xuất sắc

Trả về JSON:
{{
  "scores": {{
    "relevance": {{"score": <1-5>, "reason": "..."}},
    "actionability": {{"score": <1-5>, "reason": "..."}},
    "accuracy": {{"score": <1-5>, "reason": "..."}},
    "language_quality": {{"score": <1-5>, "reason": "..."}},
    "hallucination_check": {{"score": <1-5>, "reason": "..."}}
  }},
  "overall": <1-5>,
  "improvement_suggestions": ["...", "..."]
}}"""


async def llm_judge_score(
    user_profile: dict,
    user_input: str,
    agent_response: str,
    tool_outputs: dict,
    rubric: str,
    judge_model: str = "deepseek/deepseek-chat",
) -> dict:
    """Use LLM to judge agent output quality."""
    from langchain_openai import ChatOpenAI

    judge = ChatOpenAI(
        model=judge_model,
        temperature=0.0,  # Deterministic
        model_kwargs={"response_format": {"type": "json_object"}},
    )

    prompt = JUDGE_PROMPT.format(
        user_profile=json.dumps(user_profile, ensure_ascii=False),
        user_input=user_input,
        agent_response=agent_response,
        tool_outputs=json.dumps(tool_outputs, ensure_ascii=False),
        rubric=rubric,
    )

    response = await judge.ainvoke(prompt)
    return json.loads(response.content)
```

---

## 9. CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/agent-eval.yml
name: Agent Quality Evaluation

on:
  pull_request:
    paths:
      - 'dashboard/backend/app/services/agent/**'
      - 'mcp_server/**'
  schedule:
    - cron: '0 6 * * 1'  # Weekly Monday 6AM

jobs:
  evaluate:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: |
          cd dashboard/backend
          pip install -r requirements.txt

      - name: Run evaluation
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          MCP_SERVER_URL: ${{ secrets.MCP_SERVER_URL }}
        run: |
          cd dashboard/backend
          python -m eval.run_evaluation --all > eval_report.json

      - name: Check quality gates
        run: |
          cd dashboard/backend
          python -m eval.check_gates --report eval_report.json
          # Fail if any score < 0.7

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: eval-report
          path: dashboard/backend/eval/reports/
```

### Quality Gates

```python
# eval/check_gates.py

QUALITY_GATES = {
    "skill_recommendations": {
        "tool_call_accuracy": 0.9,    # 90% test cases gọi đúng tool
        "content_coverage": 0.7,      # 70% expected content xuất hiện
        "response_time_ok": 0.9,      # 90% responses dưới 30s
    },
    "cv_coaching": {
        "tool_call_accuracy": 0.85,
        "content_coverage": 0.7,
    },
    "job_search": {
        "tool_call_accuracy": 0.9,
        "response_time_ok": 0.8,      # Job search có thể chậm hơn
    },
    "intent_routing": {
        "tool_call_accuracy": 0.85,   # Critical: đúng tool cho đúng intent
    },
}


def check_gates(report: dict) -> bool:
    """Return True if all gates pass."""
    all_pass = True
    for feature, gates in QUALITY_GATES.items():
        summary = report.get("summary", {})
        for metric, threshold in gates.items():
            actual = summary.get(metric, {}).get("avg", 0)
            if actual < threshold:
                print(f"FAIL: {feature}.{metric} = {actual:.1%} < {threshold:.1%}")
                all_pass = False
            else:
                print(f"PASS: {feature}.{metric} = {actual:.1%} >= {threshold:.1%}")
    return all_pass
```

---

## 10. Implementation Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1: Setup** | 2 hrs | Tạo `eval/` structure, golden test cases YAML |
| **Phase 2: L1 Scoring** | 3 hrs | Tool call checker, structure checker, metrics |
| **Phase 3: Runner** | 2 hrs | `run_evaluation.py`, report generation |
| **Phase 4: L2 Judge** | 2 hrs | LLM-as-Judge scoring với rubric |
| **Phase 5: CI/CD** | 1 hr | GitHub Actions + quality gates |
| **Phase 6: Baseline** | 1 hr | Run baseline evaluation, document scores |
| **Total** | **~11 hrs** | |

---

## 11. Baseline Targets (Initial)

| Feature | Tool Accuracy | Content Quality | Response Time |
|---------|--------------|-----------------|---------------|
| Skill Recommendations | ≥ 85% | ≥ 70% | < 15s |
| CV Coaching | ≥ 80% | ≥ 75% | < 10s |
| Job Search | ≥ 85% | ≥ 70% | < 25s |
| Intent Routing | ≥ 80% | N/A | N/A |

> **Note**: Đây là baseline ban đầu. Sau lần chạy đầu tiên, điều chỉnh targets dựa trên actual performance.

---

## 12. Reporting Format

Mỗi evaluation run tạo report JSON:

```json
{
  "feature": "skill_recommendations",
  "timestamp": "2026-05-24T10:30:00",
  "total_cases": 5,
  "summary": {
    "tool_call_accuracy": {"avg": 0.9, "min": 0.5, "max": 1.0},
    "content_coverage": {"avg": 0.75, "min": 0.5, "max": 1.0},
    "response_time_ok": {"avg": 1.0, "min": 1.0, "max": 1.0}
  },
  "results": [
    {
      "test_id": "skill_001",
      "input": "Mình đang làm Python developer...",
      "output": "Dựa trên background Python của bạn...",
      "tool_calls": [{"tool": "query_skill_gap", "args": {"user_skills": "Python,SQL,Pandas,Git"}}],
      "elapsed_seconds": 8.2,
      "scores": {
        "tool_call_accuracy": 1.0,
        "content_coverage": 0.8,
        "response_length_ok": true,
        "response_time_ok": true
      },
      "llm_judge": {
        "relevance": {"score": 4, "reason": "Good match for Python dev"},
        "overall": 4
      }
    }
  ]
}
```

---

## Appendix: Current Agent Architecture Reference

```
Agent Flow (hiện tại):

User message
    → Chat API (/api/chat/rooms/:id/messages)
    → Load user profile from DB
    → Create AgentContext(profile=user_data)
    → agent.ainvoke(messages, context)
        → Middleware: inject_user_profile() → thêm SystemMessage với profile
        → LLM quyết định:
            ├── Cần tool? → gọi tool (query_skill_gap / get_cv_writing_guide / search_jobs_realtime)
            ├── Tool trả data → LLM generate response với data
            └── Không cần tool → LLM generate response trực tiếp
    → Save user message + AI reply to DB
    → Return AI reply (streaming hoặc full)

Tools available:
    1. query_skill_gap(user_skills) → MCP Server → SQL → skill gap data
    2. get_cv_writing_guide(topic, role) → YAML knowledge base
    3. search_jobs_realtime(query, location) → MCP Server → jobspy → jobs list  (NEW)
```
