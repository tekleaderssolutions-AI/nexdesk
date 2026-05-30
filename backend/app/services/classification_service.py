"""
Classification Engine — 4-agent LLM pipeline + pure-Python downstream engines.

LLM agents (each focused on one task, prompt < 1500 chars, response < 100 tokens):
  CategoryAgent    — selects the best category
  SubcategoryAgent — selects the best subcategory (given the chosen category)
  ImpactAgent      — determines impact level (HIGH/MEDIUM/LOW)
  UrgencyAgent     — determines urgency level (HIGH/MEDIUM/LOW)

Downstream engines (no LLM):
  PriorityEngine            — impact × urgency → P1-P4
  TeamAssignmentEngine      — subcategory/category → team via assignment_rules table
  HumanReviewEngine         — dual-confidence threshold gate
  AssignmentReadinessEngine — auto-assign eligibility

Entry point: run_classification_pipeline(db, ticket)
"""
import json
import re
import requests
from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from app.models.models import (
    AssignmentRule, Category, Notification, Subcategory, Team, TeamMember,
    Ticket, TicketAssignmentHistory, TicketEmbedding, TicketHistory,
)

# ── Ollama settings ────────────────────────────────────────────────────────────

_OLLAMA_BASE_URL = "http://localhost:11434"
_OLLAMA_GENERATE_URL = f"{_OLLAMA_BASE_URL}/api/generate"
_MODEL_NAME = "llama3.2:3b"

# ── Priority matrix ────────────────────────────────────────────────────────────

_PRIORITY_MATRIX = {
    ("HIGH",   "HIGH"):   "P1",
    ("HIGH",   "MEDIUM"): "P2",
    ("HIGH",   "LOW"):    "P2",
    ("MEDIUM", "HIGH"):   "P2",
    ("MEDIUM", "MEDIUM"): "P3",
    ("MEDIUM", "LOW"):    "P3",
    ("LOW",    "HIGH"):   "P3",
    ("LOW",    "MEDIUM"): "P4",
    ("LOW",    "LOW"):    "P4",
}

# ── Keyword banks for heuristic fallback ───────────────────────────────────────

_IMPACT_HIGH = {
    "outage", "down", "offline", "unavailable", "all users", "everyone", "entire",
    "organization", "revenue", "security", "breach", "production", "server", "critical",
    "widespread", "all departments", "whole company", "global", "network down",
}
_IMPACT_MEDIUM = {
    "department", "team", "multiple users", "several users", "degraded", "intermittent",
    "partial", "some users", "group", "floor", "building",
}
_URGENCY_HIGH = {
    "urgent", "immediately", "asap", "emergency", "halted", "blocked", "cannot work",
    "business impact", "critical", "stop", "stopped", "not working", "completely down",
    "breaking", "broken",
}
_URGENCY_MEDIUM = {
    "important", "affecting work", "workaround", "slow", "intermittent",
    "occasional", "sometimes", "periodically", "degraded",
}

# ── Shared LLM helpers ─────────────────────────────────────────────────────────

def _is_ollama_available() -> bool:
    try:
        r = requests.get(f"{_OLLAMA_BASE_URL}/api/tags", timeout=2)
        return r.status_code == 200
    except Exception:
        return False


def _call_ollama(prompt: str, label: str = "AGENT", max_tokens: int = 100) -> Optional[dict]:
    try:
        r = requests.post(
            _OLLAMA_GENERATE_URL,
            json={
                "model": _MODEL_NAME,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "num_predict": max_tokens,
                    "temperature": 0,
                    "top_p": 0.1,
                },
            },
            timeout=60,
        )
        if r.status_code != 200:
            print(f"[{label}] Ollama error {r.status_code}: {r.text[:200]}")
            return None
        raw = r.json().get("response", "").strip()
        print(f"[{label}] Raw: {raw[:150]}")
        return _extract_json(raw)
    except Exception as e:
        print(f"[{label}] Ollama call failed: {e}")
        return None


