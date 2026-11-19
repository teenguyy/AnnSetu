"""Vercel entry point: serves the AnnSetu FastAPI backend at /api/* on the same domain as the website."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

from fastapi import FastAPI  # noqa: E402

from app.main import create_app  # noqa: E402

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/api", create_app())
