"""
Enterprise AI Resolution Service — 3-Level Workflow.

Level 1 — AI_AUTO_RESOLVE  (P4 / P5, high confidence)
  Generate resolution → deliver to user via TicketMessage
  status = AI_RESOLVED_PENDING_USER_CONFIRMATION
  User accepts → CLOSED | rejects → OPEN + routed to team

Level 2 — AI_TEAM_REVIEW   (P3, or moderate confidence)
  Generate suggested resolution → deliver to team as internal note only
  status = AI_TEAM_REVIEW
  Team approves / edits → solution sent to user (TEAM_APPROVED_AI_RESPONSE)
  Team rejects         → IN_PROGRESS

Level 3 — ROUTE_TO_TEAM    (P1 / P2, or low confidence)
  Generate internal troubleshooting guidance for team only
  No AI solution ever reaches the user
  status unchanged
"""
import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.models.models import Ticket, TicketMessage, TicketTimeline, TicketConversation
from app.services import llm_client as _llm


# ── Prompts ────────────────────────────────────────────────────────────────────

_L1_PROMPT = """\
You are a helpful IT support assistant. A user submitted a support ticket and \
you found a matching solution in the knowledge base.

User ticket:
Subject: {subject}
Description: {description}

Knowledge base article: {kb_title}
Resolution steps from KB:
{kb_resolution}

Write a friendly support reply that:
1. Acknowledges the user issue in one sentence.
2. Presents the resolution steps clearly numbered.
3. Ends with this exact sentence: "Please try these steps and confirm whether the issue is resolved."

Keep it under 200 words. Use plain text. No markdown headers. No bold formatting.
"""

_L2_PROMPT = """\
You are an IT support engineer preparing an internal AI-suggested resolution for \
review by the support team before it is sent to the user.

Ticket:
Subject: {subject}
Description: {description}
Priority: {priority}
Category: {category}

Knowledge base article: {kb_title}
KB Resolution:
{kb_resolution}

Write a concise resolution suggestion for team review:
1. Problem summary (1 sentence).
2. Root cause (1 sentence).
3. Recommended resolution steps (numbered list, max 5 steps).
4. Confidence note: explain why this KB article is a good match.

Keep it under 250 words. Professional tone. This is for the support team, not the end user.
"""

_L3_PROMPT = """\
You are an IT Level-2 support engineer. A high-priority ticket has been \
assigned to your team. Generate internal troubleshooting guidance.

Ticket:
Subject: {subject}
Description: {description}
Priority: {priority}
Category: {category}

Knowledge base context:
{kb_context}

Provide internal troubleshooting guidance for the support team:
1. Probable root cause analysis (2-3 sentences).
2. Investigation checklist (numbered, max 6 items).
3. Escalation criteria (when to escalate further).
4. Suggested questions to ask the user.

Keep it under 300 words. Technical tone. This is internal — never shown to the user.
"""


# ── Helpers ────────────────────────────────────────────────────────────────────

def _now():
    return datetime.datetime.now(datetime.timezone.utc)


def _add_timeline(db: Session, ticket_id: str, event_type: str, label: str) -> None:
    db.add(TicketTimeline(
        ticket_id=ticket_id,
        event_type=event_type,
        event_label=label,
        performed_by="AI_AGENT",
    ))


def _fallback_l1(ticket: Ticket, kb_title: str, kb_resolution: str) -> str:
    return (
        f"Thank you for submitting your ticket regarding: {ticket.subject or 'your issue'}\n\n"
        f"Based on our knowledge base ({kb_title}), here are the recommended steps:\n\n"
        f"{kb_resolution.strip() or 'Please follow the standard troubleshooting steps.'}\n\n"
        "Please try these steps and confirm whether the issue is resolved."
    )


def _fallback_l2(ticket: Ticket, kb_title: str, kb_resolution: str) -> str:
    return (
        f"[AI Suggestion — Internal Review Required]\n\n"
        f"Subject: {ticket.subject}\n"
        f"Matched KB: {kb_title}\n\n"
        f"Suggested resolution:\n{kb_resolution.strip()}\n\n"
        f"Confidence: moderate. Please review before sending to user."
    )


def _fallback_l3(ticket: Ticket) -> str:
    return (
        f"[Internal Troubleshooting Guidance]\n\n"
        f"High-priority ticket: {ticket.ticket_no}\n"
        f"Subject: {ticket.subject}\n\n"
        f"Investigation steps:\n"
        f"1. Gather full system logs and error details from the user.\n"
        f"2. Check recent changes or deployments that may have introduced the issue.\n"
        f"3. Review related tickets for patterns.\n"
        f"4. Escalate to L3 if root cause not identified within 2 hours."
    )


