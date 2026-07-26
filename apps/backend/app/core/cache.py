"""Cache Redis — TUỲ CHỌN theo thiết kế.

Nguyên tắc duy nhất của file này: **Redis chết thì ứng dụng vẫn chạy.**

Cache ở đây chỉ để đỡ một truy vấn kho hoặc một lượt LLM. Không có dữ liệu nào
chỉ tồn tại trong Redis. Vì vậy mọi lỗi kết nối đều bị nuốt, ghi log mức
warning, rồi trả về như thể "không có trong cache" — nơi gọi cứ tính lại.

Đây là lý do `REDIS_URL` CÓ giá trị mặc định trong docker-compose, khác hẳn
`DATABASE_URL` (cố tình không có default để nổ ngay lúc khởi động nếu thiếu):
thiếu DB là hỏng sản phẩm, thiếu cache thì chỉ chậm hơn một chút.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.core.config import REDIS_URL

logger = logging.getLogger(__name__)

_client: Any = None
_unavailable = False


def _get_client() -> Any:
    """Client dùng chung, tạo lười.

    `_unavailable` chốt lại sau lần hỏng đầu tiên: không có nó thì mỗi lần gọi
    cache lại thử kết nối lại, và khi Redis chết hẳn thì chính cái cache dựng
    lên để tăng tốc lại thành thứ làm chậm mọi request.
    """
    global _client, _unavailable
    if _unavailable:
        return None
    if _client is not None:
        return _client
    try:
        import redis.asyncio as aioredis

        _client = aioredis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        return _client
    except Exception:
        logger.warning("redis unavailable; running without cache", exc_info=True)
        _unavailable = True
        return None


async def cache_get_json(key: str) -> Any | None:
    """Đọc một giá trị JSON. Trả None khi không có, hỏng, hoặc Redis chết."""
    client = _get_client()
    if client is None:
        return None
    try:
        raw = await client.get(key)
    except Exception:
        logger.warning("redis GET failed for %s; falling back to source", key, exc_info=True)
        return None
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        # Giá trị rác (đổi định dạng giữa hai lần deploy chẳng hạn) — coi như
        # miss, đừng để một key hỏng làm chết đường đi chính.
        logger.warning("redis value for %s is not valid JSON; treating as miss", key)
        return None


async def cache_set_json(key: str, value: Any, ttl_seconds: int) -> None:
    """Ghi một giá trị JSON kèm TTL. Thất bại thì im lặng bỏ qua.

    TTL là BẮT BUỘC (không có mặc định vô hạn): mọi thứ trong cache này đều phái
    sinh từ nguồn khác, nên nó phải tự hết hạn thay vì sống mãi và phục vụ dữ
    liệu cũ sau khi nguồn đã đổi.
    """
    client = _get_client()
    if client is None:
        return
    try:
        await client.set(key, json.dumps(value, ensure_ascii=False), ex=ttl_seconds)
    except Exception:
        logger.warning("redis SET failed for %s; value not cached", key, exc_info=True)
