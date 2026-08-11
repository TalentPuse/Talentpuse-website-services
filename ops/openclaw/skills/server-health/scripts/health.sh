#!/usr/bin/env bash
# Doc trang thai suc khoe web box — CHI DOC, khong thay doi gi.
# Goi bang skills cua OpenClaw khi user hoi ve suc khoe server.
set -uo pipefail

echo "=== DISK ==="
df -h / | tail -1 | awk '{print "Con lai: " $4 " / " $2 " (" $5 " da dung)"}'

echo ""
echo "=== RAM / CPU ==="
free -h | awk '/Mem:/{print "RAM: " $3 " / " $2 " dang dung"}'
uptime | sed 's/^ *//'

echo ""
echo "=== DOCKER CONTAINERS ==="
if command -v docker >/dev/null 2>&1; then
  docker ps --format '{{.Names}}\t{{.Status}}' 2>/dev/null || echo "(khong chay duoc docker ps)"
else
  echo "(khong co docker)"
fi

echo ""
echo "=== LOG LOI BACKEND GAN DAY ==="
if docker ps --filter "name=tp-backend" --format '{{.Names}}' 2>/dev/null | grep -q .; then
  docker logs --tail 30 tp-backend 2>&1 | grep -iE "error|exception|traceback" | tail -5 || echo "(khong co loi gan day)"
else
  echo "(khong tim thay container tp-backend)"
fi
