# Interview Agent - Evaluation System

## Overview

The evaluation system is responsible for:
1. **Assessing user answers** during the interview (real-time feedback)
2. **Generating session summaries** with overall scores and improvement plans

The system uses LLMs with structured outputs for consistent, fair evaluation.

---

## Evaluation Architecture

```
User Answer → Evaluator Agent → Score (1.0-5.0) + Feedback
                                   ↓
Session Complete → Summarizer Agent → Overall Summary
```

---

## Answer Evaluation

### Technical Interview Evaluation

**Evaluator:** `evaluation/evaluator.py` → `evaluate_tech_answer()`

**Inputs:**
- Question text
- User's answer
- User profile (skills, experience level)
- Interview context (target role, question number)

**Output (JSON):**
```json
{
  "score": 4.2,
  "feedback": "Good approach to distributed systems. You considered Redis which is appropriate...",
  "strengths": [
    "Mentioned Redis for caching",
    "Considered write throughput",
    "Mentioned scalability concerns"
  ],
  "improvements": [
    "Could mention specific technologies (e.g., Redis Cluster)",
    "Could elaborate more on data consistency"
  ]
}
```

**Scoring Rubric (Technical):**

| Score | Criteria |
|-------|----------|
| 5.0 (Excellent) | Comprehensive answer, considers trade-offs, mentions specific tech, clear communication |
| 4.0 (Good) | Solid approach, mentions tools/technologies, minor gaps |
| 3.0 (Average) | Basic understanding, some gaps in technical depth |
| 2.0 (Fair) | Partial understanding, significant gaps |
| 1.0 (Poor) | Incorrect or irrelevant answer |

### Behavioral Interview Evaluation

**Evaluator:** `evaluation/evaluator.py` → `evaluate_behavioral_answer()`

**Inputs:**
- Question (STAR-based)
- User's answer
- STAR cues provided with question

**Output (JSON):**
```json
{
  "score": 3.8,
  "feedback": "Good STAR structure! Your Situation was clear and Task was specific. 
               For Result, try to quantify the impact more.",
  "strengths": [
    "Situation clearly described",
    "Action well-explained",
    "Team collaboration evident"
  ],
  "improvements": [
    "Result could be more quantified",
    "Could mention specific outcomes"
  ]
}
```

**STAR Structure Scoring:**
- **Situation** (S): Was context clearly provided?
- **Task** (T): Was the objective/goal specific?
- **Action** (A): Were steps clearly explained?
- **Result** (R): Was outcome quantified?

**Scoring Rubric (Behavioral):**

| STAR Component | Weight | Criteria |
|---------------|--------|----------|
| Situation | 20% | Clarity, relevance, context setting |
| Task | 20% | Specificity, clarity of goals |
| Action | 30% | Step-by-step clarity, ownership |
| Result | 30% | Quantification, impact, outcomes |

---

## Session Summary Generation

### Summarizer Agent

**File:** `evaluation/summarizer.py`

**Inputs:**
- Session mode (tech/behavioral)
- All messages (transcript)
- Individual answer evaluations (if available)
- User profile

**Output (JSON):**
```json
{
  "overall_score": 4.1,
  "overall_feedback": "Overall strong performance. You demonstrated good technical 
                        depth and clear communication. Key areas to improve: 
                        specificity in outcomes, deeper consideration of scalability.",
  "strengths": [
    "Strong system design fundamentals",
    "Good communication of technical concepts",
    "Considered multiple factors in decisions"
  ],
  "improvements": [
    "Quantify outcomes when possible",
    "Mention specific scaling strategies",
    "Consider edge cases more thoroughly"
  ],
  "improvement_plan": "Recommended next steps:
  1. Study distributed system design patterns (CAP theorem, PACELC)
  2. Practice quantifying impact (metrics, cost savings)
  3. Work on system design communication (diagrams, clear trade-offs)
  4. Practice more within time-limited scenarios",
  "question_count": 5
}
```

### Overall Score Calculation

**Technical Interviews:**
- Weighted average of individual question scores
- OR holistic LLM evaluation of entire session (preferred)

**Behavioral Interviews:**
- Average of individual STAR-evaluated answers
- Adjusted for STAR structure quality

---

## LLM Integration

### Model Configuration

**Conversation Model** (for chat):
```python
INTERVIEW_MODEL="gpt-4o-mini"
INTERVIEW_TEMPERATURE=0.7
INTERVIEW_MAX_TOKENS=2000
```

