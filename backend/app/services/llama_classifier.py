"""Llama-based classification for duplicate detection (organizational vs personal)."""
import json
import requests
from typing import Optional
from pydantic import BaseModel


class ClassificationResult(BaseModel):
    """Result from Llama classification."""
    classification: str  # "PERSONAL" or "ORGANIZATIONAL"
    confidence: float
    reasoning: str


class LlamaClassifier:
    """Use local Llama model for issue classification."""

    OLLAMA_BASE_URL = "http://localhost:11434"
    OLLAMA_GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"
    MODEL_NAME = "llama3.2:1b"

    CLASSIFICATION_PROMPT = """You are a ticket classifier.

PERSONAL:

* One user affected
* Password reset
* Account issue
* Laptop/device issue
* Individual login issue

ORGANIZATIONAL:

* Service outage
* Portal down
* VPN/Email/ERP/HRMS/SSO unavailable
* Multiple users affected

If unsure, choose PERSONAL.

Parent:
Subject: {parent_subject}
Description: {parent_description}

New:
Subject: {new_subject}
Description: {new_description}

Return JSON only:

{"classification":"PERSONAL|ORGANIZATIONAL","confidence":0.0,"reasoning":"short"}
"""

    @classmethod
    def is_llama_available(cls) -> bool:
        """Check if Ollama/Llama is available."""
        try:
            response = requests.get(f"{cls.OLLAMA_BASE_URL}/api/tags", timeout=2)
            return response.status_code == 200
        except Exception as e:
            print(f"[LLAMA] Ollama not available: {e}")
            return False

    @classmethod
    def classify(
        cls,
        parent_subject: str,
        parent_description: str,
        new_subject: str,
        new_description: str,
    ) -> Optional[ClassificationResult]:
        """
        Classify whether new ticket is PERSONAL or ORGANIZATIONAL.
        Falls back to heuristic if Llama unavailable.
        """
        # Check if Ollama is available
        if not cls.is_llama_available():
            print("[LLAMA] Ollama not available, using heuristic fallback")
            return cls._heuristic_classify(parent_subject, parent_description, new_subject, new_description)

        try:
            prompt = cls.CLASSIFICATION_PROMPT.format(
                parent_subject=parent_subject or "",
                parent_description=parent_description or "",
                new_subject=new_subject or "",
                new_description=new_description or "",
            )

            payload = {
                "model": cls.MODEL_NAME,
                "prompt": prompt,
                "stream": False,
            }
            print(f"[LLAMA] POST {cls.OLLAMA_GENERATE_URL} | model={cls.MODEL_NAME} | prompt_len={len(prompt)}")

            response = requests.post(
                cls.OLLAMA_GENERATE_URL,
                json=payload,
                timeout=60,
            )

            print(f"[LLAMA] Response status: {response.status_code}")
            if response.status_code != 200:
                print(f"[LLAMA] Error body: {response.text[:500]}")
                return cls._heuristic_classify(parent_subject, parent_description, new_subject, new_description)

            result = response.json()
            response_text = result.get("response", "").strip()
            print(f"[LLAMA] Raw response (first 200): {response_text[:200]}")

            # Extract JSON from response
            result_dict = cls._extract_json(response_text)
            if not result_dict:
                print("[LLAMA] Failed to parse JSON response")
                return cls._heuristic_classify(parent_subject, parent_description, new_subject, new_description)

            classification = result_dict.get("classification", "").upper().strip()
            if classification not in ("PERSONAL", "ORGANIZATIONAL"):
                print(f"[LLAMA] Unexpected classification value: {classification!r} — using heuristic")
                return cls._heuristic_classify(parent_subject, parent_description, new_subject, new_description)

            return ClassificationResult(
                classification=classification,
                confidence=float(result_dict.get("confidence", 0.5)),
                reasoning=result_dict.get("reasoning", ""),
            )

        except Exception as e:
            print(f"[LLAMA] Classification error: {e}")
            return cls._heuristic_classify(parent_subject, parent_description, new_subject, new_description)

    @staticmethod
    def _extract_json(text: str) -> Optional[dict]:
        """Extract JSON from model response (may contain markdown or extra text)."""
        try:
            # Try direct parsing first
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try to extract JSON from code blocks
        for marker in ["```json", "```"]:
            if marker in text:
                start = text.find(marker) + len(marker)
                end = text.find("```", start)
                if end > start:
                    try:
                        return json.loads(text[start:end].strip())
                    except json.JSONDecodeError:
                        pass

        # Try to find JSON object pattern
        import re
        json_match = re.search(r'\{.*?\}', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        return None

    @classmethod
    def _heuristic_classify(
        cls,
        parent_subject: str,
        parent_description: str,
        new_subject: str,
        new_description: str,
    ) -> ClassificationResult:
        """Fallback heuristic classification when Llama unavailable."""
        # Keywords indicating organizational issues
        org_keywords = [
            "outage", "down", "offline", "unavailable",
            "vpn", "email", "sso", "sap", "network",
            "all users", "everyone", "service", "infrastructure",
            "ssl", "ldap", "active directory", "authentication",
            "multiple users", "widespread", "all departments"
        ]

        combined_text = (parent_subject + " " + parent_description + " " + new_subject + " " + new_description).lower()

        # Count organizational keywords
        keyword_count = sum(1 for kw in org_keywords if kw in combined_text)

        if keyword_count >= 2:
            return ClassificationResult(
                classification="ORGANIZATIONAL",
                confidence=0.6,
                reasoning="Multiple organizational keywords detected in tickets"
            )
        else:
            return ClassificationResult(
                classification="PERSONAL",
                confidence=0.6,
                reasoning="Heuristic analysis suggests personal issue"
            )