def _fetch_master_data(db: Session) -> dict:
    categories = db.query(Category).filter(Category.is_active == True).all()
    subcategories = db.query(Subcategory).all()
    return {"categories": categories, "subcategories": subcategories}


def _resolve_category(db: Session, name: str) -> Tuple[Optional[object], str]:
    if not name:
        return None, ""
    cat = db.query(Category).filter(Category.category_name.ilike(name.strip())).first()
    return cat, str(cat.id) if cat else ""


def _resolve_subcategory(db: Session, name: str, category_id: str) -> str:
    if not name or not category_id:
        return ""
    sub = db.query(Subcategory).filter(
        Subcategory.subcategory_name.ilike(name.strip()),
        Subcategory.category_id == category_id,
    ).first()
    return str(sub.id) if sub else ""


# ── Validation helpers ─────────────────────────────────────────────────────────

def _format_numbered_list(items: list) -> str:
    """Formats a list as a numbered table for LLM prompts."""
    return "\n".join(f"{i + 1:>3}. {item}" for i, item in enumerate(items))


def _validate_against_list(returned: str, allowed: list) -> tuple:
    """
    Case-insensitive membership check.
    Returns (canonical_name, is_valid).
    On match, canonical_name is the exact DB spelling.
    """
    lookup = {name.lower(): name for name in allowed}
    canonical = lookup.get((returned or "").strip().lower())
    return (canonical, True) if canonical else ("", False)


# ══════════════════════════════════════════════════════════════════════════════
# Agent 1 — Category Agent
# ══════════════════════════════════════════════════════════════════════════════

_CATEGORY_PROMPT = """\
IT support ticket classification.

Ticket:
Subject: {subject}
Description: {description}

Valid categories:
{categories_table}

Identify the affected asset or service. Pick the category whose meaning most closely matches the core problem.

Output ONLY the JSON object below. No text before it. No text after it. No markdown. No explanations:
{{"category_name": "", "confidence": 0.0}}
"""


class CategoryAgent:
    @classmethod
    def classify(cls, ticket: Ticket, master: dict) -> dict:
        allowed = [c.category_name for c in master["categories"]]
        prompt = _CATEGORY_PROMPT.format(
            subject=ticket.subject or "",
            description=(ticket.description or "")[:300],
            categories_table=_format_numbered_list(allowed),
        )
        print(f"[CategoryAgent] Prompt Length: {len(prompt)}")
        result = _call_ollama(prompt, "CategoryAgent", max_tokens=300)

        if not result:
            print("[CategoryAgent] No parseable result — heuristic fallback")
            return cls._heuristic(ticket, master)

        if "category_name" not in result or "confidence" not in result:
            print(f"[CategoryAgent] SCHEMA INVALID — got keys {list(result.keys())}")
            return {"category_name": "", "confidence": 0.0}

        if not result.get("category_name"):
            print("[CategoryAgent] Empty category_name — heuristic fallback")
            return cls._heuristic(ticket, master)

        returned_name = result["category_name"]
        canonical, valid = _validate_against_list(returned_name, allowed)

        if not valid:
            print(f"[CategoryAgent] VALIDATION FAILED — '{returned_name}' not in allowed categories")
            return {
                "category_name": "",
                "confidence": 0.0,
            }

        return {
            "category_name": canonical,
            "confidence": float(result.get("confidence", 0.5)),
        }

    @classmethod
    def _heuristic(cls, ticket: Ticket, master: dict) -> dict:
        text = f"{ticket.subject or ''} {ticket.description or ''}".lower()
        words = set(re.findall(r'\b\w+\b', text))
        best_cat, best_score = None, 0
        for cat in master["categories"]:
            score = len(set(re.findall(r'\b\w+\b', cat.category_name.lower())) & words)
            if score > best_score:
                best_score, best_cat = score, cat
        confidence = 0.60 if best_score >= 2 else (0.50 if best_score == 1 else 0.40)
        return {
            "category_name": best_cat.category_name if best_cat else "",
            "category_id": str(best_cat.id) if best_cat else "",
            "confidence": confidence,
        }


