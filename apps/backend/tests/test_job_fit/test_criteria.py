"""Test tung tieu chi mot. Thuan Python — khong cham DB."""
from __future__ import annotations

import pytest

from app.services.job_fit.criteria import CRITERIA, SKILL_SATURATION
from app.services.job_fit.facts import JobFacts
from app.services.job_fit.profile import Profile


def _facts(**kw) -> JobFacts:
    base = dict(
        source="linkedin", source_job_id="j1", title="Data Engineer",
        company_name="Co", city="HCMC", job_level="Mid-level", job_category="Data",
        salary_min=None, salary_max=None, salary_avg=None,
        matched_skills=[], job_skills=[], has_text=True,
    )
    base.update(kw)
    return JobFacts(**base)


def _profile(**kw) -> Profile:
    base = dict(skills=[], titles=[], cities=[], salary_min=None, salary_max=None, level=None)
    base.update(kw)
    return Profile(**base)


def _run(key: str, profile: Profile, facts: JobFacts):
    crit = next(c for c in CRITERIA if c.key == key)
    return crit.evaluate(profile, facts)


# -- skills --------------------------------------------------------

def test_skills_khong_co_ky_nang_thi_tieu_chi_khong_ap_dung():
    assert _run("skills", _profile(), _facts()).score is None


def test_skills_co_so_required_khi_tin_co_ky_nang_cau_truc():
    """Tin co ky nang cau truc => dem duoc dap ung bao nhieu phan YEU CAU.
    Day la con so nguoi dung tin duoc: 'ban co 2/4 ky nang'."""
    r = _run("skills",
             _profile(skills=["python", "sql", "react"]),
             _facts(job_skills=["python", "sql", "airflow", "dbt"],
                    matched_skills=["python", "sql"]))
    assert r.detail["basis"] == "required"
    assert r.score == pytest.approx(2 / 4)
    assert "2/4" in r.reason


def test_skills_co_so_mentioned_khi_tin_khong_co_ky_nang_cau_truc():
    """Toan bo 4130 tin LinkedIn roi vao nhanh nay. Khong duoc de chung khong co
    diem chi vi ETL chua trich ky nang cho nguon do."""
    r = _run("skills",
             _profile(skills=["python", "sql", "react"]),
             _facts(job_skills=[], matched_skills=["python", "sql"], has_text=True))
    assert r.detail["basis"] == "mentioned"
    assert r.score == pytest.approx(2 / SKILL_SATURATION)


def test_skills_bao_hoa_khong_vuot_qua_1():
    r = _run("skills",
             _profile(skills=[f"s{i}" for i in range(20)]),
             _facts(job_skills=[], matched_skills=[f"s{i}" for i in range(20)]))
    assert r.score == pytest.approx(1.0)


def test_skills_thieu_gi_chi_tra_ve_khi_biet_tin_yeu_cau_gi():
    """Tin khong co ky nang cau truc thi ta KHONG BIET no yeu cau gi — tra rong
    thay vi doan bua."""
    co = _run("skills", _profile(skills=["python"]),
              _facts(job_skills=["python", "airflow"], matched_skills=["python"]))
    assert co.detail["missing"] == ["airflow"]

    khong = _run("skills", _profile(skills=["python"]),
                 _facts(job_skills=[], matched_skills=["python"]))
    assert khong.detail["missing"] == []


# -- title ---------------------------------------------------------

def test_title_khop_toan_bo_tu():
    r = _run("title", _profile(titles=["data engineer"]), _facts(title="Senior Data Engineer"))
    assert r.score == pytest.approx(1.0)


def test_title_khop_mot_phan():
    r = _run("title", _profile(titles=["data engineer"]), _facts(title="Data Analyst"))
    assert r.score == pytest.approx(0.5)


def test_title_lay_max_tren_cac_vi_tri_mong_muon():
    r = _run("title", _profile(titles=["kien truc su", "data engineer"]),
             _facts(title="Data Engineer"))
    assert r.score == pytest.approx(1.0)


# -- city ----------------------------------------------------------

def test_city_khop_va_khong_khop():
    assert _run("city", _profile(cities=["HCMC"]), _facts(city="HCMC")).score == 1.0
    assert _run("city", _profile(cities=["HCMC"]), _facts(city="Hanoi")).score == 0.0


def test_city_tin_khong_ghi_thanh_pho_thi_tieu_chi_khong_ap_dung():
    """1077/6432 tin co city_canonical rong. Cham 0 diem cho chung la phat nguoi
    dung vi lo hong cua kho du lieu."""
    assert _run("city", _profile(cities=["HCMC"]), _facts(city=None)).score is None


# -- salary --------------------------------------------------------

def test_salary_giao_nhau_thi_tron_diem():
    r = _run("salary", _profile(salary_min=20_000_000, salary_max=30_000_000),
             _facts(salary_min=25_000_000, salary_max=35_000_000))
    assert r.score == pytest.approx(1.0)


def test_salary_tra_cao_hon_mong_muon_khong_bi_tru_diem():
    r = _run("salary", _profile(salary_min=20_000_000, salary_max=30_000_000),
             _facts(salary_min=50_000_000, salary_max=60_000_000))
    assert r.score == pytest.approx(1.0)


def test_salary_tra_thap_hon_thi_giam_dan_chu_khong_cat_ve_0():
    """Tin lech 5% khong the bi doi xu nhu tin lech 80%."""
    r = _run("salary", _profile(salary_min=20_000_000, salary_max=None),
             _facts(salary_min=19_000_000, salary_max=19_000_000))
    assert 0.9 < r.score < 1.0


def test_salary_tin_khong_ghi_luong_thi_khong_ap_dung():
    assert _run("salary", _profile(salary_min=20_000_000), _facts()).score is None


# -- level ---------------------------------------------------------

def test_level_khop_hoan_toan_va_mot_phan():
    assert _run("level", _profile(level="fresher"),
                _facts(job_level="Fresher/Entry level")).score == 1.0
    assert _run("level", _profile(level="fresher"),
                _facts(job_level="Mid-level")).score == 0.5
    assert _run("level", _profile(level="fresher"),
                _facts(job_level="Director+")).score == 0.0