# ── Level 1 — AI Auto-Resolve (P4 / P5) ───────────────────────────────────────

def execute_level1(
    db: Session,
    ticket: Ticket,
    kb_title: str,
    kb_resolution: str,
    final_confidence: float,
    category: str = "",
) -> bool:
    """
    Generate a personalized resolution, deliver it to the user as a chat message,
    and set ticket → AI_RESOLVED_PENDING_USER_CONFIRMATION.
    Returns True if triggered, False if skipped.
    """
    if ticket.status in {"AI_RESOLVED_PENDING_USER_CONFIRMATION", "CLOSED", "RESOLVED", "AI_RESOLVED"}:
        print(f"[AI_RES L1] {ticket.ticket_no}: already in terminal state — skip")
        return False

    if _llm.is_available():
        prompt = _L1_PROMPT.format(
            subject=(ticket.subject or "")[:200],
            description=(ticket.description or "")[:400],
            kb_title=kb_title,
            kb_resolution=(kb_resolution or "")[:600],
        )
        raw = _llm.call_text(prompt, max_tokens=400, temperature=0.3, tag="AI_RES_L1")
        message_body = raw.strip() if raw and len(raw.strip()) > 30 else _fallback_l1(ticket, kb_title, kb_resolution)
    else:
        message_body = _fallback_l1(ticket, kb_title, kb_resolution)

    print(f"[AI_RES L1] {ticket.ticket_no}: delivering resolution ({final_confidence:.1f}% confidence)")
    now = _now()
    try:
        db.add(TicketMessage(
            ticket_id=ticket.id,
            sender_id=None,
            sender_type="AI",
            message_type="CHAT",
            message_body=message_body,
        ))
        ticket.status = "AI_RESOLVED_PENDING_USER_CONFIRMATION"
        ticket.resolved_by = "AI_AGENT"
        ticket.resolved_at = now
        ticket.resolution_type = "AI_AUTO_RESOLVE"
        ticket.final_resolution_confidence = final_confidence
        ticket.original_ai_solution = message_body
        db.add(ticket)

        _add_timeline(db, str(ticket.id), "AI_RESOLUTION_GENERATED",
                      f"AI resolution generated ({final_confidence:.1f}% confidence)")
        _add_timeline(db, str(ticket.id), "AI_RESOLUTION_DELIVERED",
                      "AI solution delivered to user — awaiting confirmation")
        db.commit()

        try:
            from app.services.notification_service import notify_ai_resolution_available
            if ticket.created_by:
                notify_ai_resolution_available(db, ticket, ticket.created_by)
        except Exception as e:
            print(f"[AI_RES L1] Notification error: {e}")

        return True
    except Exception as e:
        print(f"[AI_RES L1] DB error: {e}")
        db.rollback()
        return False


# ── Level 2 — AI Team Review (P3) ─────────────────────────────────────────────

def execute_level2(
    db: Session,
    ticket: Ticket,
    kb_title: str,
    kb_resolution: str,
    final_confidence: float,
    category: str = "",
) -> bool:
    """
    Generate a suggested resolution for team review, store it as an internal
    note (NOT visible to user), and set ticket → AI_TEAM_REVIEW.
    """
    if ticket.status in {"AI_TEAM_REVIEW", "TEAM_APPROVED_AI_RESPONSE",
                         "AI_RESOLVED_PENDING_USER_CONFIRMATION", "CLOSED", "RESOLVED"}:
        print(f"[AI_RES L2] {ticket.ticket_no}: already in AI review state — skip")
        return False

    if _llm.is_available():
        prompt = _L2_PROMPT.format(
            subject=(ticket.subject or "")[:200],
            description=(ticket.description or "")[:400],
            priority=ticket.priority or "P3",
            category=category or "",
            kb_title=kb_title,
            kb_resolution=(kb_resolution or "")[:600],
        )
        raw = _llm.call_text(prompt, max_tokens=500, temperature=0.2, tag="AI_RES_L2")
        suggestion = raw.strip() if raw and len(raw.strip()) > 30 else _fallback_l2(ticket, kb_title, kb_resolution)
    else:
        suggestion = _fallback_l2(ticket, kb_title, kb_resolution)

    print(f"[AI_RES L2] {ticket.ticket_no}: sending suggestion to team ({final_confidence:.1f}% confidence)")
    try:
        # Internal note — only team/admin can see (is_internal flag via TicketConversation)
        db.add(TicketConversation(
            ticket_id=ticket.id,
            sender_id=None,
            sender_role="AI",
            message=suggestion,
            is_internal=True,
        ))
        ticket.status = "AI_TEAM_REVIEW"
        ticket.resolution_type = "AI_TEAM_REVIEW"
        ticket.final_resolution_confidence = final_confidence
        ticket.original_ai_solution = suggestion
        db.add(ticket)

        _add_timeline(db, str(ticket.id), "AI_SUGGESTION_GENERATED",
                      f"AI suggested resolution generated ({final_confidence:.1f}%) — awaiting team review")
        db.commit()
        return True
    except Exception as e:
        print(f"[AI_RES L2] DB error: {e}")
        db.rollback()
        return False