# ══════════════════════════════════════════════════════════════════════════════
# Agent 2 — Subcategory Agent
# ══════════════════════════════════════════════════════════════════════════════

_SUBCATEGORY_PROMPT = """\
IT support subcategory classification.

Category: {selected_category}

Ticket:
Subject: {subject}
Description: {description}

Valid subcategories for "{selected_category}":
{subcategories_table}

Identify the specific issue type. Pick the subcategory that most precisely matches the problem.

Output ONLY the JSON object below. No text before it. No text after it. No markdown. No explanations:
{{"subcategory_name": "", "confidence": 0.0}}
"""


class SubcategoryAgent:
    @classmethod
    def classify(cls, ticket: Ticket, master: dict, selected_category: str, category_id: str) -> dict:
        allowed = [
            s.subcategory_name
            for s in master["subcategories"]
            if str(s.category_id) == category_id
        ]
        if not allowed:
            return {"subcategory_name": "", "confidence": 0.0, "reason": "No subcategories for category"}

        prompt = _SUBCATEGORY_PROMPT.format(
            subject=ticket.subject or "",
            description=(ticket.description or "")[:300],
            selected_category=selected_category,
            subcategories_table=_format_numbered_list(allowed),
        )
        print(f"[SubcategoryAgent] Prompt Length: {len(prompt)}")
        result = _call_ollama(prompt, "SubcategoryAgent", max_tokens=250)

        if not result:
            print("[SubcategoryAgent] No parseable result — heuristic fallback")
            return cls._heuristic(ticket, master, category_id)

        if "subcategory_name" not in result or "confidence" not in result:
            print(f"[SubcategoryAgent] SCHEMA INVALID — got keys {list(result.keys())}")
            return {"subcategory_name": "", "confidence": 0.0}

        if not result.get("subcategory_name"):
            print("[SubcategoryAgent] Empty subcategory_name — heuristic fallback")
            return cls._heuristic(ticket, master, category_id)

        returned_name = result["subcategory_name"]
        canonical, valid = _validate_against_list(returned_name, allowed)

        if not valid:
            print(f"[SubcategoryAgent] VALIDATION FAILED — '{returned_name}' not in allowed subcategories")
            return {"subcategory_name": "", "confidence": 0.0}

        return {
            "subcategory_name": canonical,
            "confidence": float(result.get("confidence", 0.5)),
        }

    @classmethod
    def _heuristic(cls, ticket: Ticket, master: dict, category_id: str) -> dict:
        text = f"{ticket.subject or ''} {ticket.description or ''}".lower()
        words = set(re.findall(r'\b\w+\b', text))
        best_sub, best_score = None, 0
        for sub in master["subcategories"]:
            if str(sub.category_id) != category_id:
                continue
            score = len(set(re.findall(r'\b\w+\b', sub.subcategory_name.lower())) & words)
            if score > best_score:
                best_score, best_sub = score, sub
        confidence = 0.60 if best_score >= 2 else (0.50 if best_score == 1 else 0.40)
        return {
            "subcategory_name": best_sub.subcategory_name if best_sub else "",
            "subcategory_id": str(best_sub.id) if best_sub else "",
            "confidence": confidence,
        }


# ══════════════════════════════════════════════════════════════════════════════
# Agent 3 — Impact Agent
# ══════════════════════════════════════════════════════════════════════════════

_IMPACT_PROMPT = """\
You are an IT impact classifier.

Ticket:
Subject: {subject}
Description: {description}

Rules:
HIGH = organization-wide or multiple departments affected
MEDIUM = department or multiple users affected
LOW = single user or minor issue

Return JSON only:
{{"impact":"LOW"}}

No markdown. No explanations. JSON only.
"""


