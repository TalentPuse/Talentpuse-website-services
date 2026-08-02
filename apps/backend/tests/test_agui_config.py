"""AG-UI phai duoc mount VO DIEU KIEN.

File nay truoc day kiem co `AGUI_ENABLED`: mac dinh tat, bat bang env. Co do
da bi go, va day la ly do — khong phai don gian hoa cho gon:

Bien `AGUI_ENABLED` mac dinh "0" va KHONG he co mat trong .env ma
.github/workflows/backend.yml sinh ra tren web box. Nen tren production sub-app
chua bao gio duoc mount: moi `POST /api/agent/` tra 404 va dock AI o
/applications im lang khong tra loi. Khong mot dong log loi nao — 404 la hanh vi
DUNG cua mot route khong ton tai, nen khong co gi de bao dong.

Do duoc trong log backend prod truoc khi sua:
    "POST /api/agent/ HTTP/1.1" 404 Not Found        (lap lai lien tuc)
    "GET /api/agent/threads/dock-<uuid>/messages" 404 Not Found

Dock phia frontend gio luon bat (flag NEXT_PUBLIC_COPILOT_DOCK cung da duoc go
vi cung mot kieu loi), nen endpoint nay BAT BUOC phai ton tai. Mot cong tac ma
trang thai duy nhat dung la "bat" thi chi con la cho de quen.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_agui_duoc_mount_khong_can_bien_moi_truong():
    """`/api/agent` phai ton tai, khong doi bien moi truong nao.

    Dung TestClient nhu context manager de CHAY THAT lifespan — mount nam trong
    `lifespan`, khong phai o module scope, nen kiem `app.routes` ngay sau import
    se luon truot (chinh la loi cua ban dau tien cua test nay).

    Chay lifespan con kiem luon mot thu quan trong hon: `init_agui` phai khoi
    dong duoc trong moi truong KHONG co OPENAI_API_KEY (CI la vay). Truoc day
    nhanh nay bi cong tac chan nen chua bao gio duoc chay trong test.

    Khang dinh 401 chu khong phai 200: request khong kem token PHAI bi middleware
    auth cua sub-app tu choi. 401 chung minh route ton tai VA duoc bao ve; 404
    la trieu chung cu tren production.
    """
    with TestClient(app) as client:
        r = client.post("/api/agent/", json={})

    assert r.status_code != 404, (
        "AG-UI chua duoc mount — dock AI se nhan 404 nhu da xay ra tren production"
    )
    assert r.status_code == 401, f"cho 401 (thieu token), nhan {r.status_code}"


def test_khong_con_co_AGUI_ENABLED():
    """Cong tac cu phai bien mat han, khong chi bi bo qua.

    De lai mot bien vo tac dung con te hon go han: lan sau co nguoi doc config
    se tuong minh tat duoc AG-UI bang cach dat AGUI_ENABLED=0, roi mat thoi gian
    tim hieu vi sao khong an thua.
    """
    import app.core.config as config

    assert not hasattr(config, "AGUI_ENABLED")
