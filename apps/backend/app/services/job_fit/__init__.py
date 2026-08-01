"""Cham diem do phu hop giua ho so nguoi dung va tin tuyen dung.

Xem docs/superpowers/specs/2026-08-01-job-fit-suite-design.md muc 2 de biet cac
phep do quyet dinh thiet ke nay.
"""
from app.services.job_fit.facts import JobFacts, fetch_facts
from app.services.job_fit.profile import Profile, build_profile
from app.services.job_fit.scoring import FitScore, combine, score_jobs

__all__ = [
    "FitScore", "JobFacts", "Profile",
    "build_profile", "combine", "fetch_facts", "score_jobs",
]
