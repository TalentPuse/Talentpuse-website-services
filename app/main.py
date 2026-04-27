"""FastAPI app entry point.

Routes:
  GET /              — health check
  GET /api/overview
  GET /api/skills/top
  GET /api/skills/highest-paying
  GET /api/salary/by-level
  GET /api/companies/top
  GET /docs          — Swagger UI
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import close_pool, init_pool
from app.routers import companies, overview, salary, skills


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    yield
    await close_pool()


app = FastAPI(
    title="TalentPulse Dashboard API",
    description="Read-only API serving DE/AI job market insights from gold marts.",
    version="0.1.0",
    lifespan=lifespan,
)

_default_origins = "http://localhost:8002,http://frontend:8002"
_cors_origins = os.getenv("CORS_ORIGINS", _default_origins).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(overview.router)
app.include_router(skills.router)
app.include_router(salary.router)
app.include_router(companies.router)


@app.get("/", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "talentpulse-dashboard-api"}