# ── Level 3 — Internal Guidance (P1 / P2) ─────────────────────────────────────

def execute_level3(
    db: Session,
    ticket: Ticket,
    kb_matches: list,
    final_confidence: float,
    category: str = "",
) -> bool:
    """
    Generate internal troubleshooting guidance for the team.
    Never sends anything to the user.
    """
    kb_context = ""
    if kb_matches:
        top = kb_matches[0]
        kb_context = f"Article: {top.title}\nResolution hint:\n{(top.resolution_text or '')[:400]}"
    else:
        kb_context = "No matching KB articles found."

    if _llm.is_available():
        prompt = _L3_PROMPT.format(
            subject=(ticket.subject or "")[:200],
            description=(ticket.description or "")[:400],
            priority=ticket.priority or "P1",
            category=category or "",
            kb_context=kb_context,
        )
        raw = _llm.call_text(prompt, max_tokens=500, temperature=0.2, tag="AI_RES_L3")
        guidance = raw.strip() if raw and len(raw.strip()) > 30 else _fallback_l3(ticket)
    else:
        guidance = _fallback_l3(ticket)

    print(f"[AI_RES L3] {ticket.ticket_no}: generating internal guidance for team")
    try:
        db.add(TicketConversation(
            ticket_id=ticket.id,
            sender_id=None,
            sender_role="AI",
            message=guidance,
            is_internal=True,
        ))
        _add_timeline(db, str(ticket.id), "AI_INTERNAL_GUIDANCE",
                      "AI generated internal troubleshooting guidance for the team")
        db.commit()
        return True
    except Exception as e:
        print(f"[AI_RES L3] DB error: {e}")
        db.rollback()
        return False


# ── Dispatcher ─────────────────────────────────────────────────────────────────

_BACKFILL_STATUSES = {
    "OPEN", "NEW", "IN_PROGRESS", "ASSIGNED", "PENDING_ADMIN_REVIEW",
    "PENDING_USER", "PENDING_VENDOR", "ESCALATED", "ON_HOLD",
}


def execute_ai_resolution_workflow(
    db: Session,
    ticket: Ticket,
    kb_matches: list,
    decision: str,
    final_confidence: float,
    category: str = "",
) -> None:
    """
    Dispatch to the correct resolution level based on decision + priority.
    Called from kb_similarity_service after scoring.

    Level 1 (AI_AUTO_RESOLVE):  P4/P5 only  → deliver to user
    Level 2 (AI_TEAM_REVIEW):   P3 only     → deliver to team for review
    Level 3 (ROUTE_TO_TEAM):    P1/P2 only  → internal guidance for team
    """
    if ticket.status not in _BACKFILL_STATUSES:
        print(f"[AI_RES] {ticket.ticket_no}: status={ticket.status!r} — skip AI resolution workflow")
        return

    priority = (ticket.priority or "P3").upper()
    top = kb_matches[0] if kb_matches else None
    kb_title = top.title if top else ""
    kb_resolution = top.resolution_text if top else ""

    if decision == "AI_AUTO_RESOLVE" and priority in ("P4", "P5"):
        execute_level1(db, ticket, kb_title, kb_resolution, final_confidence, category)
    elif decision == "AI_TEAM_REVIEW" and priority == "P3":
        execute_level2(db, ticket, kb_title, kb_resolution, final_confidence, category)
    elif decision == "ROUTE_TO_TEAM" and priority in ("P1", "P2"):
        execute_level3(db, ticket, kb_matches, final_confidence, category)
    else:
        print(f"[AI_RES] {ticket.ticket_no}: decision={decision} priority={priority} — no AI action")