**Evaluation Model** (for scoring):
```python
INTERVIEW_EVAL_MODEL="gpt-4o"
INTERVIEW_EVAL_TEMPERATURE=0.3  # Lower for consistency
```

### Prompt Engineering

**Technical Evaluation Prompt Template:**

```system
You are an expert technical interviewer evaluating a candidate's answer.

**Question:** {question}

**Candidate's Answer:** {answer}

**Candidate Profile:**
- Skills: {skills}
- Experience Level: {experience_level}
- Target Role: {target_role}

**Scoring Rubric:**
- 5.0: Excellent - comprehensive, trade-offs considered, specific tech mentioned, clear communication
- 4.0: Good - solid approach, some gaps in depth
- 3.0: Average - basic understanding, significant gaps
- 2.0: Fair - partial understanding
- 1.0: Poor - incorrect or irrelevant

**Output Format (JSON only):**
```json
{{
  "score": <float 1.0-5.0>,
  "feedback": "<narrative feedback>",
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"]
}}
```
```

**Behavioral Evaluation Prompt Template:**

```system
You are an HR/behavioral interviewer evaluating a candidate's STAR answer.

**Question:** {question}

**STAR Cues Provided:** {star_cues}

**Candidate's Answer:** {answer}

**Scoring Rubric (STAR):**
- Situation (20%): Context clearly set?
- Task (20%): Goal/objective specific?
- Action (30%): Steps explained, ownership shown?
- Result (30%): Outcomes quantified?

**Output Format (JSON only):**
```json
{{
  "score": <float 1.0-5.0>,
  "feedback": "<narrative feedback with STAR coaching>",
  "strengths": ["<STAR element well-done>"],
  "improvements": ["<STAR element to improve>"]
}}
```
```

---

## Error Handling

### LLM Failures

**Problem:** LLM returns non-JSON or malformed output.

**Solution:**
```python
try:
    result = await llm.invoke(prompt)
    parsed = json.loads(result.content)
except JSONDecodeError:
    # Fallback: return default evaluation
    return {
        "score": 3.0,
        "feedback": "Evaluation unavailable (LLM error)",
        "strengths": [],
        "improvements": ["Unable to parse feedback"]
    }
```

### Timeout Handling

```python
try:
    result = await asyncio.wait_for(
        evaluator.evaluate_answer(...),
        timeout=30.0  # 30 second timeout
    )
except asyncio.TimeoutError:
    # Use default values
    return {"score": 3.0, "feedback": "Evaluation timed out", ...}
```

---

## Real-time Feedback Integration

### During Chat Session

For **Behavioral** mode, provide STAR coaching after each answer:

```
User: [answers question]

AI: Good use of Situation and Task! For Result, try to be more 
    specific — what metrics improved? What was the business impact?

    [Continue to next question]
```

For **Technical** mode, provide probing questions:

```
User: [answers question]

AI: Good approach using Redis. Have you considered what happens 
    when Redis reaches memory limits? How would you handle failover?

    [Continue to next question]
```

---

## Testing Evaluation Logic

### Unit Tests

```python
# tests/test_evaluation.py

@pytest.mark.asyncio
async def test_tech_evaluator():
    result = await evaluate_tech_answer(
        question="Design a URL shortener",
        answer="I'd use Redis to store mappings...",
        profile={"skills": ["Redis", "Python"], "level": "senior"}
    )
    
    assert 4.0 <= result["score"] <= 5.0
    assert "strengths" in result
    assert "improvements" in result
    assert result["feedback"]

@pytest.mark.asyncio
async def test_behavioral_evaluator():
    result = await evaluate_behavioral_answer(
        question="Tell me about a time you led a team...",
        answer="In my previous role, our team...",
        star_cues={"situation": "Context...", "task": "Goal..."}
    )
    
    assert 3.0 <= result["score"] <= 5.0
    assert len(result["strengths"]) > 0
```

### Integration Tests

```python
# tests/test_evaluation_integration.py

@pytest.mark.asyncio
async def test_session_summarizer():
    session = {
        "mode": "tech",
        "messages": [
            {"role": "assistant", "content": "Design a URL shortener..."},
            {"role": "user", "content": "I'd use Redis..."},
            ...
        ]
    }
    
    summary = await generate_session_summary(session)
    
    assert 1.0 <= summary["overall_score"] <= 5.0
    assert "improvement_plan" in summary
    assert "question_count" in summary
```

---

## Evaluation Prompts

### Technical Interview System Prompt

