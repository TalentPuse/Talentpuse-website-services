# Umami — cap phat mot lan

Umami la cong cu do luu luong tu host. No chay trong compose (service `umami`,
container `tp-umami`) va chi ra ngoai qua nginx theo duong `/s/*`.

Cac buoc duoi day **chua duoc chay** — chung can mot bi mat do con nguoi sinh
ra, nen khong the tu dong hoa trong lan thay doi ma nay.

## 0. Vi sao database rieng

`umami_app` chi so huu database `umami` va **khong co quyen gi** tren database
cua ung dung. Umami la phan mem ben thu ba, co man dang nhap phoi ra Internet.
Neu no dung chung role voi app thi mot lo hong o Umami doc duoc thang bang
`app.users` — tuc la toan bo email va mat khau bam cua nguoi dung that.

## 1. Sinh hai bi mat

```bash
openssl rand -base64 32                                    # -> UMAMI_APP_SECRET
python -c "import secrets; print(secrets.token_urlsafe(32))"  # -> UMAMI_DB_PASSWORD
```

Ghi ca hai vao `.env` o thu muc goc (file nay bi `.gitignore` chan).
Mau bien nam o `.env.example`. **Khong commit gia tri that.**

## 2. Tao role va database

Luu y: superuser cua Postgres trong compose la `${APP_POSTGRES_USER}`
(mac dinh `talentpulse`), **khong phai** `postgres`.

```bash
docker compose exec postgres psql -U "${APP_POSTGRES_USER:-talentpulse}" -d postgres \
  -c "CREATE ROLE umami_app LOGIN PASSWORD '<UMAMI_DB_PASSWORD vua sinh>';"
docker compose exec postgres psql -U "${APP_POSTGRES_USER:-talentpulse}" -d postgres \
  -c "CREATE DATABASE umami OWNER umami_app;"
```

## 3. Khoi dong

```bash
docker compose up -d umami
docker compose logs -f umami    # cho migration cua Umami chay xong, roi Ctrl-C
docker compose exec umami wget -qO- http://localhost:3000/api/heartbeat
```

Lan khoi dong dau chay migration rieng cua Umami, mat khoang 30-60 giay.

## 4. Kiem tra CO LAP thuc su (bat buoc, dung bo qua)

```bash
docker compose exec postgres psql -U umami_app -d "${APP_POSTGRES_DB:-talentpulse}" \
  -c "SELECT count(*) FROM app.users;"
```

Ky vong: **permission denied** (hoac khong ket noi duoc database do).
Neu lenh nay tra ve mot con so thi role dang co qua nhieu quyen — phai sua
xong roi moi di tiep. Day la ranh gioi ma toan bo quyet dinh tach database
dua vao.

## 5. Tao website va lay ID

Dang nhap giao dien Umami (qua `/s/` sau khi Task 6 xong, hoac tam thoi bang
`docker compose port umami 3000`):

1. Tai khoan mac dinh la `admin` / `umami` — **doi mat khau ngay lan dau**.
   De nguyen la de ngo mot trang quan tri co san mat khau ai cung biet.
2. Them website voi domain `talentpuse.io.vn`.
3. Chep website ID sinh ra vao `.env` cua deploy:
   `NEXT_PUBLIC_UMAMI_WEBSITE_ID=<id>`

Frontend can dung ID nay (xem `apps/frontend/.env.example`). ID nay cong khai
theo thiet ke — no chi dinh danh trang web, khong phai bi mat.

## 6. Ghi lai

| Thu | O dau |
|---|---|
| `UMAMI_APP_SECRET` | `.env` o goc (khong commit) |
| `UMAMI_DB_PASSWORD` | `.env` o goc (khong commit), khop voi role `umami_app` |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | `.env` o goc, lay tu giao dien Umami |
| Mat khau admin Umami | trinh quan ly mat khau — KHONG de nguyen mac dinh |
