"""Shared pytest fixtures for AIRTRUTH tests."""
import os

os.environ.setdefault("WAF_RATE_LIMITS", "off")
os.environ.setdefault("GEMINI_API_KEY", "")
os.environ.setdefault("ANTHROPIC_API_KEY", "")

import pytest
from fastapi.testclient import TestClient

from airtruth_engine.api import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

