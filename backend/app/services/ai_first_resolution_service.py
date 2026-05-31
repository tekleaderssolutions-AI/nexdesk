"""
AI-First Resolution Service.

For low-risk incidents (P3/P4/P5), when KB confidence meets the policy threshold,
generates a personalized resolution message via LLM, delivers it to the user as a
TicketMessage, and sets the ticket to AI_RESOLVED_PENDING_USER_CONFIRMATION.

Policy (all thresholds are configurable here):
  P5  → enabled, threshold = 60 %
  P4  → enabled, threshold = 60 %
  P3  → enabled, threshold = 85 %
  P2  → disabled (always human team)
  P1  → disabled (always human team)
"""
import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.models.models import Ticket, TicketMessage, TicketTimeline
from app.services import llm_client as _llm


# ── Policy ─────────────────────────────────────────────────────────────────────

AI_FIRST_POLICY: dict = {
    "P5": {"enabled": True,  "threshold": 60.0},
    "P4": {"enabled": True,  "threshold": 60.0},
    "P3": {"enabled": True,  "threshold": 85.0},
    "P2": {"enabled": False},
    "P1": {"enabled": False},
}

_GENERATE_PROMPT = """\
You are a helpful IT support assistant. A user submitted a support ticket and you found a matching solution in the knowledge base.

User ticket:
Subject: {subject}
Description: {description}

Knowledge base article: {kb_title}
Resolution steps from KB:
{kb_resolution}

Write a friendly support reply that:
1. Acknowledges the user issue in one sentence.
2. Presents the resolution steps clearly in order.
3. Ends with this exact sentence: "Please try these steps and confirm whether the issue is resolved."

Keep it under 180 words. Use plain text. No markdown headers. No bold formatting.
"""


# ── Helpers ────────────────────────────────────────────────────────────────────

def should_attempt_ai_first(priority: str, confidence: float) -> bool:
    policy = AI_FIRST_POLICY.get(priority.upper(), {"enabled": False})
    return policy.get("enabled", False) and confidence >= policy.get("threshold", 100.0)


def _fallback_message(ticket: Ticket, kb_title: str, kb_resolution: str) -> str:
    subject = ticket.subject or "your issue"
    steps = kb_resolution.strip() if kb_resolution else "Please follow the standard troubleshooting steps."
    return (
        f"Thank you for submitting your ticket regarding: {subject}\n\n"
        f"Based on our knowledge base ({kb_title}), here are the recommended steps:\n\n"
        f"{steps}\n\n"
        "Please try these steps and confirm whether the issue is resolved."
    )


def _generate_solution_message(ticket: Ticket, kb_title: str, kb_resolution: str) -> str:
    if not _llm.is_available():
        print("[AI_FIRST] OPENAI_API_KEY not set — using fallback message")
        return _fallback_message(ticket, kb_title, kb_resolution)

    prompt = _GENERATE_PROMPT.format(
        subject=(ticket.subject or "")[:200],
        description=(ticket.description or "")[:400],
        kb_title=kb_title,
        kb_resolution=(kb_resolution or "")[:600],
    )
    print(f"[AI_FIRST] Generating personalized message (prompt {len(prompt)} chars)…")
    raw = _llm.call_text(prompt, max_tokens=350, temperature=0.3, tag="AI_FIRST")
    if raw and len(raw.strip()) > 30:
        print(f"[AI_FIRST] Message generated ({len(raw)} chars)")
        return raw.strip()

    print("[AI_FIRST] LLM returned empty/short response — using fallback")
    return _fallback_message(ticket, kb_title, kb_resolution)


# ── Public API ─────────────────────────────────────────────────────────────────

def execute_ai_first_resolution(
    db: Session,
    ticket: Ticket,
    kb_title: str,
    kb_resolution: str,
    final_confidence: float,
) -> bool:
    """
    Check policy, generate a personalized resolution message, deliver it to the
    user as a TicketMessage, and set the ticket to
    AI_RESOLVED_PENDING_USER_CONFIRMATION.

    Returns True if the AI-first path was triggered; False otherwise.
    """
    priority = (ticket.priority or "P3").upper()

    if not should_attempt_ai_first(priority, final_confidence):
        return False

    if ticket.status == "AI_RESOLVED_PENDING_USER_CONFIRMATION":
        print(f"[AI_FIRST] {ticket.ticket_no}: already awaiting confirmation — skip")
        return False

    terminal = {"CLOSED", "RESOLVED", "AI_RESOLVED"}
    if ticket.status in terminal:
        print(f"[AI_FIRST] {ticket.ticket_no}: terminal status {ticket.status} — skip")
        return False

    threshold = AI_FIRST_POLICY[priority]["threshold"]
    print(
        f"[AI_FIRST] {ticket.ticket_no} [{priority}]: "
        f"confidence {final_confidence:.1f}% ≥ {threshold:.0f}% threshold — triggering"
    )

    message_body = _generate_solution_message(ticket, kb_title, kb_resolution)
    now = datetime.datetime.now(datetime.timezone.utc)

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
        ticket.resolution_type = "AI_AUTO"
        ticket.final_resolution_confidence = final_confidence
        db.add(ticket)

        db.add(TicketTimeline(
            ticket_id=str(ticket.id),
            event_type="AI_SOLUTION_GENERATED",
            event_label=f"AI resolution generated ({final_confidence:.1f}% confidence)",
            performed_by="AI_AGENT",
        ))
        db.add(TicketTimeline(
            ticket_id=str(ticket.id),
            event_type="AI_SOLUTION_SENT",
            event_label="AI solution delivered to user — confirmation requested",
            performed_by="AI_AGENT",
        ))
        db.add(TicketTimeline(
            ticket_id=str(ticket.id),
            event_type="AWAITING_USER_CONFIRMATION",
            event_label="Waiting for user to confirm resolution",
            performed_by="AI_AGENT",
        ))
        db.commit()

        print(f"[AI_FIRST] {ticket.ticket_no}: → AI_RESOLVED_PENDING_USER_CONFIRMATION")

        try:
            from app.services.notification_service import notify_ai_resolution_available
            if ticket.created_by:
                notify_ai_resolution_available(db, ticket, ticket.created_by)
        except Exception as e:
            print(f"[AI_FIRST] Notification error: {e}")

        return True

    except Exception as e:
        print(f"[AI_FIRST] DB error: {e}")
        db.rollback()
        return False


def log_policy_summary() -> None:
    """Print the current AI-first policy to the console on startup."""
    print("[AI_FIRST] Policy:")
    for priority, cfg in AI_FIRST_POLICY.items():
        if cfg.get("enabled"):
            print(f"  {priority}: enabled  threshold={cfg['threshold']:.0f}%")
        else:
            print(f"  {priority}: disabled")