class ImpactAgent:
    @classmethod
    def classify(cls, ticket: Ticket) -> dict:
        prompt = _IMPACT_PROMPT.format(
            subject=ticket.subject or "",
            description=(ticket.description or "")[:300],
        )
        print(f"[ImpactAgent] Prompt Length: {len(prompt)}")
        result = _call_ollama(prompt, "ImpactAgent")
        if not result or not result.get("impact"):
            return cls._heuristic(ticket)
        val = result["impact"].upper()
        return {"impact": val if val in ("HIGH", "MEDIUM", "LOW") else "LOW"}

    @classmethod
    def _heuristic(cls, ticket: Ticket) -> dict:
        text = f"{ticket.subject or ''} {ticket.description or ''}".lower()
        for phrase in _IMPACT_HIGH:
            if phrase in text:
                return {"impact": "HIGH"}
        for phrase in _IMPACT_MEDIUM:
            if phrase in text:
                return {"impact": "MEDIUM"}
        return {"impact": "LOW"}


# ══════════════════════════════════════════════════════════════════════════════
# Agent 4 — Urgency Agent
# ══════════════════════════════════════════════════════════════════════════════

_URGENCY_PROMPT = """\
You are an IT urgency classifier.

Ticket:
Subject: {subject}
Description: {description}

Rules:
HIGH = immediate action required, business halted
MEDIUM = important but workaround exists
LOW = routine request

Return JSON only:
{{"urgency":"LOW"}}

No markdown. No explanations. JSON only.
"""


class UrgencyAgent:
    @classmethod
    def classify(cls, ticket: Ticket) -> dict:
        prompt = _URGENCY_PROMPT.format(
            subject=ticket.subject or "",
            description=(ticket.description or "")[:300],
        )
        print(f"[UrgencyAgent] Prompt Length: {len(prompt)}")
        result = _call_ollama(prompt, "UrgencyAgent")
        if not result or not result.get("urgency"):
            return cls._heuristic(ticket)
        val = result["urgency"].upper()
        return {"urgency": val if val in ("HIGH", "MEDIUM", "LOW") else "LOW"}

    @classmethod
    def _heuristic(cls, ticket: Ticket) -> dict:
        text = f"{ticket.subject or ''} {ticket.description or ''}".lower()
        for phrase in _URGENCY_HIGH:
            if phrase in text:
                return {"urgency": "HIGH"}
        for phrase in _URGENCY_MEDIUM:
            if phrase in text:
                return {"urgency": "MEDIUM"}
        return {"urgency": "LOW"}


# ══════════════════════════════════════════════════════════════════════════════
# Engine 5 — Priority Engine  (pure Python — no LLM)
# ══════════════════════════════════════════════════════════════════════════════

class PriorityEngine:
    @staticmethod
    def get_priority(impact: str, urgency: str) -> str:
        return _PRIORITY_MATRIX.get((impact.upper(), urgency.upper()), "P3")


# ══════════════════════════════════════════════════════════════════════════════
# Engine 6 — Team Assignment Engine  (DB lookup — no LLM)
# ══════════════════════════════════════════════════════════════════════════════

class TeamAssignmentEngine:
    @staticmethod
    def get_team(db: Session, subcategory_id: str, category_id: str) -> Optional[dict]:
        """Subcategory-exact match first, then category-only fallback."""
        rule = None
        if subcategory_id:
            rule = db.query(AssignmentRule).filter(
                AssignmentRule.subcategory_id == subcategory_id,
                AssignmentRule.is_active == True,
            ).first()
        if not rule and category_id:
            rule = db.query(AssignmentRule).filter(
                AssignmentRule.category_id == category_id,
                AssignmentRule.subcategory_id.is_(None),
                AssignmentRule.is_active == True,
            ).first()
        if not rule:
            return None
        team = db.query(Team).filter(Team.id == rule.team_id).first()
        return {"id": str(team.id), "name": team.team_name} if team else None


# ══════════════════════════════════════════════════════════════════════════════
# Engine 7 — Human Review Engine  (pure Python — no LLM)
# ══════════════════════════════════════════════════════════════════════════════

