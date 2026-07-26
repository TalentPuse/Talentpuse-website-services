# Sửa 3 test `mcp` đỏ và gắn gate pytest vào CI

> Spec ngày 2026-07-26. Việc **A** trong ba việc còn nợ. Nhỏ, độc lập với B và C.

## Vấn đề

`apps/mcp` có bộ test nhưng `.github/workflows/mcp.yml` **không chạy pytest** — workflow đi thẳng từ `build-and-push` sang `deploy`. Không có gì gác cho MCP server, vốn là thứ 2 agent AI của backend gọi vào.

Chạy thử ngày 2026-07-26 trong container `tp-mcp`:

- Chạy từ `/app`: **3 lỗi collection** — `ModuleNotFoundError: No module named 'tests'`
- Chạy từ `/app/mcp_server`: **78 pass / 3 fail**

Lỗi collection chỉ là sai thư mục gốc, không phải lỗi code. Ba test thật sự đỏ:

| Test | Trạng thái |
|---|---|
| `tests/test_repositories/test_skill_repo.py::TestSkillDemand::test_demand_with_category` | nguyên nhân đã biết, xem dưới |
| `tests/test_tools/test_job_search.py::test_search_jobs_source_error_graceful` | chưa chẩn đoán |
| (một test nữa trong cùng lượt chạy) | chưa chẩn đoán |

## Lỗi đã xác định: tham số `category` bị nuốt

`apps/mcp/repositories/skill_repo.py` — `gap()` và `demand()` **nhận tham số `category` nhưng không bao giờ đưa nó vào SQL**.

Đây là **lỗi im lặng**, nguy hiểm hơn lỗi ném exception: người gọi truyền `category="Data Engineer"`, nhận về kết quả của *toàn bộ* ngành, và không có tín hiệu nào cho biết bộ lọc đã bị bỏ qua. Agent AI dùng chính con số đó để tư vấn cho người dùng.

Đã ghi nhận trong ledger từ 2026-07-12 (lúc làm Task 5a của plan board-copilot) nhưng chưa sửa vì ngoài phạm vi khi đó.

## Thiết kế

**1. Sửa `skill_repo`.** Đưa `category` vào mệnh đề `WHERE`, **tham số hoá** (`:category`), không nội suy chuỗi vào SQL. Giữ nguyên hành vi khi `category=None` — lúc đó không thêm điều kiện, đúng như hiện tại.

**2. Chẩn đoán 2 test còn lại trước khi sửa.** Không đoán. Chạy từng test, đọc lỗi thật, rồi mới quyết định sửa code hay sửa test. Nếu hoá ra test sai kỳ vọng thì sửa test — nhưng phải nêu rõ lý do trong commit, **không lặng lẽ nới assertion**.

**3. Gắn gate vào `mcp.yml`.** Thêm job `test` chạy trước `build-and-push`, và `deploy` phụ thuộc `test` — cùng khuôn với `backend.yml`.

⚠️ Bước chạy pytest **bắt buộc** đặt `working-directory` đúng thư mục chứa `tests/`. Chạy sai chỗ là `ModuleNotFoundError: No module named 'tests'`, CI đỏ vì lý do không liên quan gì tới chất lượng code. Ghi hẳn lý do này thành comment trong workflow để người sau không "dọn cho gọn" rồi vỡ lại.

## Kiểm chứng

- `pytest` trong `apps/mcp` xanh **81/81** (78 đang xanh + 3 vừa sửa).
- Thêm một test chứng minh `category` **thực sự lọc**: gọi với hai category khác nhau trên cùng dữ liệu và nhận hai kết quả khác nhau. Test cũ chỉ kiểm hàm chạy được, nên nó xanh cả khi tham số bị nuốt — đó chính là lý do lỗi sống sót tới giờ.
- CI: đẩy một commit chạm `apps/mcp/**`, xác nhận job `test` chạy, và `deploy` bị chặn khi test đỏ.

## Ngoài phạm vi

- Các lỗi khác của MCP server không nằm trong 3 test này.
- Thêm test coverage mới ngoài test chứng minh `category`.
