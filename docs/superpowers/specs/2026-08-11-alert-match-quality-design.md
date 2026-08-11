# Alert Job Matching Quality — Title/Skill Gate + Word-Boundary Skills

Date: 2026-08-11
Status: Approved (title-or-skill gate; title=45, skill=25, city=20, salary=10; word-boundary skills; scored branch only)
Stakeholder: project owner (Vietnamese-language product)

## Problem

The job-alert email/Telegram dispatcher (`JobMatcher` in
`apps/backend/app/services/job_matcher.py`) alerts users to junk jobs that match
nothing but geography. Verified on account `23520123@gm.uit.edu.vn` (level
`fresher`, HCMC, no min salary, 5 broad titles, ~100 skills) from the live DB —
example junk alerts sent 2026-08-10:

- `GRAPHIC DESIGNER` (TOHOGENKAI) — no title/skill overlap at all.
- `TECHNICAL SUPPORT HÓA POLYMER` (Nhựa Á Châu) — no overlap at all.
- `Nhân viên Telesale/Dell Technical support` (DIGIPRO) — no overlap at all.

Each of those scored only `city_score = 25` yet still passed because the final
query filters with `WHERE score > 0` (job_matcher.py:373).

A second class of junk passes via the skill fallback path
(`_skill_score_expr`, job_matcher.py:458-467). When a job has no crawled skill
rows (`skill_ratio IS NULL`), the fallback is `title ILIKE any('%ai%', ...)` —
a plain substring. The user's short generic skills (`ai`, `sql`, `git`, `rag`,
`ocr`) match innocuous words:

- `NHÂN VIÊN THIẾT KẾ / DRAFTER /NHÂN VIÊN TRIỂN KHAI THIẾT KẾ` — matches `%ai%`
  via "K**HAI**".
- `[HCM] Corporate Sustainability and External Relations Executive (CSR Executive)`
  — matches `%ai%` via "Sust**AI**nability".
- `Business Development Specialist (AI Products)` — matches `%ai%` via "**AI**
  Products".

## Goals

1. A job must match at least one desired **title** OR one **skill** to be
   alerted — matching only the preferred city is never enough.
2. Skill matching uses word boundaries so 2-3 letter skills (`ai`, `sql`) do not
   false-positive on substrings inside English/Vietnamese words.
3. Rewise score weights so "right job, right skills" outranks "right city".
4. Only the scored branch (`_find_scored_jobs`, levels fresher+) changes — the
   student branch keeps its hard title filter + `STUDENT_ALERT_LIMIT`.

Non-goal: changing the `job_fit` scoring engine used by `/recommendations` — it
has its own `scoring.py`/`criteria.py` and is out of scope.

## Scope

IN:
- `apps/backend/app/services/job_matcher.py` — `_find_scored_jobs` gate,
  `_title_score_expr`/`_city_score_expr`/`_salary_score_expr` weights, and
  `_skill_score_expr` word-boundary fallback.
- Tests: new cases in `apps/backend/tests/` (word-boundary + gate + weights).

OUT (unchanged):
- `_find_student_jobs` and its hard title filter.
- `apps/backend/app/services/job_fit/*` recommendation scoring.
- Any public dashboard or frontend code.

## Design

### A. Hard gate — title OR skill match required

In the final query of `_find_scored_jobs` (job_matcher.py:357-378), replace the
weak `WHERE score > 0` with an explicit OR-of-non-zero-components:

```sql
WHERE (title_score > 0 OR skill_score > 0)
  AND is_active
  AND (posted_at IS NULL OR posted_at >= now() - 7 days)
```

Both `title_score` and `skill_score` must be exposed as columns of the `scored`
CTE so the gate can reference them (today only `total_score` is carried). Jobs
matching nothing but city or salary are excluded outright — they never get
ranked or shown.

### B. Weights (sum still 100)

| Component | Old | New |
|---|---|---|
| Title (`title ILIKE`/`job_category ILIKE`) | 40 | 45 |
| Skill (crawled-ratio `* 15`) | 15 | 25 |
| City (`city_canonical IN`) | 25 | 20 |
| Salary (`>= min_salary`) | 20 | 10 |

Skill remains ratio-scaled when real crawled data exists
(`skill_subq.c.skill_ratio * 25`) — a job tagged 60% of the user's skills scores
15/25. The word-boundary fallback (below) pays the full skill weight when no
skill data exists, exactly as today's `fallback` pays a flat 15.

### C. Word-boundary skill fallback

Today: `title ILIKE any('%ai%', '%sql%', ...)` (job_matcher.py:458-461).

New: build a Postgres regex per skill and match with `~*` (case-insensitive):

```
(^|[^[:alnum:]_])<escaped-skill>([^[:alnum:]_]|$)
```

- Escape the user skill text with a Python regex-escape routine at pattern
  build time. Postgres 16 (prod `tp-postgres`) has no `regexp_escape`, so
  escaping is done in code (`re.escape`, `%` handling) — verified on live DB
  that plain `\+`, `\.`, etc. work.
- Multi-word skills ("vertex ai", "delta lake") match as whole phrases.
- Kept `case` structure: `ratio IS NULL → word-boundary fallback`, else
  `ratio * 25`.

Verified against live DB (Postgres 16) that this boundary form:
- `ai` → does NOT match `SustAInability` / `TRIỂN KHAI` (KHAI) — false positives
  from today's substring match are gone.
- `ai` → DOES match `AI Engineer` (standalone word).
- `c++`, `node.js`, `sql` → match `Senior C++ Developer`,
  `Node.js Developer`, `Data Engineer (SQL)`; `sql` does NOT match
  `TECHNICAL SUPPORT HÓA POLYMER`.

`\y` (Postgres word boundary) was rejected: it cannot express a boundary around
`c++`/`node.js` because `+` and `.` are non-word chars, so `\yc\+\+\y` fails on
`Senior C++ Developer`.

### D. Scope note — student branch untouched

`_find_student_jobs` keeps hard `title/category ILIKE` + intern/fresher levels +
`STUDENT_ALERT_LIMIT`. Students explicitly said to leave it.

## Testing

New test file `apps/backend/tests/test_alert_match_quality.py`:

1. **Gate**: a job with city match but zero title/skill overlap is excluded; the
   final SQL contains `(title_score > 0 OR skill_score > 0)` (compile against
   the Postgres dialect, mirroring `test_alert_matching_gaps.py::_sql_pg`).
2. **Weights**: compiled SQL contains `45` for title, `25` for skill, `20` for
   city, `10` for salary; sum still adds to 100.
3. **Word boundary (fallback)**: `ai` pattern in compiled SQL is
   `(^|[^[:alnum:]_])ai([^[:alnum:]_]|$)` (no `%ai%`); regex-escape of `.`, `+`
   is present for skills like `node.js` / `c++`.
4. **Ratio preserved**: when job has crawled skills, fallback is not used —
   `skill_ratio * 25` remains in the compiled SQL.

Regression: run `test_endpoints.py`, `test_job_alert.py`,
`test_alert_matching_gaps.py`, `test_alert_message_format.py` (local pytest
without DB; DB-dependent suites require the live box).

## Verification on the affected account

After deploy, re-check `23520123@gm.uit.edu.vn` on the live warehouse that the
three listed junk alerts no longer qualify: remaining candidates must show a
title and/or word-boundary skill match (`Python Engineer`, `Data Engineer`,
`C Developers`, etc. — the genuinely relevant ones stay).