class HumanReviewEngine:
    CONFIDENCE_THRESHOLD = 0.70

    @classmethod
    def requires_review(
        cls,
        category_confidence: float,
        subcategory_confidence: float,
        category_name: str,
        subcategory_name: str,
    ) -> bool:
        if float(category_confidence) < cls.CONFIDENCE_THRESHOLD:
            return True
        if float(subcategory_confidence) < cls.CONFIDENCE_THRESHOLD:
            return True
        if not category_name:
            return True
        if not subcategory_name:
            return True
        return False


# ══════════════════════════════════════════════════════════════════════════════
# Engine 8 — Assignment Readiness Engine  (pure Python — no LLM)
# ══════════════════════════════════════════════════════════════════════════════

class AssignmentReadinessEngine:
    @staticmethod
    def is_ready(requires_human_review: bool, team: Optional[dict]) -> bool:
        return not requires_human_review and team is not None


# ══════════════════════════════════════════════════════════════════════════════
# Pipeline orchestrator — main entry point
# ══════════════════════════════════════════════════════════════════════════════

def run_classification_pipeline(db: Session, ticket: Ticket) -> dict:
    """
    Full 8-step pipeline:
      CategoryAgent → SubcategoryAgent → ImpactAgent → UrgencyAgent
      → PriorityEngine → TeamAssignmentEngine → HumanReviewEngine
      → AssignmentReadinessEngine → write to ticket
    Returns the complete result dict.
    """
    master = _fetch_master_data(db)
    ollama_up = _is_ollama_available()

    if not ollama_up:
        print(f"[PIPELINE] Ollama unavailable — heuristics for {ticket.ticket_no}")

    # ── Step 1: Category ────────────────────────────────────────────────────
    if ollama_up:
        cat_result = CategoryAgent.classify(ticket, master)
    else:
        cat_result = CategoryAgent._heuristic(ticket, master)

    category_name = cat_result.get("category_name", "")
    category_confidence = float(cat_result.get("confidence", 0))
    category_id = cat_result.get("category_id", "")

    if not category_id and category_name:
        _, category_id = _resolve_category(db, category_name)

    print(f"[PIPELINE] category={category_name!r} conf={category_confidence:.2f} id={category_id}")

    # ── Step 2: Subcategory ─────────────────────────────────────────────────
    if ollama_up and category_id:
        sub_result = SubcategoryAgent.classify(ticket, master, category_name, category_id)
    elif not ollama_up:
        sub_result = SubcategoryAgent._heuristic(ticket, master, category_id)
    else:
        sub_result = {"subcategory_name": "", "confidence": 0.0}

    subcategory_name = sub_result.get("subcategory_name", "")
    subcategory_confidence = float(sub_result.get("confidence", 0))
    subcategory_id = sub_result.get("subcategory_id", "")

    if not subcategory_id and subcategory_name and category_id:
        subcategory_id = _resolve_subcategory(db, subcategory_name, category_id)

    print(f"[PIPELINE] subcategory={subcategory_name!r} conf={subcategory_confidence:.2f} id={subcategory_id}")

    # ── Step 3: Impact ──────────────────────────────────────────────────────
    impact = (ImpactAgent.classify(ticket) if ollama_up else ImpactAgent._heuristic(ticket)).get("impact", "LOW").upper()

    # ── Step 4: Urgency ─────────────────────────────────────────────────────
    urgency = (UrgencyAgent.classify(ticket) if ollama_up else UrgencyAgent._heuristic(ticket)).get("urgency", "LOW").upper()

    print(f"[PIPELINE] impact={impact} urgency={urgency}")

    # ── Step 5: Priority (no LLM) ───────────────────────────────────────────
    priority = PriorityEngine.get_priority(impact, urgency)

    # ── Step 6: Team Assignment (no LLM) ───────────────────────────────────
    team = TeamAssignmentEngine.get_team(db, subcategory_id, category_id)

    # ── Step 7: Human Review Gate (no LLM) ─────────────────────────────────
    requires_human_review = HumanReviewEngine.requires_review(
        category_confidence, subcategory_confidence, category_name, subcategory_name
    )

    # ── Step 8: Assignment Readiness (no LLM) ──────────────────────────────
    auto_assign = AssignmentReadinessEngine.is_ready(requires_human_review, team)
    routing_decision = "AUTO_ASSIGN" if auto_assign else "MANUAL_REVIEW"
    new_status = "ASSIGNED" if auto_assign else "PENDING_ADMIN_REVIEW"

    result = {
        "ticket_id": str(ticket.id),
        "category_id": category_id,
        "category_name": category_name,
        "category_confidence": category_confidence,
        "subcategory_id": subcategory_id,
        "subcategory_name": subcategory_name,
        "subcategory_confidence": subcategory_confidence,
        "confidence": min(category_confidence, subcategory_confidence),
        "impact": impact,
        "urgency": urgency,
        "priority": priority,
        "team": team,
        "requires_human_review": requires_human_review,
        "routing_decision": routing_decision,
        "status": new_status,
    }

    print(
        f"[PIPELINE] priority={priority} team={team} "
        f"review={requires_human_review} routing={routing_decision}"
    )

    _apply_pipeline_result(db, ticket, result)
    return result


