# Agent Unit Test Review

> **Date**: 2026-05-24
> **Scope**: All unit tests in `dashboard/backend/tests/` and `mcp_server/tests/`

---

## Summary

| Area | Files | Quality | Critical Issues |
|------|-------|---------|-----------------|
| Backend Agent (LLM, tools, chain, MCP client) | 5 | Fair | 2 tests will FAIL (source mismatch) |
| Backend API (chat, interview) | 2 | Poor | No streaming tests, no auth tests |
| MCP Tools (skills, analytics, ops, job search) | 4 | Fair-Good | Tool layer vs service layer gaps |
| MCP Repositories | 1 | Good | Real bug: `skill_category=""` hardcoded |
| MCP Schemas | 1 | Fair | No validation tests |

**Total test files**: 15 | **Critical bugs found**: 2 | **Will fail on run**: 2 tests

---

## 1. Backend Agent Tests

### test_llm.py — BAD

- Only asserts `model_name`. Ignores `temperature`, `max_tokens`, `base_url`, `api_key`.
- Two tests are identical (different inputs, same assertion).
- No error tests (missing config keys, missing API key).

### test_skill_tools.py — GOOD (but will fail)

- Correctly tests `query_skill_gap` delegation to `call_mcp_tool`.
- **CRITICAL**: Tests a `get_user_profile` tool that does NOT exist in `skill_tools.py`. Will fail on import.

### test_skill_advisor_chain.py — BAD

- Manipulates module global `_agent` directly (fragile, order-dependent).
- **CRITICAL**: Asserts tool list contains `get_user_profile`, but source has `get_cv_writing_guide` + `search_jobs_realtime`. Will fail.
- No test for `system_prompt`, `middleware`, `context_schema`.

### test_mcp_client.py — GOOD

- Tests success, empty result, error cases.
- Missing: multi-item results, `str()` fallback, correct `server_url`.

### test_interview_eval.py — GOOD

- Good coverage: JSON parsing, code-block wrapping, score clamping.
- Missing: lower-bound clamping, empty profile, partial JSON.

---

## 2. Backend API Tests

### test_chat_api.py — BAD

- Only tests 404 paths and basic creation. **No happy-path test for `send_message`**.
- **No test for streaming endpoint** (`/messages/stream`).
- No authorization test (user A accessing user B's room).
- Shared global `MockDB` leaks state between tests.

### test_interview_api.py — GOOD (but gaps)

- Tests practice + mock_test modes, submit, skip, abandon.
- Missing: `list_questions`, `list_sessions`, `complete_session`, `get_report`, streaming eval.
- No auth test, no re-submit test.

---

## 3. MCP Server Tests

### test_skills.py — FAIR

- Tests `query_skill_gap` and `get_user_profile` happy paths.
- Missing: `category`/`limit` param forwarding, whitespace normalization, full JSON validation.

### test_analytics.py — GOOD (best test file)

- Covers 6 tools with happy paths, empty results, parameter forwarding.
- Uses `assert_called_once_with` to verify repo calls.
- Issue: string-contains assertions on JSON are fragile.

### test_operations.py — POOR

- Only 2 tests for the only write-operation tool.
- No retry test, no partial success, no exception handling.

### test_job_search.py — GOOD (but wrong layer)

- Tests `search_jobs` service well (dedup, timeout, source error).
- **Tests service, not MCP tool**. `search_jobs_realtime` in `tools/job_search.py` is untested.
- `_parse_skills` and `_build_description_snippet` have zero tests.

### test_skill_repo.py — GOOD

- Best repo test. Validates trend math (50% up, -10% down).
- **Found real bug**: `gap()` and `demand()` hardcode `skill_category=""` instead of using DB value.
- Missing: division-by-zero guard, `limit` truncation.

### test_schemas.py — FAIR

- Construction and JSON round-trip tests.
- Missing: validation errors, `SkillDemandRow`, `JobSearchResult`.

---

## 4. Real Bugs Found

### Bug 1: `skill_category` always empty

**File**: `mcp_server/repositories/skill_repo.py:38,64`

```python
# gap() line 38 — hardcodes empty string:
SkillGapRow(
    skill=r["skill"],
    skill_category="",  # BUG: should be r["skill_category"] if available
    ...
)

# demand() line 64 — same issue:
SkillDemandRow(
    skill=r["skill"],
    skill_category="",  # BUG
    ...
)
```

**Impact**: `skill_category` is always empty in gap/demand results. If the DB ever adds category data, it will be silently dropped.

### Bug 2: Test-source mismatches (will crash pytest)

- `test_skill_tools.py` imports `get_user_profile` from `skill_tools.py` but it doesn't exist there.
- `test_skill_advisor_chain.py` asserts `get_user_profile` in tool list but source registers `get_cv_writing_guide`.

---

## 5. Cross-Cutting Issues

1. **Streaming endpoints have zero tests** — both chat SSE and interview eval SSE are untested.
2. **No authorization tests** — neither API tests cross-user access denial.
3. **No integration tests** — everything mocks the DB. No test runs real SQL.
4. **Global state in tests** — `_agent` singleton and shared `MockDB` risk order-dependent failures.
5. **`cv_coach_tool.py` and `job_search_tools.py`** — agent tools with zero test coverage.

---

## 6. Priority Fixes

| Priority | Action | Effort |
|----------|--------|--------|
| **P0** | Fix test-source mismatches (update imports, tool names) | 30 min |
| **P0** | Fix `skill_category=""` bug in `skill_repo.py` | 15 min |
| **P1** | Add `send_message` happy-path test | 1 hr |
| **P1** | Add streaming endpoint tests (chat + interview) | 2 hrs |
| **P1** | Add `search_jobs_realtime` MCP tool tests | 1 hr |
| **P2** | Add `_parse_skills` / `_build_description_snippet` tests | 30 min |
| **P2** | Add authorization tests | 1 hr |
| **P2** | Replace string-contains assertions with JSON parse | 30 min |

---

## 7. Recommendations

1. **Run `pytest` now** — confirm which tests pass/fail, fix the 2 broken ones first.
2. **Add `conftest.py` to backend tests** — shared user mock, DB mock, client factory.
3. **Target 80% coverage** on tool functions and API endpoints before moving to integration tests.
4. **Use `json.loads()` assertions** instead of `in` string checks for JSON outputs.
5. **Consider pytest-asyncio** markers if not already configured.
