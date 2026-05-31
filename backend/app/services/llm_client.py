"""
Shared OpenAI LLM client for all AI services.
Reads OPENAI_API_KEY from environment (loaded via .env at startup).

Do NOT import this in llama_classifier.py — duplicate detection keeps Ollama.
"""
import json
import os
from typing import Optional


_MODEL = "gpt-4o-mini"


def is_available() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY", "").strip())


def call_text(prompt: str, max_tokens: int = 400, temperature: float = 0, tag: str = "LLM") -> Optional[str]:
    """Call OpenAI and return raw text, or None on failure."""
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print(f"[{tag}] OPENAI_API_KEY not set")
        return None
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        raw = (response.choices[0].message.content or "").strip()
        print(f"[{tag}] {len(raw)} chars: {raw[:120]}")
        return raw
    except Exception as e:
        print(f"[{tag}] OpenAI error: {e}")
        return None


def call_json(prompt: str, max_tokens: int = 400, temperature: float = 0, tag: str = "LLM") -> Optional[dict]:
    """Call OpenAI and parse the JSON response. Returns dict or None."""
    raw = call_text(prompt, max_tokens=max_tokens, temperature=temperature, tag=tag)
    return _parse_json(raw) if raw else None


def _parse_json(raw: str) -> Optional[dict]:
    try:
        return json.loads(raw.strip())
    except json.JSONDecodeError:
        pass
    for marker in ["```json", "```"]:
        if marker in raw:
            s = raw.find(marker) + len(marker)
            e = raw.find("```", s)
            if e > s:
                try:
                    return json.loads(raw[s:e].strip())
                except json.JSONDecodeError:
                    pass
    depth, start = 0, None
    for i, ch in enumerate(raw):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}" and depth > 0:
            depth -= 1
            if depth == 0 and start is not None:
                try:
                    return json.loads(raw[start : i + 1])
                except json.JSONDecodeError:
                    pass
                start = None
    return None
