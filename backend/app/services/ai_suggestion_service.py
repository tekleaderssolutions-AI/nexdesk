"""
AI Resolution Suggestion Engine.

Runs automatically after ticket classification + team assignment.
Primary backend: Anthropic Claude (if ANTHROPIC_API_KEY is set in env).
Fallback backend: Ollama llama3.2:3b (if running locally).

Future extensibility:
  - AISuggestionContext is the single carry-bag for all inputs. Extend it with
    kb_articles, similar_resolved, embeddings, etc. without changing callers.
  - Swap _generate() to use RAG or a different model without touching routes.
"""
import json
import os
import threading
from typing import Optional
from sqlalchemy.orm import Session

from app.models.models import Category, Department, Subcategory, Team, Ticket, TicketAISuggestion


# ── Prompt ─────────────────────────────────────────────────────────────────────

_PROMPT = """\
You are a Level-2 IT Support Engineer. Analyze this support ticket and return resolution guidance.

Ticket:
Subject: {subject}
Description: {description}
Category: {category}
Subcategory: {subcategory}
Department: {department}
Assigned Team: {assigned_team}
Priority: {priority}

Return ONLY the following JSON object. No markdown. No text before or after the JSON:
{{"problem_summary": "", "probable_root_cause": "", "confidence": 0.0, "suggested_steps": ["", "", "", ""], "recommended_escalation_team": ""}}

Rules:
- problem_summary: one clear sentence describing the core issue
- probable_root_cause: the most likely technical cause, specific to the category and subcategory
- confidence: float 0.0-1.0 reflecting certainty that these steps will resolve it
- suggested_steps: exactly 4 strings, ordered highest-to-lowest fix probability, each under 20 words, no markdown
- recommended_escalation_team: escalation team name if higher-tier support is needed, else empty string
"""


# ── Context (future-extensible) ────────────────────────────────────────────────

class AISuggestionContext:
    def __init__(
        self,
        ticket_id: str,
        subject: str,
        description: str,
        category: str,
        subcategory: str,
        department: str,
        assigned_team: str,
        priority: str,
    ):
        self.ticket_id = ticket_id
        self.subject = subject
        self.description = description
        self.category = category
        self.subcategory = subcategory
        self.department = department
        self.assigned_team = assigned_team
        self.priority = priority
        # Future slots (no API contract change needed):
        # self.kb_articles: list = []
        # self.similar_resolved: list = []
        # self.embeddings = None


# ── JSON extractor ─────────────────────────────────────────────────────────────

def _extract_json(text: str) -> Optional[dict]:
    try:
        parsed = json.loads(text.strip())
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    for marker in ["```json", "```"]:
        if marker in text:
            start = text.find(marker) + len(marker)
            end = text.find("```", start)
            if end > start:
                try:
                    parsed = json.loads(text[start:end].strip())
                    if isinstance(parsed, dict):
                        return parsed
                except json.JSONDecodeError:
                    pass

    depth, obj_start = 0, None
    for i, ch in enumerate(text):
        if ch == '{':
            if depth == 0:
                obj_start = i
            depth += 1
        elif ch == '}' and depth > 0:
            depth -= 1
            if depth == 0 and obj_start is not None:
                try:
                    parsed = json.loads(text[obj_start:i + 1])
                    if isinstance(parsed, dict):
                        return parsed
                except json.JSONDecodeError:
                    pass
                obj_start = None
    return None


# ── Backend: Anthropic ─────────────────────────────────────────────────────────

def _call_anthropic(prompt: str) -> Optional[dict]:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text if message.content else ""
        print(f"[AISuggestion] Anthropic response: {raw[:200]}")
        return _extract_json(raw)
    except Exception as e:
        print(f"[AISuggestion] Anthropic error: {e}")
        return None


# ── Backend: Ollama (fallback) ─────────────────────────────────────────────────

def _call_ollama(prompt: str) -> Optional[dict]:
    try:
        import requests
        r = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "llama3.2:3b",
                "prompt": prompt,
                "stream": False,
                "options": {"num_predict": 512, "temperature": 0.1, "top_p": 0.2},
            },
            timeout=60,
        )
        if r.status_code != 200:
            return None
        raw = r.json().get("response", "").strip()
        print(f"[AISuggestion] Ollama response: {raw[:200]}")
        return _extract_json(raw)
    except Exception as e:
        print(f"[AISuggestion] Ollama error: {e}")
        return None


# ── Validation ─────────────────────────────────────────────────────────────────

def _validate(result: dict) -> Optional[dict]:
    summary = str(result.get("problem_summary") or "").strip()
    root_cause = str(result.get("probable_root_cause") or "").strip()
    escalation = str(result.get("recommended_escalation_team") or "").strip()

    if not summary or not root_cause:
        return None

    try:
        confidence = min(1.0, max(0.0, float(result.get("confidence", 0.5))))
    except (TypeError, ValueError):
        confidence = 0.5

    steps = result.get("suggested_steps", [])
    if not isinstance(steps, list):
        return None
    steps = [str(s).strip() for s in steps if str(s).strip()]
    if len(steps) < 4:
        return None

    return {
        "problem_summary": summary,
        "probable_root_cause": root_cause,
        "confidence": confidence,
        "suggested_steps": steps[:4],
        "recommended_escalation_team": escalation,
    }


