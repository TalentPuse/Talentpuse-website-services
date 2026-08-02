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
