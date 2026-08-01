"""Test sap xep theo do phu hop."""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.jobs import RERANK_POOL
from app.main import app


@pytest.mark.asyncio
async def test_sort_match_tra_ve_da_sap_giam_dan():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        email = "jobfit-rerank@local.dev"
        await c.post("/api/auth/signup", json={
            "email": email, "password": "Test12345!", "full_name": "Rerank QA"})
        tok = (await c.post("/api/auth/login", json={
            "email": email, "password": "Test12345!"})).json()["access_token"]
        h = {"Authorization": f"Bearer {tok}"}

        # DEVIATION so voi plan: plan viet `c.patch("/api/auth/me", ...)` nhung
        # route that trong app/api/auth.py CHI dang ky @router.put("/me") (khong
        # co PATCH). Dung nguyen PATCH se nhan 405, ho so khong duoc cap nhat,
        # va bai test se "xanh gia" (diem rong == sorted(diem rong) luon dung)
        # ma khong thuc su kiem chung viec sap xep. Doi sang PUT de khop dung
        # route that va thuc su kiem tra hanh vi rerank.
        await c.put("/api/auth/me", headers=h, json={
            "skills": ["python", "sql"], "preferred_cities": ["HCMC"]})

        r = await c.get("/api/jobs?sort=match&per_page=20", headers=h)

    assert r.status_code == 200
    body = r.json()
    diem = [j["match_score"] for j in body["jobs"] if j.get("match_score") is not None]
    assert diem == sorted(diem, reverse=True), "khong duoc sap giam dan"
    assert body["scored_pool"] is not None
    assert body["scored_pool"] <= RERANK_POOL
