"""JA-07 + JA-08 — dinh dang tin Telegram phai an toan va vua gioi han.

Hai loi nay di chung voi JA-03 thanh mot chuoi: tin hong -> Telegram tra 400 ->
`_send_message` cu nuot loi -> ghi 'sent' -> cac dong `channel='website'` da
flush truoc do khien `get_already_alerted_ids` loai job do VINH VIEN. Nguoi
dung khong bao gio nhan duoc, va khong co dong `failed` nao de retry tim ra.

- JA-07: du lieu crawl chua `<`, `>`, `&` (vd `R&D Engineer (C++/C#)`,
  `Tuyen dung <Urgent>`) di thang vao `parse_mode: HTML`.
- JA-08: `STUDENT_ALERT_LIMIT = 50` job trong MOT tin ~ gap 3 lan gioi han
  4096 ky tu cua Telegram.
"""
from __future__ import annotations

import pytest

from app.services.job_matcher import (
    CHUNK_BUDGET,
    TELEGRAM_MAX_LEN,
    MatchedJob,
    _do_dai_utf16,
    _format_job_messages,
)


def _job(**kwargs) -> MatchedJob:
    mac_dinh = dict(
        source="vietnamworks",
        source_job_id="1",
        title="Backend Engineer",
        company_name="ACME",
        city_canonical="HCMC",
        city_raw_vi="Hồ Chí Minh",
        job_level="Senior",
        salary_m=30.0,
        address="1 Nguyen Hue, Q1",
        source_url="https://www.vietnamworks.com/job-1",
        score=42.0,
    )
    mac_dinh.update(kwargs)
    return MatchedJob(**mac_dinh)


# ─── JA-07: escape ─────────────────────────────────────────────────


@pytest.mark.parametrize(
    "truong,gia_tri",
    [
        ("title", "R&D Engineer (C++/C#)"),
        ("company_name", "Tuyen dung <Urgent>"),
        ("address", "So 5 & 7, Q.1"),
        ("job_level", "Senior <Lead>"),
        ("city_raw_vi", "Hà Nội & lân cận"),
    ],
)
def test_escape_moi_truong_du_lieu_crawl(truong, gia_tri):
    """Khong duoc con `<` hay `&` tho nao lot vao tin.

    Kiem theo huong "khong con ky tu nguy hiem", khong phai "chuoi bang X":
    khang dinh sau se do khi doi chut xiu ve trinh bay, trong khi cai that su
    quan trong la Telegram con parse duoc.
    """
    (noi_dung, _), = _format_job_messages([_job(**{truong: gia_tri})])

    # Cac tag do CHINH TA sinh ra thi hop le; bo chung ra roi kiem phan con lai.
    con_lai = noi_dung
    for tag in ("<b>", "</b>", "<a href=", "</a>", '">'):
        con_lai = con_lai.replace(tag, "")
    assert "<" not in con_lai, f"con tag tho tu du lieu: {noi_dung!r}"

    # Moi `&` con lai phai la mo dau cua mot entity hop le. Bo cac entity ra
    # roi kiem — neu con `&` tran thi Telegram se tu choi ca batch.
    khong_entity = con_lai
    for entity in ("&lt;", "&gt;", "&amp;", "&quot;", "&#x27;"):
        khong_entity = khong_entity.replace(entity, "")
    assert "&" not in khong_entity, f"con `&` chua escape: {noi_dung!r}"


def test_escape_dau_nhay_trong_url():
    """`source_url` nam trong attribute `href` nen phai escape ca dau nhay.

    Mot dau `"` chua escape se dong attribute som va cho phep chen markup tuy
    y vao tin gui cho user.
    """
    (noi_dung, _), = _format_job_messages(
        [_job(source_url='https://x.com/a"onmouseover="alert(1)')]
    )

    assert 'onmouseover="' not in noi_dung
    assert "&quot;" in noi_dung


def test_bo_link_khi_url_khong_dang_tin_cay():
    """Khong co URL that thi KHONG duoc gan link ve trang chu nguon khac.

    Ban cu tra ve trang chu VietnamWorks cho moi nguon khong ro — mot dich den
    sai duoc trinh bay nhu link binh thuong (JA-E1).
    """
    (noi_dung, _), = _format_job_messages([_job(source="nguon_la", source_url=None)])

    assert "vietnamworks" not in noi_dung.lower()
    assert "<a href=" not in noi_dung


def test_linkedin_co_nhan_dang_hoang():
    (noi_dung, _), = _format_job_messages(
        [_job(source="linkedin", source_url="https://www.linkedin.com/jobs/view/1")]
    )

    assert "LinkedIn" in noi_dung
    assert "Xem trên linkedin" not in noi_dung


# ─── JA-08: chia khoi ──────────────────────────────────────────────


def test_moi_khoi_duoi_gioi_han_telegram():
    """50 job (STUDENT_ALERT_LIMIT) phai duoc chia nho, khong gui mot cuc."""
    jobs = [_job(source_job_id=str(i), title=f"Data Engineer {i}") for i in range(50)]

    khoi = _format_job_messages(jobs)

    assert len(khoi) > 1, "50 job van don vao mot tin -> Telegram tra 400 message is too long"
    for noi_dung, _ in khoi:
        assert _do_dai_utf16(noi_dung) <= TELEGRAM_MAX_LEN


def test_chia_khoi_khong_lam_mat_hay_trung_job():
    """Moi job xuat hien dung MOT lan.

    Quan trong hon "duoi gioi han": job bi bo qua trong luc chia van bi ghi la
    da-alert o nhanh `website`, tuc la mat vinh vien ma khong ai biet.
    """
    jobs = [_job(source_job_id=str(i), title=f"Role {i}") for i in range(50)]

    khoi = _format_job_messages(jobs)
    ids = [j.source_job_id for _, nhom in khoi for j in nhom]

    assert ids == [j.source_job_id for j in jobs]


def test_mot_job_van_la_mot_khoi():
    khoi = _format_job_messages([_job()])

    assert len(khoi) == 1
    assert len(khoi[0][1]) == 1


def test_khong_co_job_thi_khong_gui_gi():
    assert _format_job_messages([]) == []


def test_footer_chi_o_tin_cuoi():
    jobs = [_job(source_job_id=str(i), title=f"Role {i}") for i in range(50)]

    khoi = _format_job_messages(jobs)
    co_footer = [i for i, (noi_dung, _) in enumerate(khoi) if "talentpuse.io.vn/profile" in noi_dung]

    assert co_footer == [len(khoi) - 1]


def test_entry_qua_dai_bi_cat_thay_vi_lam_vo_khoi():
    """Mot job co dia chi dai bat thuong khong duoc keo ca khoi vuot gioi han."""
    khoi = _format_job_messages([_job(address="X" * 8000)])

    assert len(khoi) == 1
    assert _do_dai_utf16(khoi[0][0]) <= TELEGRAM_MAX_LEN


def test_do_dai_dem_theo_utf16():
    """Emoji ngoai BMP dem 2 don vi — `len()` cua Python dem 1.

    Do bang `len()` la cach vuot gioi han 4096 cua Telegram ma khong biet.
    """
    assert _do_dai_utf16("\U0001f4cb") == 2
    assert _do_dai_utf16("abc") == 3
    assert CHUNK_BUDGET < TELEGRAM_MAX_LEN