```python
# prompts/tech_prompts.py

TECH_INTERVIEWER_SYSTEM = """You are a professional Technical Interviewer conducting interviews.

**Your Role:**
- Ask technical questions appropriate to the candidate's level
- Probe for depth of understanding
- Assess problem-solving approach, not just correctness
- Provide constructive feedback

**Interview Flow:**
1. Ask opening question (based on target role)
2. Listen to candidate's answer
3. Ask follow-up questions to probe deeper
4. Move to next topic when satisfied

**Topics to Cover:**
- System Design (scalability, reliability)
- Algorithms & Data Structures
- Coding & Implementation
- Trade-offs and Decision Making
- Communication & Technical Articulation

**Guidelines:**
- Be encouraging but probing
- Ask "why" and "how" questions
- Adapt difficulty based on candidate's responses
- If candidate struggles, provide hints
- End with positive note regardless of performance

**Question Generation:**
For target role "{target_role}", generate questions covering:
- System design (e.g., "Design a {service} system")
- Coding (e.g., "Implement {feature}")
- Architecture (e.g., "How would you structure...")

**Conversation Style:**
- Natural conversation, not rigid Q&A
- Responsive to candidate's answers
- Ask follow-ups naturally
- Keep tone professional yet approachable
"""
```

### Behavioral Interview System Prompt

```python
# prompts/behavioral_prompts.py

BEHAVIORAL_INTERVIEWER_SYSTEM = """You are a professional HR/Behavioral Interviewer conducting interviews.

**Your Role:**
- Ask behavioral questions to assess soft skills
- Evaluate STAR method usage
- Assess culture fit and communication
- Provide constructive STAR coaching

**Interview Flow:**
1. Ask STAR-based behavioral question
2. Listen for complete STAR answer
3. Coach on STAR structure if incomplete
4. Ask follow-up question on different competency
5. Move to next topic when satisfied

**STAR Method:**
- **Situation:** Context/background
- **Task:** Goal/objective
- **Action:** Steps taken, ownership
- **Result:** Outcomes, impact, learning

**Competencies to Assess:**
- Leadership
- Teamwork & Collaboration
- Problem Solving
- Communication
- Adaptability
- Conflict Resolution
- Time Management

**Guidelines:**
- Be encouraging and coaching-oriented
- If STAR is incomplete, gently ask for missing parts
- Example: "That's a great Situation! Can you tell me more about your Task?"
- Accept partial STAR and coach improvement
- Keep conversation natural, not interrogative

**Question Generation:**
Generate behavioral questions like:
- "Tell me about a time you {competency}..."
- "Describe a situation where you {challenge}..."

**Coaching Examples:**
- "Good STAR! For Result, try to quantify impact."
- "I like your Action step. What was your thought process?"
- "Can you be more specific about the Situation context?"

**Conversation Style:**
- Warm and conversational
- Interviewer + Coach hybrid role
- Provide real-time STAR guidance
- Celebrate good examples
"""
```

---

## Evaluation Quality

### Consistency Measures

- **Temperature Control**: Lower temperature (0.3) for more consistent scoring
- **Structured Output**: JSON schema ensures parseable results
- **Fallback Logic**: Default values when LLM fails

### Fairness Considerations

- **Blind Evaluation**: LLM doesn't see user name, only content
- **Profile-Aware**: Evaluation considers experience level fairly
- **Context-Aware**: Questions and feedback adapted to target role
- **Bias Mitigation**: Prompts specify objective criteria

---

## Performance

### LLM Latency

| Operation | Expected Latency |
|-----------|-----------------|
| Answer evaluation | 5-15 seconds |
| Session summary | 10-30 seconds |
| Real-time feedback | <2 seconds (cached or simplified) |

### Optimization

- **Streaming**: Stream evaluation results as they're generated
- **Caching**: Cache common feedback patterns
- **Async**: Non-blocking evaluation doesn't block chat
- **Retry**: Retry with exponential backoff on LLM failures

---

## Analytics & Improvement

### Tracking Metrics

- Average scores by mode, experience level, target role
- Completion rates
- Common strengths/improvements by category
- LLM latency and failure rates

### Feedback Loop

Use collected data to:
- Refine scoring rubrics
- Improve prompt engineering
- Adjust question difficulty
- Identify bias patterns

---

## Related Documentation

- [Architecture Overview](./interview-architecture.md)
- [API Specification](./interview-api-spec.md)
- [Database Schema](./interview-database-schema.md)
- [Voice Integration Roadmap](./interview-voice-roadmap.md)
