#!/usr/bin/env bash
# Copy toan bo skills trong repo len ~/.openclaw/skills/ tren box.
set -euo pipefail
mkdir -p ~/.openclaw/skills
cp -r ops/openclaw/skills/* ~/.openclaw/skills/
echo "Da copy skills vao ~/.openclaw/skills/:"
ls ~/.openclaw/skills/
