# Deploy guide — VPS 2GB RAM

End-to-end recipe để deploy TalentPulse dashboard lên VPS budget (Hetzner CX11, Contabo VPS S, DigitalOcean basic, Vultr regular).

## Memory budget (slim stack, 2GB target)

| Service | RAM peak | Container memory limit |
|---|---|---|
| Postgres 15 | 400 MB | 400M (`shared_buffers=128MB`) |
| MinIO | 150 MB | 200M |
| FastAPI backend | 150 MB | 200M |
| Next.js frontend | 250 MB | 300M |
| Caddy (HTTPS) | 30 MB | 50M |
| **Subtotal** | **~980 MB** | |
| Docker engine | 200 MB | — |
| Ubuntu 22.04 minimal | 400 MB | — |
| **Total** | **~1.6 GB** | ✅ Fits 2GB |

**Buffer**: ~400MB cho swap + spike. Recommend tạo 1GB swap file để safety net.

## Recommended VPS

| Provider | Plan | Price | Region |
|---|---|---|---|
| **Hetzner** | CX11 (2GB/1vCPU/20GB SSD) | €4.15/mo | EU (Helsinki/Falkenstein) |
| **Contabo** | VPS S (4GB/2vCPU/50GB) | €4.50/mo | EU/Asia/US — **best ratio** |
| **DigitalOcean** | Basic (2GB/1vCPU/50GB) | $12/mo | Singapore (latency tốt cho VN) |
| **Vultr** | Regular (2GB/1vCPU/55GB) | $10/mo | Singapore/Tokyo |

Em recommend **Contabo VPS S** (4GB cùng giá Hetzner 2GB → có thể giữ Metabase + Prefect nếu cần).

## Step-by-step

### 1. VPS setup (5 min)

SSH vào VPS:
```bash
ssh root@YOUR_VPS_IP
```

Tạo user non-root:
```bash
adduser talentpulse
usermod -aG sudo talentpulse
rsync --archive --chown=talentpulse:talentpulse ~/.ssh /home/talentpulse
```

Thoát + login lại bằng `talentpulse@YOUR_VPS_IP`.

### 2. Install Docker (3 min)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker  # apply group without logout
docker --version
docker compose version
```

### 3. Add swap file (1 min) — important on 2GB VPS

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h  # verify swap line shows 1.0Gi
```

### 4. Firewall (2 min)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp     # Caddy HTTP (auto-redirect to HTTPS)
sudo ufw allow 443/tcp    # Caddy HTTPS
sudo ufw enable
sudo ufw status
```

**Không expose** port 5432 (Postgres), 9000 (MinIO), 8000 (backend), 3001 (frontend) — chỉ Caddy port 443 ra ngoài.

### 5. Clone + configure (3 min)

```bash
mkdir -p ~/apps && cd ~/apps
git clone https://github.com/YOUR_USER/talentpulse-dashboard.git dashboard
cd dashboard/backend

# Copy env template
cp .env.example .env
nano .env   # set strong POSTGRES_PASSWORD + PUBLIC_API_URL=https://your-domain.com
```

Edit `Caddyfile`:
```bash
sed -i 's/your-domain.com/dashboard.yourdomain.com/' Caddyfile
```

### 6. Point domain DNS (5 min)

Tại registrar (Namecheap, Cloudflare, GoDaddy):
- **A record** `dashboard.yourdomain.com` → `YOUR_VPS_IP`
- TTL 5 minutes (sau ổn định đổi lại 1h)

Verify:
```bash
dig +short dashboard.yourdomain.com
# expected: YOUR_VPS_IP
```

### 7. Boot stack (5 min)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Lần đầu Caddy sẽ auto request Let's Encrypt cert (cần DNS đã trỏ đúng).

Watch logs:
```bash
docker compose -f docker-compose.prod.yml logs -f caddy
# Look for: "certificate obtained successfully"
```

### 8. Bootstrap database (2 min — one-off)

VPS này chưa có dbt schema (chỉ là Postgres trắng + user). Pipeline chạy trên local/separate box → push data lên qua SSH tunnel hoặc public Postgres port (NOT recommended).

**Option A — SSH tunnel (secure)**: từ pipeline box (laptop):
```bash
ssh -L 15432:localhost:5432 talentpulse@YOUR_VPS_IP
# Trong pipeline_data/, set:
export DBT_HOST=localhost DBT_PORT=15432
cd dbt_transform && DBT_PROFILES_DIR=. dbt build
```

**Option B — pg_dump/restore**: dump local → upload → restore:
```bash
# Local
pg_dump -h localhost -U admin warehouse > tp.sql

