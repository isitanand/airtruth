"""Vercel / WSGI entrypoint: serves AIRTRUTH API, SDK bundle, and web app."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "engine" / "src"))

from airtruth_engine.api import app  # noqa: E402,F401
