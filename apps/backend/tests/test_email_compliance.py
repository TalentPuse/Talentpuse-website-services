"""JA-10 · JA-11 · JA-22 — tuan thu email.

Nhom nay khong phai "loi ky thuat" theo nghia thong thuong: he thong chay dung
nhu code viet. Rui ro nam o cho khac — Gmail va Yahoo BAT BUOC bulk sender phai
co one-click unsubscribe (RFC 8058), va ho ha uy tin theo DOMAIN. Gui cho nguoi
da huy (JA-10) + khong co duong huy (JA-22) = nguoi nhan bam "Report spam" =
`alerts@talentpuse.io.vn` vao spam cua TAT CA user, ke ca nhung nguoi dang cho
email do.
"""
from __future__ import annotations

import uuid

import pytest

from app.core.unsubscribe import doc_token, tao_token


# ─── JA-22: token huy ──────────────────────────────────────────────


def test_token_doc_lai_dung_user():
    uid = str(uuid.uuid4())
    assert doc_token(tao_token(uid)) == uid


@pytest.mark.parametrize(
    "token",
    [
        "",
        "khong-co-cham",
        "11111111-2222-3333-4444-555555555555.saibet",
        "11111111-2222-3333-4444-555555555555.",
        ".abcdef",
    ],
)
def test_token_sai_bi_tu_choi(token):
    assert doc_token(token) is None


def test_khong_the_doi_user_id_ma_giu_chu_ky():
    """Doi user_id phai lam chu ky vo hieu.

    Neu khong, bat ky ai nhan duoc mot email deu co the tat thong bao cua
    nguoi khac chi bang cach sua uuid tren URL.
    """
    nan_nhan = str(uuid.uuid4())
    token = tao_token(str(uuid.uuid4()))
    _, _, sig = token.rpartition(".")

    assert doc_token(f"{nan_nhan}.{sig}") is None


def test_email_co_header_list_unsubscribe_va_link_trong_than_mail():
    """Ca HAI deu can, khong phai chon mot.

    Header phuc vu mail client (Gmail hien nut Unsubscribe canh dia chi gui);
    link trong than mail phuc vu nguoi doc tren mobile, noi nut do thuong bi
    an. Thieu cai nao thi mot nhom nguoi dung khong co duong huy.
    """
    from app.services.email import _build_job_alert_html, _unsubscribe_url
    from app.services.job_matcher import MatchedJob

    uid = uuid.uuid4()
    url = _unsubscribe_url(uid)

    assert url is not None
    assert str(uid) in url
    assert "/email/alerts/unsubscribe/one-click" in url

    html = _build_job_alert_html(
        "Test",
        [MatchedJob(source="vietnamworks", source_job_id="1", title="Dev")],
        url,
    )
    assert url in html


def test_khong_co_user_id_thi_khong_bia_ra_link():
    """Khong biet user la ai thi tra None chu khong dung link hong.

    Mot link huy khong hoat dong con te hon khong co link: nguoi dung bam,
    khong thay gi xay ra, roi bam Report spam.
    """
    from app.services.email import _unsubscribe_url

    assert _unsubscribe_url(None) is None


# ─── JA-10: "Email tat ca" ─────────────────────────────────────────


def test_email_all_users_loc_theo_subscription():
    """Chi gui cho nguoi dang bat `email_job_match`.

    Ban cu chi loc `is_active AND NOT is_admin` va co tinh bo qua
    AlertSubscription — nguoi da bam huy van nhan.
    """
    import inspect

    from app.services import job_alert

    src = inspect.getsource(job_alert._email_all_users_locked)

    assert "AlertSubscription" in src, "van gui cho ca nguoi da huy nhan mail"
    assert "EMAIL_ALERT_TYPE" in src


# ─── JA-11: /stop cua Telegram ─────────────────────────────────────


def test_stop_telegram_khong_tat_email():
    """`/stop` chi duoc tat kenh Telegram.

    Ban cu `UPDATE alert_subscriptions ... WHERE user_id = :uid` khong loc
    `alert_type`, nen go /stop trong Telegram tat luon email ma user da bat o
    mot noi hoan toan khac — khong co gi bao cho ho biet.
    """
    import inspect

    from app.services import telegram

    src = inspect.getsource(telegram._handle_stop)

    assert 'alert_type == "job_match"' in src, "/stop van go ca subscription email"


