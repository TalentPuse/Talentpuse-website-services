"""JA-02 — `_next_alert_slot()` khong duoc lap vo han.

Vong lap cu dung dieu kien `while t.time() <= ALERT_END_TIME`: no chi so
GIO-TRONG-NGAY, khong so NGAY. Moi interval ma boi so cua no roi lai vao khung
07:30-21:30 cua ngay hom sau deu KHONG BAO GIO thoat.

Nghiem trong vi day la vong lap DONG BO khong co `await` nao ben trong, chay
tren event loop chinh (`_alert_loop` o main.py): no chen ca process — toan bo
API chet, ke ca health check — va `slots` phinh toi OOM.

Va admin dat duoc gia tri do tu UI: `PUT /api/admin/config` ->
`ConfigUpdate.alert_interval_seconds` truoc day khong co rang buoc nao, nen
"2 lan/ngay" (43200s) tra 200 roi lam sap backend o lan thuc day ke tiep.

Khong gia dinh pytest-timeout co san: neu ham TRA VE duoc thi no da thoat.
"""
from __future__ import annotations

from datetime import datetime

import pytest
from pydantic import ValidationError

from app.core.config import VN_TZ
from app.main import _next_alert_slot
from app.schemas.admin import ConfigUpdate


# Bao gom dung cac gia tri da reproduce duoc treo: 6h, 12h, 24h.
# 1800 va 7200 (mac dinh) la doi chung — chung luon chay binh thuong.
@pytest.mark.parametrize("giay", [1800, 7200, 21600, 43200, 86400])
def test_khong_treo_voi_moi_interval_hop_le(monkeypatch, giay):
    monkeypatch.setattr("app.main.get_alert_interval_hours", lambda: giay / 3600.0)

    slot = _next_alert_slot()

    assert slot is not None
    assert slot.tzinfo is not None, "slot phai co timezone, khong duoc naive"


def test_luon_tra_ve_slot_o_tuong_lai(monkeypatch):
    monkeypatch.setattr("app.main.get_alert_interval_hours", lambda: 2.0)

    slot = _next_alert_slot()

    assert slot > datetime.now(VN_TZ), "slot da qua thi loop se ban lien tuc"


@pytest.mark.parametrize("giay", [0, -1, 60, 86401, 999999])
def test_schema_tu_choi_interval_ngoai_khoang(giay):
    """Chan ngay tu API: khong de admin dat duoc gia tri nguy hiem.

    60s bi tu choi CO CHU DICH du no khong lam treo: scheduler co
    `max(..., 0.5)` nen thuc te lam tron len 30 phut trong khi API xac nhan
    60s — admin se ket luan nham la alert hong (JA-T4).
    """
    with pytest.raises(ValidationError):
        ConfigUpdate(alert_interval_seconds=giay)


@pytest.mark.parametrize("giay", [1800, 7200, 43200, 86400])
def test_schema_chap_nhan_khoang_hop_le(giay):
    assert ConfigUpdate(alert_interval_seconds=giay).alert_interval_seconds == giay
