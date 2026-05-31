"""
Centralised notification service.
Creates Notification records for every lifecycle event.
"""
from sqlalchemy.orm import Session

from app.models.models import Notification, TeamMember


def _notif(db: Session, user_id, ntype: str, title: str, message: str) -> None:
    db.add(Notification(
        user_id=user_id,
        notification_type=ntype,
        title=title,
        message=message,
    ))


def _team_member_ids(db: Session, team_id) -> list:
    members = db.query(TeamMember).filter(TeamMember.team_id == team_id).all()
    return [m.user_id for m in members]


# ── Per-event helpers ──────────────────────────────────────────────────────────

def notify_ticket_created(db: Session, ticket, user_id) -> None:
    _notif(db, user_id, "TICKET_CREATED",
           f"Ticket {ticket.ticket_no} Created",
           f"Your ticket '{ticket.subject}' has been submitted and is being processed.")
    db.commit()


def notify_ticket_assigned(db: Session, ticket, team_id) -> None:
    for uid in _team_member_ids(db, team_id):
        _notif(db, uid, "TICKET_ASSIGNED",
               f"New Ticket: {ticket.ticket_no}",
               f"Ticket '{ticket.subject}' has been assigned to your team.")
    db.commit()


def notify_ai_resolution_available(db: Session, ticket, user_id) -> None:
    _notif(db, user_id, "AI_RESOLUTION_AVAILABLE",
           f"AI Solution Ready — {ticket.ticket_no}",
           f"We found an AI-generated solution for '{ticket.subject}'. "
           f"Please review and accept or reject it.")
    db.commit()


def notify_ai_resolution_accepted(db: Session, ticket, user_id, team_id=None) -> None:
    _notif(db, user_id, "TICKET_CLOSED",
           f"Ticket {ticket.ticket_no} Closed",
           f"You accepted the AI resolution for '{ticket.subject}'. Ticket is now closed.")
    if team_id:
        for uid in _team_member_ids(db, team_id):
            _notif(db, uid, "AI_RESOLUTION_ACCEPTED",
                   f"{ticket.ticket_no} Closed by User",
                   f"User accepted the AI resolution for '{ticket.subject}'.")
    db.commit()


def notify_ai_resolution_rejected(db: Session, ticket, user_id, team_id=None) -> None:
    _notif(db, user_id, "AI_RESOLUTION_REJECTED",
           f"Ticket {ticket.ticket_no} Sent to Team",
           f"You rejected the AI resolution for '{ticket.subject}'. "
           f"A support agent will assist you.")
    if team_id:
        for uid in _team_member_ids(db, team_id):
            _notif(db, uid, "AI_RESOLUTION_REJECTED",
                   f"Ticket {ticket.ticket_no} Needs Attention",
                   f"User rejected the AI resolution for '{ticket.subject}'. "
                   f"Ticket is now in your queue.")
    db.commit()


def notify_team_message(db: Session, ticket, sender_name: str, team_id) -> None:
    for uid in _team_member_ids(db, team_id):
        _notif(db, uid, "NEW_MESSAGE",
               f"New message on {ticket.ticket_no}",
               f"{sender_name} sent a message on '{ticket.subject}'.")
    db.commit()


def notify_ticket_escalated(db: Session, ticket, team_id) -> None:
    for uid in _team_member_ids(db, team_id):
        _notif(db, uid, "TICKET_ESCALATED",
               f"Escalated: {ticket.ticket_no}",
               f"Ticket '{ticket.subject}' has been escalated and requires immediate attention.")
    db.commit()
