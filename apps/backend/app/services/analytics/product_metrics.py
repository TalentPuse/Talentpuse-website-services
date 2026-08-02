"""Product metrics computed from the operational database.

Moi ranh gioi ngay o day la ngay lich VIET NAM, khop voi app.user_activity_daily.
Tron lan UTC va VN la loi repo nay da ship ba lan (JA-25, JA-T1, JA-T2): lech 7
tieng nghia la moi hoat dong tu 00:00 den 07:00 gio VN bi dem sang ngay hom truoc,
DAU cua ngay hom nay thieu nguoi va cohort retention nhay sang tuan khac.

Hai loai cot, hai cach xu ly — KHONG duoc dung chung mot cong thuc:

* Cot timestamptz (chat_rooms.created_at, alert_logs.sent_at, ...): can
  `AT TIME ZONE 'Asia/Ho_Chi_Minh'` de doi instant sang gio VN. View
  app.user_activity_daily da lam san viec nay.
* Cot timestamp KHONG tz (app.users.created_at): gia tri trong DB DA LA gio VN
  san roi, vi `app/core/database.py:_set_timezone` chay
  `SET TIME ZONE 'Asia/Ho_Chi_Minh'` cho moi connection, nen `now()` cua Postgres
  bi ep ve timestamp naive theo gio VN. Them mot `AT TIME ZONE` nua vao cot nay la
  cong them 7 tieng lan hai.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

VN = "Asia/Ho_Chi_Minh"


@dataclass(frozen=True)
class ActiveUsers:
    dau: int
    wau: int
    mau: int
    stickiness: float


@dataclass(frozen=True)
class CohortRow:
    cohort_week: date
    size: int
    d1: float
    d7: float
    d30: float


@dataclass(frozen=True)
class FunnelSteps:
    signed_up: int
    profile_completed: int
    channel_enabled: int
    alerted: int


async def active_users(db: AsyncSession, on_date: date) -> ActiveUsers:
    row = (
        await db.execute(
            text(
                """
                SELECT
                  count(DISTINCT user_id) FILTER (
                      WHERE activity_date = CAST(:d AS date)) AS dau,
                  count(DISTINCT user_id) FILTER (
                      WHERE activity_date > CAST(:d AS date) - 7
                        AND activity_date <= CAST(:d AS date)) AS wau,
                  count(DISTINCT user_id) FILTER (
                      WHERE activity_date > CAST(:d AS date) - 30
                        AND activity_date <= CAST(:d AS date)) AS mau
                FROM app.user_activity_daily
                WHERE was_active
                """
            ),
            {"d": on_date},
        )
    ).mappings().one()

    dau, wau, mau = int(row["dau"]), int(row["wau"]), int(row["mau"])
    # Guard bat buoc: mot ngay khong ai vao app la chuyen binh thuong (dem, le,
    # moi deploy). Neu de ZeroDivisionError thi ca endpoint analytics tra 500 va
    # admin mat luon nhung khoi metric khac von van chay tot.
    return ActiveUsers(
        dau=dau, wau=wau, mau=mau, stickiness=(dau / mau) if mau else 0.0
    )


async def retention_cohorts(db: AsyncSession, weeks: int = 8) -> list[CohortRow]:
    rows = (
        await db.execute(
            text(
                f"""
                WITH cohorts AS (
                    SELECT id AS user_id,
                           date_trunc('week', created_at)::date AS cohort_week,
                           created_at::date                     AS joined_on
                    FROM app.users
                    WHERE created_at >= (now() AT TIME ZONE '{VN}')
                                        - make_interval(weeks => :weeks)
                ),
                acts AS (
                    SELECT c.user_id, c.cohort_week,
                           (a.activity_date - c.joined_on) AS day_offset
                    FROM cohorts c
                    LEFT JOIN app.user_activity_daily a
                      ON a.user_id = c.user_id AND a.was_active
                )
                SELECT cohort_week,
                       count(DISTINCT user_id)                                 AS size,
                       count(DISTINCT user_id) FILTER (WHERE day_offset >= 1)  AS r1,
                       count(DISTINCT user_id) FILTER (WHERE day_offset >= 7)  AS r7,
                       count(DISTINCT user_id) FILTER (WHERE day_offset >= 30) AS r30
                FROM acts
                GROUP BY cohort_week
                ORDER BY cohort_week DESC
                """
            ),
            {"weeks": weeks},
        )
    ).mappings().all()

    out: list[CohortRow] = []
    for r in rows:
        size = int(r["size"]) or 0
        out.append(
            CohortRow(
                cohort_week=r["cohort_week"],
                size=size,
                d1=(int(r["r1"]) / size) if size else 0.0,
                d7=(int(r["r7"]) / size) if size else 0.0,
                d30=(int(r["r30"]) / size) if size else 0.0,
            )
        )
    return out


async def activation_funnel(db: AsyncSession) -> FunnelSteps:
    row = (
        await db.execute(
            text(
                """
                SELECT
                  (SELECT count(*) FROM app.users WHERE is_active)::int AS signed_up,
                  (SELECT count(*) FROM app.users
                     WHERE is_active
                       AND (array_length(skills, 1) > 0
                            OR array_length(desired_titles, 1) > 0))::int AS profile_completed,
                  (SELECT count(DISTINCT u.id) FROM app.users u
                     LEFT JOIN app.telegram_connections t
                            ON t.user_id = u.id AND t.status = 'active'
                     LEFT JOIN app.alert_subscriptions s
                            ON s.user_id = u.id AND s.enabled
                     WHERE u.is_active AND (t.id IS NOT NULL OR s.id IS NOT NULL))::int
                     AS channel_enabled,
                  (SELECT count(DISTINCT user_id) FROM app.alert_logs)::int AS alerted
                """
            )
        )
    ).mappings().one()

    return FunnelSteps(
        signed_up=int(row["signed_up"]),
        profile_completed=int(row["profile_completed"]),
        channel_enabled=int(row["channel_enabled"]),
        alerted=int(row["alerted"]),
    )