def _apply_pipeline_result(db: Session, ticket: Ticket, result: dict) -> None:
    team = result.get("team")
    auto_assign = result.get("routing_decision") == "AUTO_ASSIGN"

    # ── Core classification fields ─────────────────────────────────────────────
    if result.get("category_id"):
        ticket.category_id = result["category_id"]
    if result.get("subcategory_id"):
        ticket.subcategory_id = result["subcategory_id"]

    impact = result.get("impact", "")
    urgency = result.get("urgency", "")
    if impact:
        ticket.impact = impact.upper()
    if urgency:
        ticket.urgency = urgency.upper()

    # ── Team + department assignment ───────────────────────────────────────────
    if auto_assign and team:
        ticket.assigned_team_id = team["id"]
        ticket.assigned_at = datetime.utcnow()
        ticket.assigned_by = "AI_AGENT"

        # Pull department_id from the assigned team and stamp it on the ticket
        team_obj = db.query(Team).filter(Team.id == team["id"]).first()
        if team_obj and team_obj.department_id:
            ticket.department_id = team_obj.department_id

    ticket.status = result.get("status", "PENDING_ADMIN_REVIEW")

    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # ── Audit trail ────────────────────────────────────────────────────────────
    _write_ticket_history(db, ticket, result)

    # ── Notifications ──────────────────────────────────────────────────────────
    if auto_assign and team:
        _send_assignment_notifications(db, ticket, result)

    _update_embedding_text(db, ticket, result)



def _write_ticket_history(db: Session, ticket: Ticket, result: dict) -> None:
    """Write one TicketHistory row per classified field + TicketAssignmentHistory."""
    entries = [
        ("category_id",    result.get("category_name", ""),    result.get("category_id", "")),
        ("subcategory_id", result.get("subcategory_name", ""), result.get("subcategory_id", "")),
        ("priority",       None,                               result.get("priority", "")),
        ("impact",         None,                               result.get("impact", "")),
        ("urgency",        None,                               result.get("urgency", "")),
    ]
    team = result.get("team")
    if team:
        entries.append(("assigned_team_id", None, f"{team['name']} ({team['id']})"))

    for field, label, new_val in entries:
        if not new_val:
            continue
        display = label if label else new_val
        db.add(TicketHistory(
            ticket_id=ticket.id,
            field_changed=field,
            old_value=None,
            new_value=display,
            changed_by=None,
        ))

    # Assignment history record
    if result.get("routing_decision") == "AUTO_ASSIGN" and team:
        db.add(TicketAssignmentHistory(
            ticket_id=ticket.id,
            previous_team_id=None,
            new_team_id=team["id"],
            previous_agent_id=None,
            new_agent_id=None,
            assigned_by=None,
            assignment_reason="AI_CLASSIFICATION",
        ))

    try:
        db.commit()
    except Exception as e:
        print(f"[CLASSIFY] Failed to write ticket history: {e}")
        db.rollback()


