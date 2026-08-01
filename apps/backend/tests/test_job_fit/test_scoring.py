"""Test phep tong hop diem. Thuan Python — khong cham DB."""
from __future__ import annotations

from app.services.job_fit.facts import JobFacts
from app.services.job_fit.profile import Profile
from app.services.job_fit.scoring import combine


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


def test_ho_so_rong_tra_none_chu_khong_phai_0():
    assert combine(_profile(), _facts()) is None


def test_diem_nam_trong_khoang_0_100():
    r = combine(_profile(cities=["HCMC"]), _facts(city="HCMC"))
    assert 0 <= r.score <= 100


def test_tieu_chi_thieu_du_lieu_bi_LOAI_chu_khong_tinh_la_0():
    """Mot tin khong ghi luong khong duoc bi tru diem — dieu do chang noi gi ve
    do phu hop, no chi la lo hong cua kho du lieu. Hai tin duoi day khop y het
    nhau o moi tieu chi CO du lieu, nen phai cung diem."""
    p = _profile(cities=["HCMC"], salary_min=20_000_000)
    co_luong = combine(p, _facts(city="HCMC", salary_min=25_000_000, salary_max=30_000_000))
    khong_luong = combine(p, _facts(city="HCMC"))
    assert co_luong.score == khong_luong.score == 100
    assert "salary" in co_luong.criteria_used
    assert "salary" not in khong_luong.criteria_used


def test_criteria_used_liet_ke_dung_tieu_chi_da_dung():
    r = combine(_profile(cities=["HCMC"], level="fresher"),
                _facts(city="HCMC", job_level="Mid-level"))
    assert r.criteria_used == ["city", "level"]


def test_reasons_bo_qua_tieu_chi_khong_co_cau_giai_thich():
    r = combine(_profile(cities=["HCMC"]), _facts(city="Hanoi"))
    assert r.reasons == []


def test_thong_tin_ky_nang_duoc_nang_len_muc_tren_cung():
    """UI can doc thang, khong phai dao vao detail cua tung tieu chi."""
    r = combine(_profile(skills=["python", "sql"]),
                _facts(job_skills=["python", "airflow"], matched_skills=["python"]))
    assert r.skill_basis == "required"
    assert r.skills_matched == 1
    assert r.skills_total == 2
    assert r.missing_skills == ["airflow"]


def test_trong_so_ky_nang_at_hon_thanh_pho():
    """skills=45 vs city=15: tin khop het ky nang nhung sai thanh pho phai hon
    han tin khop thanh pho nhung truot het ky nang."""
    p = _profile(skills=["python", "sql"], cities=["HCMC"])
    manh_ky_nang = combine(p, _facts(city="Hanoi", job_skills=["python", "sql"],
                                     matched_skills=["python", "sql"]))
    manh_thanh_pho = combine(p, _facts(city="HCMC", job_skills=["python", "sql"],
                                       matched_skills=[]))
    assert manh_ky_nang.score > manh_thanh_pho.score
