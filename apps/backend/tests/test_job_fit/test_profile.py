"""Test chuan hoa ho so cho engine cham diem."""
from __future__ import annotations

from app.models.user import User
from app.services.job_fit.profile import MAX_SKILLS_SCANNED, build_profile


def _user(**kw) -> User:
    base = dict(
        skills=[], desired_titles=[], preferred_cities=[],
        desired_salary_min=None, desired_salary_max=None, experience_level=None,
    )
    base.update(kw)
    return User(**base)


def test_ho_so_rong_thi_is_empty():
    """Khong co tieu chi nao => KHONG cham diem duoc. Tra diem cho ho so trong la
    bia so, va no day nguoi dung den ket luan rang diem nay vo nghia."""
    assert build_profile(_user()).is_empty is True


def test_chi_can_mot_tieu_chi_la_khong_rong():
    assert build_profile(_user(preferred_cities=["HCMC"])).is_empty is False


def test_loai_ky_nang_nhieu():
    """'ai' khop 42% tong so tin ngay ca khi da dung bien tu — do la nhieu, khong
    phai tin hieu. 'airflow' thi giu, dung cat nham theo tien to."""
    p = build_profile(_user(skills=["ai", "data", "english", "airflow", "python"]))
    assert "ai" not in p.skills
    assert "data" not in p.skills
    assert "english" not in p.skills
    assert set(p.skills) == {"airflow", "python"}


def test_chuan_hoa_chu_thuong_va_bo_trung():
    p = build_profile(_user(skills=["Python", "python", "  PYTHON  "]))
    assert p.skills == ["python"]


def test_chan_so_ky_nang_va_uu_tien_cai_dai():
    """Quet text ton ~250ms/ky nang/6432 tin nen phai chan. Khi cat thi giu cai
    DAI hon vi no dac trung hon: 'machine learning' phan biet tot hon 'go'."""
    skills = [f"skill{i}" for i in range(50)] + ["machine learning engineering"]
    p = build_profile(_user(skills=skills))
    assert len(p.skills) == MAX_SKILLS_SCANNED
    assert "machine learning engineering" in p.skills


def test_chuan_hoa_thanh_pho_ve_tu_vung_kho():
    p = build_profile(_user(preferred_cities=["Hồ Chí Minh", "ha noi", "khong-ton-tai"]))
    assert p.cities == ["HCMC", "Hanoi"]


def test_doi_cho_khi_luong_min_lon_hon_max():
    """Du lieu that co ca ca nay (qa-bob@local.dev: min=90000000, max=1000).
    Doi cho thay vi bo qua, de khong am tham danh rot tieu chi luong."""
    p = build_profile(_user(desired_salary_min=90_000_000, desired_salary_max=1000))
    assert p.salary_min == 1000
    assert p.salary_max == 90_000_000