# ─── JA-17: escape HTML trong email ────────────────────────────────


@pytest.mark.parametrize(
    "truong,gia_tri",
    [
        ("title", "R&D Engineer <script>alert(1)</script>"),
        ("company_name", "Cty <b>ABC</b> & Co"),
        ("city_raw_vi", "Hà Nội & lân cận"),
        ("job_level", "Senior <Lead>"),
    ],
)
def test_email_escape_du_lieu_crawl(truong, gia_tri):
    """Du lieu crawl khong duoc noi tho vao HTML cua mail (JA-17)."""
    from app.services.email import _build_job_alert_html
    from app.services.job_matcher import MatchedJob

    job = MatchedJob(source="vietnamworks", source_job_id="1", title="Dev")
    setattr(job, truong, gia_tri)

    html = _build_job_alert_html("Test", [job])

    assert "<script>" not in html
    assert "<b>ABC</b>" not in html


def test_email_escape_dau_nhay_trong_url():
    """`source_url` nam trong attribute href — mot dau nhay chua escape cho
    phep chen markup tuy y vao mail gui cho nguoi dung."""
    from app.services.email import _build_job_alert_html
    from app.services.job_matcher import MatchedJob

    html = _build_job_alert_html(
        "Test",
        [MatchedJob(
            source="vietnamworks", source_job_id="1", title="Dev",
            source_url='https://x.com/a" onmouseover="alert(1)',
        )],
    )

    assert 'onmouseover="' not in html


def test_email_escape_ten_nguoi_dung():
    """`full_name` do nguoi dung tu nhap — cung la du lieu khong tin cay."""
    from app.services.email import _build_job_alert_html
    from app.services.job_matcher import MatchedJob

    html = _build_job_alert_html(
        "<script>alert(1)</script>",
        [MatchedJob(source="vietnamworks", source_job_id="1", title="Dev")],
    )

    assert "<script>" not in html


# ─── JA-45: wildcard SQL trong tieu de mong muon ───────────────────


@pytest.mark.parametrize(
    "nhap,mong_doi",
    [
        ("Data Engineer", "%Data Engineer%"),
        ("Senior_Engineer", "%Senior\_Engineer%"),
        ("%", "%\%%"),
        ("100%_dev", "%100\%\_dev%"),
    ],
)
def test_mau_ilike_thoat_wildcard(nhap, mong_doi):
    """`%` va `_` la wildcard cua LIKE, khong phai ky tu binh thuong.

    Mot title chi co `%` se khop MOI job — nguoi dung khong he yeu cau dieu do
    va ket qua alert sai ma khong co dau hieu gi (JA-45).
    """
    from app.services.job_matcher import _mau_chua

    assert _mau_chua(nhap) == mong_doi


# ─── JA-55 / JA-56: 422 thay vi 500 ────────────────────────────────


@pytest.mark.parametrize(
    "truong,gia_tri",
    [
        ("graduation_year", 20255),      # nam 5 chu so — vuot smallint
        ("graduation_year", 1800),
        ("desired_salary_min", 10**12),  # vuot int4
        ("desired_salary_min", -1),
        ("full_name", "x" * 300),        # vuot varchar(255)
        ("full_name", ""),
        ("university", "y" * 300),       # vuot varchar(200)
    ],
)
def test_ho_so_tu_choi_gia_tri_ngoai_kieu_cot(truong, gia_tri):
    """Gia tri vuot kieu cot Postgres phai bi chan o schema.

    Neu khong, asyncpg nem loi va API tra 500 KEM STACK TRACE thay vi 422 —
    chan luon luong hoan thien ho so ma khong noi duoc sai o dau.
    """
    from pydantic import ValidationError

    from app.schemas.auth import UserUpdate

    with pytest.raises(ValidationError):
        UserUpdate(**{truong: gia_tri})


def test_ho_so_hop_le_van_qua_duoc():
    from app.schemas.auth import UserUpdate

    u = UserUpdate(full_name="Nguyen Van A", graduation_year=2025, desired_salary_min=20_000_000)
    assert u.graduation_year == 2025