def _send_assignment_notifications(db: Session, ticket: Ticket, result: dict) -> None:
    """Create in-app notifications for the requester and all assigned team members."""
    team = result.get("team", {})
    team_name = team.get("name", "a support team")
    team_id = team.get("id")
    category = result.get("category_name", "")
    subcategory = result.get("subcategory_name", "")
    priority = result.get("priority", "")

    # Requester notification
    if ticket.created_by:
        db.add(Notification(
            user_id=ticket.created_by,
            notification_type="TICKET_ASSIGNED",
            title=f"Ticket {ticket.ticket_no} assigned",
            message=(
                f"Your ticket has been automatically assigned.\n"
                f"Team: {team_name}\n"
                f"Category: {category} / {subcategory}\n"
                f"Priority: {priority}"
            ),
        ))

    # Team member notifications
    if team_id:
        members = db.query(TeamMember).filter(TeamMember.team_id == team_id).all()
        for member in members:
            db.add(Notification(
                user_id=member.user_id,
                notification_type="NEW_TICKET_ASSIGNED",
                title=f"New ticket: {ticket.ticket_no}",
                message=(
                    f"A new ticket has been assigned to your team.\n"
                    f"Subject: {ticket.subject}\n"
                    f"Priority: {priority} | {category} / {subcategory}"
                ),
            ))

    try:
        db.commit()
    except Exception as e:
        print(f"[CLASSIFY] Failed to send notifications: {e}")
        db.rollback()


def _update_embedding_text(db: Session, ticket: Ticket, result: dict) -> None:
    try:
        emb = db.query(TicketEmbedding).filter(
            TicketEmbedding.ticket_id == ticket.id
        ).first()
        if not emb:
            return

        team = result.get("team") or {}
        suffix = (
            f"\n[Classification] category={result.get('category_name','')} "
            f"subcategory={result.get('subcategory_name','')} "
            f"priority={result.get('priority','')} impact={result.get('impact','')} "
            f"urgency={result.get('urgency','')} team={team.get('name','')}"
        )
        base = emb.embedding_text or (emb.masked_text[:500] if emb.masked_text else "")
        if "[Classification]" in base:
            base = base[:base.index("[Classification]")]
        emb.embedding_text = base + suffix
        db.add(emb)
        db.commit()
        print(f"[CLASSIFY] Updated embedding_text for {ticket.ticket_no}")
    except Exception as e:
        print(f"[CLASSIFY] Failed to update embedding_text: {e}")
        try:
            db.rollback()
        except Exception:
            pass


# ── JSON extractor ─────────────────────────────────────────────────────────────

def _extract_json(text: str) -> Optional[dict]:
    """
    Extract the first valid JSON object from text.
    Rejects arrays and non-dict values.
    Uses brace-matching so it works when the model adds surrounding text.
    """
    # direct parse — model output was clean JSON
    try:
        parsed = json.loads(text.strip())
        if isinstance(parsed, dict):
            return parsed
        return None  # reject arrays and scalars
    except json.JSONDecodeError:
        pass

    # strip markdown code fences and try again
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

    # brace-matching: find the first complete {...} block in the text
    # handles "Based on the ticket... {"key":"val"}" style output
    depth = 0
    obj_start = None
    for i, ch in enumerate(text):
        if ch == '{':
            if depth == 0:
                obj_start = i
            depth += 1
        elif ch == '}':
            if depth > 0:
                depth -= 1
                if depth == 0 and obj_start is not None:
                    candidate = text[obj_start:i + 1]
                    try:
                        parsed = json.loads(candidate)
                        if isinstance(parsed, dict):
                            return parsed
                    except json.JSONDecodeError:
                        pass
                    obj_start = None

    return None