# Upload
scp tp.sql talentpulse@YOUR_VPS_IP:/tmp/

# VPS
docker exec -i tp-postgres psql -U admin -d warehouse < /tmp/tp.sql
```

Sau khi data có → grant cho `metabase_ro`:
```bash
docker exec -it tp-postgres psql -U admin -d warehouse <<SQL
GRANT USAGE ON SCHEMA dbt_dev_gold, dbt_dev_silver, dbt_dev_bronze,
                      dbt_dev_feature, dbt_dev_seeds TO metabase_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA dbt_dev_gold TO metabase_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA dbt_dev_silver TO metabase_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA dbt_dev_bronze TO metabase_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA dbt_dev_feature TO metabase_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA dbt_dev_seeds TO metabase_ro;
SQL
```

### 9. Verify (1 min)

```bash
curl https://dashboard.yourdomain.com/                       # → Next.js HTML
curl https://dashboard.yourdomain.com/api/overview           # → JSON
curl https://dashboard.yourdomain.com/docs                   # → Swagger
```

Mở browser: https://dashboard.yourdomain.com 🎉

## Daily ops

### Update code
```bash
cd ~/apps/dashboard/backend
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### Backup Postgres (daily)

`/etc/cron.daily/tp-backup`:
```bash
#!/bin/bash
BACKUP_DIR=/home/talentpulse/backups
mkdir -p "$BACKUP_DIR"
docker exec tp-postgres pg_dump -U admin warehouse | gzip > "$BACKUP_DIR/warehouse-$(date +%F).sql.gz"
# Keep last 7 days
find "$BACKUP_DIR" -name "warehouse-*.sql.gz" -mtime +7 -delete
```

`sudo chmod +x /etc/cron.daily/tp-backup`

### Off-site backup (recommended)

Push backup lên S3-compatible:
```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash
rclone config  # configure backblaze/r2/wasabi

# In cron:
rclone copy /home/talentpulse/backups remote:tp-backups --max-age 7d
```

### Monitor RAM
```bash
docker stats --no-stream
free -h
```

Nếu RAM > 1.8GB sustained → restart frontend (Node memory leak):
```bash
docker compose -f docker-compose.prod.yml restart frontend
```

## Troubleshooting

| Issue | Diagnose | Fix |
|---|---|---|
| Caddy không lấy được cert | `docker logs tp-caddy` → DNS chưa propagate | `dig +short domain` xác nhận, đợi 5-10 phút |
| Backend OOM | `dmesg \| grep -i kill` | Tăng memory limit hoặc add swap |
| Postgres slow | `docker exec tp-postgres psql -U admin -d warehouse -c "select * from pg_stat_activity;"` | Add index, hoặc tăng `shared_buffers` |
| Frontend 502 | `docker logs tp-frontend` | Backend chưa healthy → `restart backend` |
| Disk full | `df -h` | Clean: `docker system prune -af`, rotate logs |

## Out of scope (next phase)

- **CDN cho frontend assets** (Cloudflare free tier)
- **Read replica Postgres** (khi >1k req/s)
- **Multi-region** (dashboard.eu vs dashboard.asia)
- **CI/CD** (GitHub Actions auto-deploy on push to main)
- **Monitoring** (Prometheus + Grafana, hoặc paid: Datadog free tier)

## Security checklist

- [x] Non-root user trên VPS
- [x] SSH key auth (disable password login)
- [x] UFW firewall (only 22/80/443)
- [x] Strong DB password trong `.env` (không commit)
- [x] `metabase_ro` read-only Postgres user (không grant INSERT/UPDATE/DELETE)
- [x] HTTPS qua Caddy (auto cert)
- [x] CORS limited to known origins
- [ ] Rate limiting (add to Caddyfile khi traffic tăng)
- [ ] Fail2ban cho SSH (paranoid mode)
- [ ] DB backup encrypted before off-site upload
