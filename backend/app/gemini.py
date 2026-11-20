"""Gemini through its OpenAI-compatible endpoint (Bearer API key)."""
import base64
import json
import re
from typing import Any

import httpx

from .config import Settings


class AIUnavailable(Exception):
    pass


class Gemini:
    def __init__(self, settings: Settings, client: httpx.AsyncClient):
        self.s = settings
        self.c = client

    async def chat(self, messages: list[dict], *, json_mode: bool = False, temperature: float = 0.2,
                   reasoning: str | None = "none") -> str:
        if not self.s.ai_enabled:
            raise AIUnavailable("AI is not configured (GEMINI_API_KEY is missing).")
        body: dict[str, Any] = {"model": self.s.gemini_model, "messages": messages, "temperature": temperature}
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        if reasoning:
            body["reasoning_effort"] = reasoning  # "none" keeps answers fast (about 1 s)
        last: Exception | None = None
        models = [self.s.gemini_model] + [m for m in [self.s.gemini_fallback_model] if m and m != self.s.gemini_model]
        for model in [models[0], *models]:  # primary twice, then the fallback model
            body["model"] = model
            try:
                r = await self.c.post(
                    f"{self.s.gemini_base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.s.gemini_api_key}"},
                    json=body,
                    timeout=90,
                )
                if r.status_code >= 500 or r.status_code == 429:
                    last = AIUnavailable(f"Gemini returned {r.status_code}")
                    continue
                if r.status_code >= 400:
                    raise AIUnavailable(f"Gemini rejected the request ({r.status_code}).")
                return r.json()["choices"][0]["message"]["content"] or ""
            except httpx.HTTPError as e:
                last = AIUnavailable(f"Gemini unreachable: {e.__class__.__name__}")
        raise last or AIUnavailable("Gemini failed")

    async def extract_json(self, prompt: str, file_bytes: bytes | None = None, mime: str | None = None) -> dict:
        content: list[dict] = [{"type": "text", "text": prompt}]
        if file_bytes is not None:
            b64 = base64.b64encode(file_bytes).decode()
            content.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}})
        raw = await self.chat([{"role": "user", "content": content}], json_mode=True, temperature=0, reasoning="low")
        return parse_json(raw)


def parse_json(raw: str) -> dict:
    raw = raw.strip()
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        raise AIUnavailable("AI response was not JSON")
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError as e:
        raise AIUnavailable("AI response was not valid JSON") from e
    if not isinstance(data, dict):
        raise AIUnavailable("AI response was not an object")
    return data
