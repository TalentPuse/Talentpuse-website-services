"""Them repo root vao sys.path de import duoc ops.openclaw.scripts."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