# ── Context builder ────────────────────────────────────────────────────────────

def _build_context(db: Session, ticket: Ticket) -> AISuggestionContext:
    category_name = subcategory_name = department_name = team_name = ""

    if ticket.category_id:
        cat = db.query(Category).filter(Category.id == ticket.category_id).first()
        category_name = cat.category_name if cat else ""

    if ticket.subcategory_id:
        sub = db.query(Subcategory).filter(Subcategory.id == ticket.subcategory_id).first()
        subcategory_name = sub.subcategory_name if sub else ""

    team = None
    if ticket.assigned_team_id:
        team = db.query(Team).filter(Team.id == ticket.assigned_team_id).first()
        if team:
            team_name = team.team_name

    if ticket.department_id:
        dept = db.query(Department).filter(Department.id == ticket.department_id).first()
        department_name = dept.department_name if dept else ""
    elif team and team.department_id:
        dept = db.query(Department).filter(Department.id == team.department_id).first()
        department_name = dept.department_name if dept else ""

    return AISuggestionContext(
        ticket_id=str(ticket.id),
        subject=ticket.subject or "",
        description=(ticket.description or "")[:500],
        category=category_name,
        subcategory=subcategory_name,
        department=department_name,
        assigned_team=team_name,
        priority=ticket.priority or "",
    )


# ── LLM call ──────────────────────────────────────────────────────────────────

def _generate(ctx: AISuggestionContext) -> Optional[dict]:
    prompt = _PROMPT.format(
        subject=ctx.subject,
        description=ctx.description,
        category=ctx.category,
        subcategory=ctx.subcategory,
        department=ctx.department,
        assigned_team=ctx.assigned_team,
        priority=ctx.priority,
    )
    result = _call_anthropic(prompt) or _call_ollama(prompt)
    if not result:
        print(f"[AISuggestion] No LLM response for ticket {ctx.ticket_id}")
        return None
    return _validate(result)


# ── Public API ─────────────────────────────────────────────────────────────────

def generate_and_save(db: Session, ticket: Ticket) -> Optional[TicketAISuggestion]:
    """
    Generate an AI suggestion for the ticket and persist it.
    Idempotent: replaces any existing suggestion for the same ticket.
    Returns the saved ORM row, or None if the LLM call fails.
    """
    if not ticket.assigned_team_id:
        return None

    print(f"[AISuggestion] Generating for {ticket.ticket_no}")
    ctx = _build_context(db, ticket)
    data = _generate(ctx)

    if not data:
        print(f"[AISuggestion] Generation failed for {ticket.ticket_no}")
        return None

    try:
        existing = (
            db.query(TicketAISuggestion)
            .filter(TicketAISuggestion.ticket_id == ticket.id)
            .first()
        )
        if existing:
            existing.problem_summary = data["problem_summary"]
            existing.probable_root_cause = data["probable_root_cause"]
            existing.suggested_steps_json = data["suggested_steps"]
            existing.confidence = data["confidence"]
            existing.recommended_escalation_team = data["recommended_escalation_team"] or None
            db.commit()
            db.refresh(existing)
            print(f"[AISuggestion] Updated for {ticket.ticket_no}")
            return existing
        else:
            suggestion = TicketAISuggestion(
                ticket_id=ticket.id,
                problem_summary=data["problem_summary"],
                probable_root_cause=data["probable_root_cause"],
                suggested_steps_json=data["suggested_steps"],
                confidence=data["confidence"],
                recommended_escalation_team=data["recommended_escalation_team"] or None,
            )
            db.add(suggestion)
            db.commit()
            db.refresh(suggestion)
            print(f"[AISuggestion] Saved for {ticket.ticket_no} (confidence={data['confidence']:.2f})")
            return suggestion
    except Exception as e:
        print(f"[AISuggestion] DB save failed for {ticket.ticket_no}: {e}")
        try:
            db.rollback()
        except Exception:
            pass
        return None


def get_suggestion(db: Session, ticket_id: str) -> Optional[TicketAISuggestion]:
    return (
        db.query(TicketAISuggestion)
        .filter(TicketAISuggestion.ticket_id == ticket_id)
        .first()
    )


def trigger_async(ticket_id: str) -> None:
    """
    Spawn a background thread to generate the suggestion without blocking
    the API response. Uses a fresh DB session isolated to the thread.
    """
    def _run():
        from app.db.database import SessionLocal
        from app.models.models import Ticket
        db = SessionLocal()
        try:
            t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
            if t:
                generate_and_save(db, t)
        except Exception as e:
            print(f"[AISuggestion] Async thread error: {e}")
        finally:
            db.close()

    threading.Thread(target=_run, daemon=True).start()
