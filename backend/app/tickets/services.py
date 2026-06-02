import datetime
import re
from typing import List, Optional
from sqlalchemy.orm import Session

from sqlalchemy import func as sql_func
from app.models import Attachment, Ticket, TicketRelationship, User
from app.models.models import (
    Category, Department, Notification, Subcategory, Team, TeamMember, TicketHistory,
    TicketTimeline,
)
from app.services.semantic_duplicate_service import run_semantic_duplicate_resolution


def _is_p1_emergency(subject: str, description: str, explicit_priority: Optional[str]) -> bool:
    """Return True if the ticket is explicitly a P1 emergency."""
    if explicit_priority and explicit_priority.upper() == "P1":
        return True
    combined = f"{subject or ''} {description or ''}"
    return bool(re.search(r'\bP1\b', combined, re.IGNORECASE))


def _assign_p1_team(db: Session, user: User) -> Optional[Team]:
    """Find the best team to directly assign a P1 ticket to."""
    if user.department_id:
        team = (
            db.query(Team)
            .filter(Team.department_id == user.department_id, Team.is_active == True)
            .first()
        )
        if team:
            return team
    # Fallback: any active team in the organisation
    depts = db.query(Department).filter(
        Department.organization_id == user.organization_id,
        Department.is_active == True,
    ).all()
    dept_ids = [d.id for d in depts]
    if dept_ids:
        return db.query(Team).filter(Team.department_id.in_(dept_ids), Team.is_active == True).first()
    return None


def _get_sla_minutes_map(db: Session) -> dict:
    """Load SLA rules from DB keyed by priority_code. Falls back to defaults."""
    from app.models.models import SLARule, PriorityMaster
    rows = (
        db.query(SLARule, PriorityMaster)
        .join(PriorityMaster, SLARule.priority_id == PriorityMaster.id)
        .filter(SLARule.is_active == True)
        .all()
    )
    if rows:
        return {
            pm.priority_code: {
                "first_response_min": rule.first_response_minutes,
                "resolution_min": rule.resolution_minutes,
            }
            for rule, pm in rows
        }
    return {
        "P1": {"first_response_min": 30,   "resolution_min": 240},
        "P2": {"first_response_min": 60,   "resolution_min": 480},
        "P3": {"first_response_min": 240,  "resolution_min": 1440},
        "P4": {"first_response_min": 480,  "resolution_min": 4320},
        "P5": {"first_response_min": 1440, "resolution_min": 10080},
    }


def _compute_sla_status(ticket, sla_map: dict) -> dict:
    """Return SLA breach/risk/deadline info for a ticket."""
    now = datetime.datetime.utcnow()
    priority = (ticket.priority or "P3").upper()
    rule = sla_map.get(priority, {"first_response_min": 1440, "resolution_min": 4320})
    created = ticket.created_at
    if not created:
        return {}
    res_deadline = created + datetime.timedelta(minutes=rule["resolution_min"])
    fr_deadline  = created + datetime.timedelta(minutes=rule["first_response_min"])
    closed_statuses = {
        "RESOLVED", "CLOSED", "AI_RESOLVED", "CANCELLED",
        "AI_RESOLVED_PENDING_USER_CONFIRMATION",
    }
    is_closed = (ticket.status or "").upper() in closed_statuses
    elapsed_sec = (now - created).total_seconds()
    total_sec   = rule["resolution_min"] * 60
    pct_elapsed = min(100, round(elapsed_sec / max(total_sec, 1) * 100, 1))
    is_breached = not is_closed and res_deadline < now
    is_at_risk  = not is_closed and not is_breached and pct_elapsed >= 80
    minutes_remaining = max(0, int((res_deadline - now).total_seconds() / 60))
    return {
        "sla_breached":               is_breached,
        "sla_at_risk":                is_at_risk,
        "sla_deadline":               res_deadline.isoformat(),
        "sla_first_response_deadline": fr_deadline.isoformat(),
        "sla_minutes_remaining":      minutes_remaining,
        "sla_pct_elapsed":            pct_elapsed,
        "sla_resolution_minutes":     rule["resolution_min"],
        "sla_first_response_minutes": rule["first_response_min"],
    }


def _enrich_with_relationship(db: Session, ticket: Ticket) -> Ticket:
    """Attach parent relationship fields to a Ticket ORM instance."""
    rel = (
        db.query(TicketRelationship)
        .filter(TicketRelationship.child_ticket_id == ticket.id)
        .first()
    )
    if rel:
        parent = db.query(Ticket).filter(Ticket.id == rel.parent_ticket_id).first()
        ticket.parent_ticket_id = rel.parent_ticket_id
        ticket.parent_ticket_no = parent.ticket_no if parent else None
        ticket.relationship_type = rel.relation_type
    else:
        ticket.parent_ticket_id = None
        ticket.parent_ticket_no = None
        ticket.relationship_type = None
    return ticket


def _enrich_list_with_relationships(db: Session, tickets: List[Ticket]) -> List[Ticket]:
    """Batch-enrich a list of Ticket ORM instances with parent relationship data."""
    if not tickets:
        return tickets

    ticket_ids = [t.id for t in tickets]
    rels = (
        db.query(TicketRelationship)
        .filter(TicketRelationship.child_ticket_id.in_(ticket_ids))
        .all()
    )
    rel_map = {r.child_ticket_id: r for r in rels}

    parent_ids = [r.parent_ticket_id for r in rels]
    parent_map: dict = {}
    if parent_ids:
        parent_map = {
            t.id: t
            for t in db.query(Ticket).filter(Ticket.id.in_(parent_ids)).all()
        }

    for ticket in tickets:
        rel = rel_map.get(ticket.id)
        if rel:
            parent = parent_map.get(rel.parent_ticket_id)
            ticket.parent_ticket_id = rel.parent_ticket_id
            ticket.parent_ticket_no = parent.ticket_no if parent else None
            ticket.relationship_type = rel.relation_type
        else:
            ticket.parent_ticket_id = None
            ticket.parent_ticket_no = None
            ticket.relationship_type = None

    return tickets


def add_timeline_event(
    db: Session,
    ticket_id: str,
    event_type: str,
    event_label: Optional[str] = None,
    event_data: Optional[dict] = None,
    performed_by: Optional[str] = None,
) -> None:
    db.add(TicketTimeline(
        ticket_id=ticket_id,
        event_type=event_type,
        event_label=event_label,
        event_data=event_data,
        performed_by=performed_by,
    ))
    db.commit()


def get_ticket_relationships(db: Session, ticket_id: str):
    """Return all TicketRelationship rows where the ticket is parent or child."""
    as_child = (
        db.query(TicketRelationship)
        .filter(TicketRelationship.child_ticket_id == ticket_id)
        .all()
    )
    as_parent = (
        db.query(TicketRelationship)
        .filter(TicketRelationship.parent_ticket_id == ticket_id)
        .all()
    )

    results = []
    for rel in as_child:
        parent = db.query(Ticket).filter(Ticket.id == rel.parent_ticket_id).first()
        rel.parent_ticket_no = parent.ticket_no if parent else None
        rel.relationship_id = rel.id
        results.append(rel)
    for rel in as_parent:
        rel.parent_ticket_no = None  # this ticket IS the parent
        rel.relationship_id = rel.id
        results.append(rel)

    return results


def generate_ticket_number(db: Session) -> str:
    current_year = datetime.datetime.utcnow().year
    prefix = f"INC-{current_year}-"
    last_ticket = (
        db.query(Ticket)
        .filter(Ticket.ticket_no.like(f"{prefix}%"))
        .order_by(Ticket.ticket_no.desc())
        .first()
    )
    if last_ticket and last_ticket.ticket_no:
        try:
            last_seq = int(last_ticket.ticket_no.rsplit("-", 1)[-1])
            next_seq = last_seq + 1
        except ValueError:
            next_seq = 1
    else:
        next_seq = 1

    return f"{prefix}{next_seq:06d}"


def create_attachments(
    db: Session,
    ticket: Ticket,
    attachments: List[dict],
    uploaded_by: Optional[str] = None,
) -> None:
    for attachment_payload in attachments:
        attachment = Attachment(
            ticket_id=ticket.id,
            file_name=attachment_payload.get("file_name"),
            file_type=attachment_payload.get("file_type"),
            file_size=attachment_payload.get("file_size"),
            storage_path=attachment_payload.get("storage_path") or attachment_payload.get("file_name") or "",
            uploaded_by=uploaded_by,
        )
        db.add(attachment)
    db.commit()


def create_ticket(
    db: Session,
    user: User,
    subject: str,
    description: str,
    category_id: Optional[str] = None,
    subcategory_id: Optional[str] = None,
    priority: Optional[str] = None,
    source: Optional[str] = None,
    major_incident_flag: bool = False,
    emergency_override: bool = False,
    attachments: Optional[List[dict]] = None,
) -> Ticket:
    is_p1 = _is_p1_emergency(subject, description, priority)

    ticket_no = generate_ticket_number(db)
    ticket = Ticket(
        ticket_no=ticket_no,
        organization_id=user.organization_id,
        department_id=user.department_id,
        created_by=user.user_id,
        category_id=category_id,
        subcategory_id=subcategory_id,
        subject=subject,
        description=description,
        priority="P1" if is_p1 else (priority or "P3"),
        source=source or "PORTAL",
        major_incident_flag=True if is_p1 else major_incident_flag,
        emergency_override=True if is_p1 else emergency_override,
        status="OPEN",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    if attachments:
        create_attachments(db=db, ticket=ticket, attachments=attachments, uploaded_by=str(user.user_id))
        db.refresh(ticket)

    # Timeline: ticket created
    try:
        add_timeline_event(db, str(ticket.id), "TICKET_CREATED",
                           f"Ticket {ticket.ticket_no} submitted",
                           performed_by=str(user.user_id))
    except Exception:
        pass

    # Notification: user confirmation
    try:
        from app.services.notification_service import notify_ticket_created
        notify_ticket_created(db, ticket, user.user_id)
    except Exception:
        pass

    if is_p1:
        # P1 Emergency: skip duplicate engine and KB/resolution pipeline.
        # Run classification only to determine the correct team — then pin priority back to P1.
        try:
            from app.services.classification_service import run_classification_pipeline
            run_classification_pipeline(db, ticket)
            db.refresh(ticket)
            # Classification may have changed priority/urgency/impact — restore P1.
            ticket.priority = "P1"
            ticket.major_incident_flag = True
            ticket.emergency_override = True
            db.commit()
            db.refresh(ticket)
            if ticket.assigned_team_id:
                add_timeline_event(
                    db, str(ticket.id), "P1_DIRECT_ASSIGN",
                    f"P1 Emergency: classified and assigned to team",
                    performed_by=str(user.user_id),
                )
                print(f"[P1] Ticket {ticket.ticket_no} classified and assigned to team")
            else:
                # Fallback: assign by department if classification found no team
                team = _assign_p1_team(db, user)
                if team:
                    ticket.assigned_team_id = team.id
                    ticket.status = "IN_PROGRESS"
                    db.commit()
                    db.refresh(ticket)
                    add_timeline_event(
                        db, str(ticket.id), "P1_DIRECT_ASSIGN",
                        f"P1 Emergency: directly assigned to {team.team_name}",
                        performed_by=str(user.user_id),
                    )
                    print(f"[P1] Ticket {ticket.ticket_no} fallback-assigned to team '{team.team_name}'")
        except Exception as e:
            print(f"[ERROR] P1 classification/assignment failed: {e}")
    else:
        # Run semantic duplicate resolution engine
        try:
            attachment_text = None
            if attachments:
                attachment_text = " ".join([
                    f"{a.get('file_name', '')} {a.get('file_type', '')}"
                    for a in attachments if a
                ])
            run_semantic_duplicate_resolution(db=db, ticket=ticket, user=user, attachment_text=attachment_text)
        except Exception as e:
            print(f"[ERROR] Duplicate engine failed: {e}")

        db.refresh(ticket)

        # Run KB similarity + auto-resolve pipeline live on ticket creation
        try:
            from app.services.kb_similarity_service import run_resolution_confidence
            run_resolution_confidence(db, ticket)
            db.refresh(ticket)
        except Exception as e:
            print(f"[ERROR] KB resolution confidence failed: {e}")

    db.refresh(ticket)
    return ticket


def _enrich_ticket_names(db: Session, ticket: Ticket) -> None:
    """Resolve and attach display-name attributes to a Ticket ORM instance."""
    if ticket.category_id:
        cat = db.query(Category).filter(Category.id == ticket.category_id).first()
        ticket.category_name = cat.category_name if cat else None
    else:
        ticket.category_name = None

    if ticket.subcategory_id:
        sub = db.query(Subcategory).filter(Subcategory.id == ticket.subcategory_id).first()
        ticket.subcategory_name = sub.subcategory_name if sub else None
    else:
        ticket.subcategory_name = None

    team = None
    if ticket.assigned_team_id:
        team = db.query(Team).filter(Team.id == ticket.assigned_team_id).first()
        ticket.assigned_team_name = team.team_name if team else None
    else:
        ticket.assigned_team_name = None

    if ticket.department_id:
        dept = db.query(Department).filter(Department.id == ticket.department_id).first()
        ticket.department_name = dept.department_name if dept else None
    elif team and team.department_id:
        dept = db.query(Department).filter(Department.id == team.department_id).first()
        ticket.department_name = dept.department_name if dept else None
    else:
        ticket.department_name = None

    sla_map = _get_sla_minutes_map(db)
    sla = _compute_sla_status(ticket, sla_map)
    for k, v in sla.items():
        setattr(ticket, k, v)


def get_ticket_by_id(db: Session, ticket_id: str) -> Optional[Ticket]:
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if ticket:
        _enrich_with_relationship(db, ticket)
        _enrich_ticket_names(db, ticket)
    return ticket


def list_tickets(
    db: Session,
    current_user: User,
    ticket_no: Optional[str] = None,
    subject: Optional[str] = None,
    created_by: Optional[str] = None,
    department_id: Optional[str] = None,
    assigned_team_id: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category_id: Optional[str] = None,
    scope: Optional[str] = None,
    from_date: Optional[datetime.date] = None,
    to_date: Optional[datetime.date] = None,
    skip: int = 0,
    limit: int = 100,
):
    query = db.query(Ticket)

    if current_user.role.upper() == "ADMIN":
        pass
    elif current_user.role.upper() == "TEAM":
        if not department_id:
            query = query.filter(Ticket.assigned_team_id.isnot(None))
    else:
        query = query.filter(Ticket.created_by == current_user.user_id)

    if ticket_no:
        query = query.filter(Ticket.ticket_no == ticket_no)
    if subject:
        query = query.filter(Ticket.subject.ilike(f"%{subject}%"))
    if created_by:
        query = query.filter(Ticket.created_by == created_by)
    if department_id:
        # Filter by department: match tickets whose assigned team belongs to this department
        # OR tickets directly stamped with this department_id
        dept_team_ids = [
            str(t.id)
            for t in db.query(Team).filter(Team.department_id == department_id).all()
        ]
        if dept_team_ids:
            query = query.filter(
                (Ticket.department_id == department_id) |
                Ticket.assigned_team_id.in_(dept_team_ids)
            )
        else:
            query = query.filter(Ticket.department_id == department_id)
    if assigned_team_id:
        query = query.filter(Ticket.assigned_team_id == assigned_team_id)
    if status:
        query = query.filter(Ticket.status == status)
    if priority:
        query = query.filter(Ticket.priority == priority)
    if category_id:
        query = query.filter(Ticket.category_id == category_id)
    if scope:
        query = query.filter(Ticket.scope == scope)
    if from_date:
        query = query.filter(Ticket.created_at >= from_date)
    if to_date:
        query = query.filter(Ticket.created_at <= to_date)

    tickets = query.offset(skip).limit(limit).all()
    _enrich_list_with_relationships(db, tickets)
    _enrich_list_with_names(db, tickets)
    return tickets


def _enrich_list_with_names(db: Session, tickets: List[Ticket]) -> None:
    """Batch-resolve category / subcategory / team / department / creator display names."""
    if not tickets:
        return

    cat_ids    = list({str(t.category_id)    for t in tickets if t.category_id})
    sub_ids    = list({str(t.subcategory_id) for t in tickets if t.subcategory_id})
    team_ids   = list({str(t.assigned_team_id) for t in tickets if t.assigned_team_id})
    dept_ids   = list({str(t.department_id)  for t in tickets if t.department_id})
    creator_ids = list({str(t.created_by) for t in tickets if t.created_by})
    ticket_ids  = [t.id for t in tickets]

    cat_map  = {str(c.id): c.category_name    for c in db.query(Category).filter(Category.id.in_(cat_ids)).all()} if cat_ids else {}
    sub_map  = {str(s.id): s.subcategory_name for s in db.query(Subcategory).filter(Subcategory.id.in_(sub_ids)).all()} if sub_ids else {}
    team_objs = db.query(Team).filter(Team.id.in_(team_ids)).all() if team_ids else []
    team_map  = {str(t.id): t.team_name for t in team_objs}
    # team → its department_id, used as fallback when ticket.department_id is null
    team_dept_map = {str(t.id): str(t.department_id) for t in team_objs if t.department_id}

    all_dept_ids = set(dept_ids) | set(team_dept_map.values())
    dept_map = {str(d.id): d.department_name for d in db.query(Department).filter(Department.id.in_(all_dept_ids)).all()} if all_dept_ids else {}

    # Batch-resolve creator names
    creator_map = {
        str(u.user_id): u.full_name
        for u in db.query(User).filter(User.user_id.in_(creator_ids)).all()
    } if creator_ids else {}

    # Count duplicate children (tickets whose duplicate_of points to each ticket)
    from sqlalchemy import func as _func
    dup_counts = {
        str(row[0]): row[1]
        for row in db.query(Ticket.duplicate_of, _func.count(Ticket.id))
        .filter(Ticket.duplicate_of.in_(ticket_ids), Ticket.duplicate_of.isnot(None))
        .group_by(Ticket.duplicate_of)
        .all()
    } if ticket_ids else {}

    sla_map = _get_sla_minutes_map(db)

    for ticket in tickets:
        ticket.category_name      = cat_map.get(str(ticket.category_id))    if ticket.category_id    else None
        ticket.subcategory_name   = sub_map.get(str(ticket.subcategory_id)) if ticket.subcategory_id else None
        ticket.assigned_team_name = team_map.get(str(ticket.assigned_team_id)) if ticket.assigned_team_id else None
        if ticket.department_id:
            ticket.department_name = dept_map.get(str(ticket.department_id))
        elif ticket.assigned_team_id:
            fallback_dept_id = team_dept_map.get(str(ticket.assigned_team_id))
            ticket.department_name = dept_map.get(fallback_dept_id) if fallback_dept_id else None
        else:
            ticket.department_name = None
        ticket.creator_name   = creator_map.get(str(ticket.created_by)) if ticket.created_by else None
        ticket.duplicate_count = dup_counts.get(str(ticket.id), 0)
        sla = _compute_sla_status(ticket, sla_map)
        for k, v in sla.items():
            setattr(ticket, k, v)


def update_ticket(
    db: Session,
    ticket: Ticket,
    subject: Optional[str] = None,
    description: Optional[str] = None,
    category_id: Optional[str] = None,
    subcategory_id: Optional[str] = None,
    priority: Optional[str] = None,
    impact: Optional[str] = None,
    urgency: Optional[str] = None,
    scope: Optional[str] = None,
    major_incident_flag: Optional[bool] = None,
    emergency_override: Optional[bool] = None,
) -> Ticket:
    if subject is not None:
        ticket.subject = subject
    if description is not None:
        ticket.description = description
    if category_id is not None:
        ticket.category_id = category_id
    if subcategory_id is not None:
        ticket.subcategory_id = subcategory_id
    if priority is not None:
        ticket.priority = priority
    if impact is not None:
        ticket.impact = impact
    if urgency is not None:
        ticket.urgency = urgency
    if scope is not None:
        ticket.scope = scope
    if major_incident_flag is not None:
        ticket.major_incident_flag = major_incident_flag
    if emergency_override is not None:
        ticket.emergency_override = emergency_override

    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def update_ticket_status(db: Session, ticket: Ticket, status: str) -> Ticket:
    status = status.upper()
    valid_statuses = {
        "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPENED",
        "ESCALATED", "ON_HOLD",
    }
    if status not in valid_statuses:
        raise ValueError(f"Invalid status: {status}")

    ticket.status = status
    now = datetime.datetime.now(datetime.timezone.utc)
    if status == "CLOSED":
        ticket.closed_at = now
    if status == "RESOLVED":
        ticket.resolved_at = now
        if not ticket.resolved_by:
            ticket.resolved_by = "TEAM"
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def assign_ticket(
    db: Session,
    ticket: Ticket,
    assigned_team_id: Optional[str] = None,
    assigned_agent_id: Optional[str] = None,
) -> Ticket:
    if assigned_team_id is None and assigned_agent_id is None:
        raise ValueError("assigned_team_id or assigned_agent_id is required")

    ticket.assigned_team_id = assigned_team_id
    ticket.assigned_agent_id = assigned_agent_id
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    return ticket


# ── AI Resolution accept / reject ─────────────────────────────────────────────

def accept_ai_resolution(db: Session, ticket: Ticket, user: User) -> Ticket:
    if ticket.status != "AI_RESOLVED_PENDING_USER_CONFIRMATION":
        raise ValueError("Ticket is not pending user confirmation")
    if ticket.created_by != user.user_id:
        raise PermissionError("Only the ticket creator can accept this resolution")

    now = datetime.datetime.now(datetime.timezone.utc)
    ticket.status = "CLOSED"
    ticket.closed_by_user = True
    ticket.closed_at = now
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    add_timeline_event(db, str(ticket.id), "USER_ACCEPTED_AI_RESOLUTION",
                       "User accepted AI resolution",
                       performed_by=str(user.user_id))
    add_timeline_event(db, str(ticket.id), "TICKET_CLOSED",
                       "Ticket closed by user after accepting AI resolution",
                       performed_by=str(user.user_id))

    try:
        from app.services.notification_service import notify_ai_resolution_accepted
        notify_ai_resolution_accepted(db, ticket, user.user_id,
                                      team_id=ticket.assigned_team_id)
    except Exception:
        pass

    _enrich_with_relationship(db, ticket)
    _enrich_ticket_names(db, ticket)
    return ticket


def reject_ai_resolution(db: Session, ticket: Ticket, user: User) -> Ticket:
    if ticket.status != "AI_RESOLVED_PENDING_USER_CONFIRMATION":
        raise ValueError("Ticket is not pending user confirmation")
    if ticket.created_by != user.user_id:
        raise PermissionError("Only the ticket creator can reject this resolution")

    ticket.status = "OPEN"
    ticket.ai_resolution_rejected = True
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    add_timeline_event(db, str(ticket.id), "AI_RESOLUTION_REJECTED",
                       "User rejected AI resolution — ticket routed to support team",
                       performed_by=str(user.user_id))

    try:
        from app.services.notification_service import notify_ai_resolution_rejected
        notify_ai_resolution_rejected(db, ticket, user.user_id,
                                      team_id=ticket.assigned_team_id)
    except Exception:
        pass

    _enrich_with_relationship(db, ticket)
    _enrich_ticket_names(db, ticket)
    return ticket


# ── Timeline ───────────────────────────────────────────────────────────────────

def get_ticket_timeline(db: Session, ticket_id: str) -> List[dict]:
    """Merge TicketTimeline lifecycle events with TicketHistory field-change events."""
    _FIELD_LABEL = {
        "category_id":      "Category assigned",
        "subcategory_id":   "Subcategory assigned",
        "priority":         "Priority assigned",
        "impact":           "Impact assessed",
        "urgency":          "Urgency assessed",
        "assigned_team_id": "Team assigned",
        "status":           "Status changed",
    }

    history_rows = (
        db.query(TicketHistory)
        .filter(TicketHistory.ticket_id == ticket_id)
        .order_by(TicketHistory.id)
        .all()
    )
    history_events = [
        {
            "id": str(row.id),
            "event": _FIELD_LABEL.get(row.field_changed, row.field_changed),
            "value": row.new_value,
            "old_value": row.old_value,
            "changed_by": "AI Agent" if row.changed_by is None else str(row.changed_by),
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "source": "history",
        }
        for row in history_rows
    ]

    lifecycle_rows = (
        db.query(TicketTimeline)
        .filter(TicketTimeline.ticket_id == ticket_id)
        .order_by(TicketTimeline.created_at)
        .all()
    )
    lifecycle_events = [
        {
            "id": str(row.id),
            "event": row.event_label or row.event_type,
            "value": row.event_type,
            "old_value": None,
            "changed_by": row.performed_by or "System",
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "source": "lifecycle",
        }
        for row in lifecycle_rows
    ]

    # Lifecycle events first (chronological), then field-change history
    return lifecycle_events + history_events


# ── Dashboard stats ────────────────────────────────────────────────────────────

def get_admin_dashboard_stats(db: Session) -> dict:
    """Aggregate ticket counts by status, priority, per-team/dept workload, and AI resolution metrics."""
    from app.models.models import TicketResolutionScore, KnowledgeBase, CSATFeedback

    now = datetime.datetime.utcnow()
    all_tickets = db.query(Ticket).all()

    status_counts: dict = {}
    priority_counts: dict = {}
    team_counts: dict = {}
    category_counts: dict = {}
    dept_stats: dict = {}    # dept_id -> {total, open, in_progress, resolved, sla_breached}

    # AI resolution tracking
    ai_auto_resolved    = 0
    ai_team_review      = 0
    human_resolved      = 0
    ai_accepted         = 0
    ai_rejected         = 0
    team_edited_ai      = 0
    active_incidents    = 0
    tickets_reopened    = 0
    duplicate_count     = 0
    total_res_hours     = 0.0
    resolved_with_time  = 0

    sla_map = _get_sla_minutes_map(db)
    active_statuses = {"OPEN", "ASSIGNED", "IN_PROGRESS", "AI_TEAM_REVIEW",
                       "AI_RESOLVED_PENDING_USER_CONFIRMATION", "TEAM_APPROVED_AI_RESPONSE"}

    for t in all_tickets:
        s = t.status or "OPEN"
        status_counts[s] = status_counts.get(s, 0) + 1
        priority_counts[t.priority] = priority_counts.get(t.priority, 0) + 1
        if t.assigned_team_id:
            key = str(t.assigned_team_id)
            team_counts[key] = team_counts.get(key, 0) + 1
        if t.category_id:
            cid = str(t.category_id)
            category_counts[cid] = category_counts.get(cid, 0) + 1

        # AI resolution metrics
        rt = (t.resolution_type or "").upper()
        if rt == "AI_AUTO_RESOLVE":
            ai_auto_resolved += 1
        elif rt == "AI_TEAM_REVIEW":
            ai_team_review += 1
        elif s in ("RESOLVED", "CLOSED") and rt not in ("AI_AUTO_RESOLVE", "AI_TEAM_REVIEW"):
            human_resolved += 1

        if t.closed_by_user and rt == "AI_AUTO_RESOLVE":
            ai_accepted += 1
        if t.ai_resolution_rejected:
            ai_rejected += 1
        if t.edited_team_solution:
            team_edited_ai += 1

        if t.major_incident_flag and s in active_statuses:
            active_incidents += 1
        if s == "REOPENED":
            tickets_reopened += 1
        if t.duplicate_of:
            duplicate_count += 1

        # Avg resolution time (hours)
        if s in ("RESOLVED", "CLOSED") and t.created_at and t.updated_at:
            delta_h = (t.updated_at - t.created_at).total_seconds() / 3600
            if 0 < delta_h < 720:  # cap at 30 days
                total_res_hours += delta_h
                resolved_with_time += 1

        # Per-department stats
        if t.department_id:
            did = str(t.department_id)
            if did not in dept_stats:
                dept_stats[did] = {"total": 0, "open": 0, "in_progress": 0, "resolved": 0, "sla_breached": 0}
            ds = dept_stats[did]
            ds["total"] += 1
            if s in ("OPEN", "ASSIGNED"):
                ds["open"] += 1
            elif s == "IN_PROGRESS":
                ds["in_progress"] += 1
            elif s in ("RESOLVED", "CLOSED"):
                ds["resolved"] += 1
            # SLA breach check
            if s in active_statuses and t.created_at:
                h = sla_map.get(t.priority, {}).get("resolution_min", 4320) / 60
                if t.created_at + datetime.timedelta(hours=h) < now:
                    ds["sla_breached"] += 1

    # Acceptance / rejection rates
    total_ai_delivered = ai_accepted + ai_rejected
    ai_acceptance_rate = round(ai_accepted / total_ai_delivered * 100, 1) if total_ai_delivered else 0.0
    ai_rejection_rate  = round(ai_rejected / total_ai_delivered * 100, 1) if total_ai_delivered else 0.0

    # AI resolution %
    total = len(all_tickets)
    ai_resolved_total = ai_auto_resolved + ai_team_review
    ai_resolution_pct = round(ai_resolved_total / total * 100, 1) if total else 0.0

    # Overall SLA compliance
    active_n = sum(1 for t in all_tickets if (t.status or "") in active_statuses)
    sla_breached_total = sum(ds["sla_breached"] for ds in dept_stats.values())
    sla_compliance_pct = round((1 - sla_breached_total / max(active_n, 1)) * 100, 1)

    # Duplicate reduction %
    duplicate_reduction_pct = round(duplicate_count / total * 100, 1) if total else 0.0

    # Avg resolution time
    avg_resolution_hours = round(total_res_hours / resolved_with_time, 1) if resolved_with_time else 0.0

    # Pending CSAT (resolved tickets without feedback)
    resolved_ids = [t.id for t in all_tickets if (t.status or "") in ("RESOLVED", "CLOSED", "AI_RESOLVED")]
    rated_ids = set()
    if resolved_ids:
        rated_rows = db.query(CSATFeedback.ticket_id).filter(CSATFeedback.ticket_id.in_(resolved_ids)).all()
        rated_ids = {str(r[0]) for r in rated_rows}
    pending_feedback = sum(1 for t in all_tickets
                           if (t.status or "") in ("RESOLVED", "CLOSED", "AI_RESOLVED")
                           and str(t.id) not in rated_ids)

    # Most successful KB articles
    kb_rows = (
        db.query(TicketResolutionScore.matched_kb_article_id, sql_func.count().label("cnt"))
        .filter(TicketResolutionScore.matched_kb_article_id.isnot(None))
        .group_by(TicketResolutionScore.matched_kb_article_id)
        .order_by(sql_func.count().desc())
        .limit(5)
        .all()
    )
    kb_ids = [r[0] for r in kb_rows if r[0]]
    kb_map = {}
    if kb_ids:
        kb_articles = db.query(KnowledgeBase).filter(KnowledgeBase.id.in_(kb_ids)).all()
        kb_map = {str(a.id): a.title for a in kb_articles}
    top_kb_articles = [
        {"article_id": str(r[0]), "title": kb_map.get(str(r[0]), str(r[0])), "usage_count": r[1]}
        for r in kb_rows if r[0]
    ]

    # Department breakdown with names
    dept_breakdown = []
    if dept_stats:
        depts = db.query(Department).filter(Department.id.in_(list(dept_stats.keys()))).all()
        dept_name_map = {str(d.id): d.department_name for d in depts}
        for did, ds in dept_stats.items():
            active_in_dept = ds["open"] + ds["in_progress"]
            dept_sla = round((1 - ds["sla_breached"] / max(active_in_dept, 1)) * 100, 1)
            dept_breakdown.append({
                "dept_id": did,
                "dept_name": dept_name_map.get(did, did),
                "total": ds["total"],
                "open": ds["open"],
                "in_progress": ds["in_progress"],
                "resolved": ds["resolved"],
                "sla_compliance": dept_sla,
            })
        dept_breakdown.sort(key=lambda x: -x["total"])

    # Resolve team names
    team_name_map = {}
    if team_counts:
        teams = db.query(Team).filter(Team.id.in_(list(team_counts.keys()))).all()
        team_name_map = {str(t.id): t.team_name for t in teams}

    team_workload = [
        {"team_id": tid, "team_name": team_name_map.get(tid, tid), "open_tickets": cnt}
        for tid, cnt in sorted(team_counts.items(), key=lambda x: -x[1])
    ]

    # Category breakdown
    cat_breakdown = []
    if category_counts:
        cats = db.query(Category).filter(Category.id.in_(list(category_counts.keys()))).all()
        cat_name_map = {str(c.id): c.category_name for c in cats}
        cat_breakdown = sorted(
            [{"category": cat_name_map.get(cid, cid), "count": cnt}
             for cid, cnt in category_counts.items()],
            key=lambda x: -x["count"],
        )[:6]

    # Daily volume – last 30 days
    thirty_days_ago = now - datetime.timedelta(days=30)
    daily_new: dict = {}
    daily_resolved: dict = {}
    for t in all_tickets:
        if t.created_at and t.created_at >= thirty_days_ago:
            d = t.created_at.strftime("%m/%d")
            daily_new[d] = daily_new.get(d, 0) + 1
        if (t.status or "") in ("RESOLVED", "CLOSED") and t.updated_at and t.updated_at >= thirty_days_ago:
            d = t.updated_at.strftime("%m/%d")
            daily_resolved[d] = daily_resolved.get(d, 0) + 1
    all_days = sorted(set(list(daily_new.keys()) + list(daily_resolved.keys())))
    daily_volume = [
        {"date": d, "new": daily_new.get(d, 0), "resolved": daily_resolved.get(d, 0)}
        for d in all_days
    ]

    # Active incidents list (top 5)
    incident_tickets = [
        t for t in all_tickets
        if t.major_incident_flag and (t.status or "") in active_statuses
    ][:5]
    incidents_list = []
    if incident_tickets:
        inc_team_ids = [str(t.assigned_team_id) for t in incident_tickets if t.assigned_team_id]
        inc_team_map = {str(t.id): t.team_name for t in db.query(Team).filter(Team.id.in_(inc_team_ids)).all()} if inc_team_ids else {}
        for t in incident_tickets:
            incidents_list.append({
                "ticket_id": str(t.id),
                "ticket_no": t.ticket_no,
                "subject": t.subject,
                "priority": t.priority,
                "status": t.status,
                "assigned_team": inc_team_map.get(str(t.assigned_team_id), "—") if t.assigned_team_id else "—",
            })

    open_count     = status_counts.get("OPEN", 0)
    assigned_count = status_counts.get("ASSIGNED", 0)
    pending_count  = status_counts.get("PENDING_ADMIN_REVIEW", 0)
    resolved_count = status_counts.get("RESOLVED", 0) + status_counts.get("CLOSED", 0)
    in_progress    = status_counts.get("IN_PROGRESS", 0)

    return {
        "total_tickets":    total,
        "open":             open_count,
        "assigned":         assigned_count,
        "in_progress":      in_progress,
        "pending_review":   pending_count,
        "resolved":         resolved_count,
        "tickets_reopened": tickets_reopened,
        "active_incidents": active_incidents,
        "pending_feedback": pending_feedback,
        "avg_resolution_hours": avg_resolution_hours,
        "ai_resolution_pct": ai_resolution_pct,
        "sla_compliance_pct": sla_compliance_pct,
        "duplicate_reduction_pct": duplicate_reduction_pct,
        "status_breakdown": status_counts,
        "priority_breakdown": priority_counts,
        "category_breakdown": cat_breakdown,
        "team_workload":    team_workload,
        "department_breakdown": dept_breakdown,
        "daily_volume":     daily_volume,
        "incidents_list":   incidents_list,
        # ── AI resolution metrics ─────────────────────────────────────────────
        "ai_auto_resolved":    ai_auto_resolved,
        "ai_team_review":      ai_team_review,
        "human_resolved":      human_resolved,
        "ai_accepted":         ai_accepted,
        "ai_rejected":         ai_rejected,
        "team_edited_ai":      team_edited_ai,
        "ai_acceptance_rate":  ai_acceptance_rate,
        "ai_rejection_rate":   ai_rejection_rate,
        "top_kb_articles":     top_kb_articles,
    }


def get_ticket_messages(db: Session, ticket_id: str) -> List[dict]:
    from app.models.models import TicketMessage, User
    rows = (
        db.query(TicketMessage, User.full_name)
        .outerjoin(User, TicketMessage.sender_id == User.user_id)
        .filter(TicketMessage.ticket_id == ticket_id)
        .filter(TicketMessage.message_type == "CHAT")
        .order_by(TicketMessage.created_at.asc())
        .all()
    )
    return [
        {
            "id": str(m.id),
            "ticket_id": str(m.ticket_id),
            "sender_id": str(m.sender_id) if m.sender_id else None,
            "sender_name": full_name or ("AI Agent" if m.sender_type == "AI" else "Unknown"),
            "sender_type": m.sender_type,
            "message_body": m.message_body,
            "created_at": m.created_at,
        }
        for m, full_name in rows
    ]


def create_ticket_message(db: Session, ticket_id: str, sender, body: str) -> dict:
    from app.models.models import TicketMessage, User
    msg = TicketMessage(
        ticket_id=ticket_id,
        sender_id=sender.user_id,
        sender_type=sender.role.upper(),
        message_type="CHAT",
        message_body=body.strip(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    sender_name = getattr(sender, "full_name", None) or str(sender.user_id)
    return {
        "id": str(msg.id),
        "ticket_id": str(msg.ticket_id),
        "sender_id": str(msg.sender_id),
        "sender_name": sender_name,
        "sender_type": msg.sender_type,
        "message_body": msg.message_body,
        "created_at": msg.created_at,
    }


def get_notifications_for_user(db: Session, user_id: str, limit: int = 20) -> List[dict]:
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.id.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(r.id),
            "type": r.notification_type,
            "title": r.title,
            "message": r.message,
            "is_read": r.is_read,
        }
        for r in rows
    ]


def mark_notifications_read(db: Session, user_id: str) -> None:
    db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()


# ── Department dashboard stats ─────────────────────────────────────────────────

def get_department_dashboard_stats(db: Session, user) -> dict:
    now = datetime.datetime.utcnow()
    sla_map = _get_sla_minutes_map(db)

    # ── Resolve which teams belong to this user's department ──────────────────
    dept_name = "Department"
    team_ids: list = []

    if hasattr(user, "role") and user.role.upper() == "ADMIN":
        all_teams = db.query(Team).all()
        team_ids = [str(t.id) for t in all_teams]
        dept_name = "All Departments"
    else:
        member = db.query(TeamMember).filter(TeamMember.user_id == user.user_id).first()
        if member:
            team = db.query(Team).filter(Team.id == member.team_id).first()
            if team and team.department_id:
                dept = db.query(Department).filter(Department.id == team.department_id).first()
                dept_name = dept.department_name if dept else "Department"
                dept_teams = db.query(Team).filter(Team.department_id == team.department_id).all()
                team_ids = [str(t.id) for t in dept_teams]
            elif team:
                team_ids = [str(team.id)]

    # ── Query tickets ─────────────────────────────────────────────────────────
    q = db.query(Ticket)
    if team_ids:
        q = q.filter(Ticket.assigned_team_id.in_(team_ids))
    else:
        q = q.filter(False)
    all_tickets = q.all()

    # ── Aggregate ─────────────────────────────────────────────────────────────
    week_start  = now - datetime.timedelta(days=7)
    week_start2 = now - datetime.timedelta(days=14)

    status_counts: dict = {}
    priority_counts: dict = {}
    category_counts: dict = {}
    team_stats: dict = {}
    escalated = sla_breached = sla_at_risk = incidents = svc_requests = 0
    this_week = last_week = 0

    for t in all_tickets:
        s = t.status or "OPEN"
        status_counts[s] = status_counts.get(s, 0) + 1
        if t.priority:
            priority_counts[t.priority] = priority_counts.get(t.priority, 0) + 1
        if t.category_id:
            cid = str(t.category_id)
            category_counts[cid] = category_counts.get(cid, 0) + 1

        active = s in ("OPEN", "ASSIGNED", "IN_PROGRESS")
        if t.priority == "P1" and active:
            escalated += 1
        if active and t.created_at:
            h = sla_map.get(t.priority, {}).get("resolution_min", 4320) / 60
            deadline = t.created_at + datetime.timedelta(hours=h)
            if deadline < now:
                sla_breached += 1
            elif deadline < now + datetime.timedelta(hours=h * 0.2):
                sla_at_risk += 1

        if t.major_incident_flag:
            incidents += 1
        else:
            svc_requests += 1

        if t.created_at:
            if t.created_at >= week_start:
                this_week += 1
            elif t.created_at >= week_start2:
                last_week += 1

        if t.assigned_team_id:
            tid = str(t.assigned_team_id)
            if tid not in team_stats:
                team_stats[tid] = {
                    "open": 0, "in_progress": 0, "pending": 0,
                    "resolved": 0, "escalated": 0, "sla_breached": 0, "total": 0,
                }
            ts = team_stats[tid]
            ts["total"] += 1
            if s in ("OPEN", "ASSIGNED"):
                ts["open"] += 1
            elif s == "IN_PROGRESS":
                ts["in_progress"] += 1
            elif s == "PENDING_ADMIN_REVIEW":
                ts["pending"] += 1
            elif s in ("RESOLVED", "CLOSED"):
                ts["resolved"] += 1
            if t.priority == "P1" and active:
                ts["escalated"] += 1
            if active and t.created_at:
                h = sla_map.get(t.priority, {}).get("resolution_min", 4320) / 60
                if t.created_at + datetime.timedelta(hours=h) < now:
                    ts["sla_breached"] += 1

    # ── Resolve display names ─────────────────────────────────────────────────
    if team_stats:
        teams = db.query(Team).filter(Team.id.in_(list(team_stats.keys()))).all()
        team_name_map = {str(t.id): t.team_name for t in teams}
    else:
        team_name_map = {}

    team_breakdown = sorted(
        [{"team_id": tid, "team_name": team_name_map.get(tid, tid), **stats}
         for tid, stats in team_stats.items()],
        key=lambda x: -x["total"],
    )

    if category_counts:
        cats = db.query(Category).filter(Category.id.in_(list(category_counts.keys()))).all()
        cat_name_map = {str(c.id): c.category_name for c in cats}
    else:
        cat_name_map = {}

    category_breakdown = sorted(
        [{"category": cat_name_map.get(cid, cid), "count": cnt}
         for cid, cnt in category_counts.items()],
        key=lambda x: -x["count"],
    )[:10]

    # ── Recent activity ───────────────────────────────────────────────────────
    if team_ids:
        hist_rows = (
            db.query(TicketHistory, Ticket)
            .join(Ticket, TicketHistory.ticket_id == Ticket.id)
            .filter(Ticket.assigned_team_id.in_(team_ids))
            .order_by(TicketHistory.id.desc())
            .limit(15)
            .all()
        )
    else:
        hist_rows = []

    _FIELD_LABEL = {
        "category_id":    "Category assigned",
        "subcategory_id": "Subcategory assigned",
        "priority":       "Priority set",
        "assigned_team_id": "Assigned to team",
        "status":         "Status changed",
    }
    recent_activity = [
        {
            "event":     _FIELD_LABEL.get(h.field_changed, h.field_changed),
            "value":     h.new_value,
            "ticket_id": str(h.ticket_id),
            "ticket_no": t.ticket_no,
        }
        for h, t in hist_rows
    ]

    # ── Final aggregates ──────────────────────────────────────────────────────
    open_n   = status_counts.get("OPEN", 0) + status_counts.get("ASSIGNED", 0)
    in_prog  = status_counts.get("IN_PROGRESS", 0)
    pending  = status_counts.get("PENDING_ADMIN_REVIEW", 0)
    resolved = status_counts.get("RESOLVED", 0) + status_counts.get("CLOSED", 0)
    active_n = open_n + in_prog
    sla_compliance = round((1 - sla_breached / max(active_n, 1)) * 100, 1)

    def pct(curr, prev):
        if prev == 0:
            return 0
        return round((curr - prev) / prev * 100, 1)

    return {
        "dept_name":        dept_name,
        "total_tickets":    len(all_tickets),
        "open":             open_n,
        "in_progress":      in_prog,
        "pending":          pending,
        "resolved":         resolved,
        "escalated":        escalated,
        "sla_breached":     sla_breached,
        "sla_at_risk":      sla_at_risk,
        "incidents":        incidents,
        "service_requests": svc_requests,
        "sla_compliance":   sla_compliance,
        "active_slas":      active_n,
        "status_breakdown":   status_counts,
        "priority_breakdown": priority_counts,
        "category_breakdown": category_breakdown,
        "team_breakdown":     team_breakdown,
        "this_week":          this_week,
        "last_week":          last_week,
        "trend_week_pct":     pct(this_week, last_week),
        "recent_activity":    recent_activity,
    }


# ── Team AI Action (Approve / Edit / Reject) ───────────────────────────────────

def team_ai_action(db: Session, ticket: Ticket, action: str, edited_solution: Optional[str], agent) -> Ticket:
    """
    Process a team member's decision on the AI suggested resolution.

    APPROVE → send original AI solution to user, status = TEAM_APPROVED_AI_RESPONSE
    EDIT    → send edited solution to user, store both, status = TEAM_APPROVED_AI_RESPONSE
    REJECT  → status = IN_PROGRESS, team investigates manually
    """
    from app.models.models import TicketMessage, TicketConversation
    action = action.upper()
    now = datetime.datetime.now(datetime.timezone.utc)
    approved_by = getattr(agent, "full_name", None) or str(agent.user_id)

    if action == "REJECT":
        ticket.status = "IN_PROGRESS"
        ticket.resolution_type = None
        db.add(ticket)
        db.commit()
        add_timeline_event(db, str(ticket.id), "AI_SUGGESTION_REJECTED",
                           f"Team rejected AI suggestion — ticket moved to IN_PROGRESS",
                           performed_by=str(agent.user_id))
    else:
        # APPROVE or EDIT
        solution = ticket.original_ai_solution or ""
        if action == "EDIT" and edited_solution and edited_solution.strip():
            ticket.edited_team_solution = edited_solution.strip()
            solution = edited_solution.strip()

        # Deliver solution to user via chat message
        db.add(TicketMessage(
            ticket_id=ticket.id,
            sender_id=agent.user_id,
            sender_type="TEAM",
            message_type="CHAT",
            message_body=solution,
        ))

        ticket.status = "TEAM_APPROVED_AI_RESPONSE"
        ticket.ai_solution_approved_by = approved_by
        ticket.ai_solution_approved_at = now
        ticket.resolution_type = "AI_TEAM_REVIEW"
        db.add(ticket)
        db.commit()

        label = (
            f"Team edited and approved AI suggestion — solution sent to user"
            if action == "EDIT"
            else f"Team approved AI suggestion — solution sent to user"
        )
        add_timeline_event(db, str(ticket.id), "TEAM_APPROVED_AI_SOLUTION", label,
                           performed_by=str(agent.user_id))

    db.refresh(ticket)
    _enrich_with_relationship(db, ticket)
    _enrich_ticket_names(db, ticket)
    return ticket


# ── Conversations (P1/P2 structured thread) ────────────────────────────────────

def get_ticket_conversations(db: Session, ticket_id: str, include_internal: bool = False) -> List[dict]:
    from app.models.models import TicketConversation, User
    q = (
        db.query(TicketConversation, User.full_name)
        .outerjoin(User, TicketConversation.sender_id == User.user_id)
        .filter(TicketConversation.ticket_id == ticket_id)
    )
    if not include_internal:
        q = q.filter(TicketConversation.is_internal == False)
    rows = q.order_by(TicketConversation.created_at.asc()).all()
    return [
        {
            "id": str(c.id),
            "ticket_id": str(c.ticket_id),
            "sender_id": str(c.sender_id) if c.sender_id else None,
            "sender_name": full_name or ("AI Agent" if c.sender_role == "AI" else "Unknown"),
            "sender_role": c.sender_role,
            "message": c.message,
            "attachment_url": c.attachment_url,
            "is_internal": c.is_internal,
            "created_at": c.created_at,
        }
        for c, full_name in rows
    ]


def create_conversation_message(db: Session, ticket_id: str, sender, message: str,
                                attachment_url: Optional[str] = None) -> dict:
    from app.models.models import TicketConversation, User
    conv = TicketConversation(
        ticket_id=ticket_id,
        sender_id=sender.user_id,
        sender_role=sender.role.upper(),
        message=message.strip(),
        attachment_url=attachment_url,
        is_internal=False,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)

    # Timeline event per message
    add_timeline_event(db, ticket_id, "CONVERSATION_MESSAGE",
                       f"{sender.role.title()} sent a message",
                       performed_by=str(sender.user_id))

    sender_name = getattr(sender, "full_name", None) or str(sender.user_id)
    return {
        "id": str(conv.id),
        "ticket_id": str(conv.ticket_id),
        "sender_id": str(conv.sender_id),
        "sender_name": sender_name,
        "sender_role": conv.sender_role,
        "message": conv.message,
        "attachment_url": conv.attachment_url,
        "is_internal": conv.is_internal,
        "created_at": conv.created_at,
    }


# ── CSAT ──────────────────────────────────────────────────────────────────────

def submit_csat(db: Session, ticket_id: str, user, rating: int,
                feedback_text: Optional[str], is_resolved: Optional[bool]) -> object:
    from app.models.models import CSATFeedback
    existing = db.query(CSATFeedback).filter(
        CSATFeedback.ticket_id == ticket_id,
        CSATFeedback.user_id == user.user_id,
    ).first()
    if existing:
        existing.rating = rating
        existing.feedback_text = feedback_text
        existing.is_resolved = is_resolved
        db.commit()
        db.refresh(existing)
        return existing
    record = CSATFeedback(
        ticket_id=ticket_id,
        user_id=user.user_id,
        rating=rating,
        feedback_text=feedback_text,
        is_resolved=is_resolved,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_user_csat_records(db: Session, user) -> list:
    from app.models.models import CSATFeedback
    return (
        db.query(CSATFeedback)
        .filter(CSATFeedback.user_id == user.user_id)
        .order_by(CSATFeedback.created_at.desc())
        .all()
    )


# ── Live ticket analyze (pre-submit preview) ───────────────────────────────────

def analyze_ticket_preview(db: Session, subject: str, description: str) -> dict:
    """
    Runs lightweight classification + vector search on raw subject/description
    before the ticket is created. Used by the New Ticket right-panel live preview.
    """
    from types import SimpleNamespace
    from sqlalchemy import text as sa_text
    from app.services.classification_service import (
        CategoryAgent, ImpactAgent, UrgencyAgent,
        _fetch_master_data, _BASE_MATRIX,
    )
    from app.services.embedding_service import EmbeddingService
    from app.models.models import AssignmentRule

    mock = SimpleNamespace(subject=subject, description=description)

    # 1. Category (full LLM + heuristic fallback)
    master = _fetch_master_data(db)
    cat = CategoryAgent.classify(mock, master)

    # 2. Urgency + Impact via heuristic keywords → Priority matrix
    impact_r  = ImpactAgent._heuristic(mock)
    urgency_r = UrgencyAgent._heuristic(mock)
    impact    = impact_r["impact"]
    urgency   = urgency_r["urgency"]
    priority  = _BASE_MATRIX.get((impact, urgency), "P3")

    # 3. Suggest a team from the detected category via assignment_rules
    suggested_team = None
    cat_name = cat.get("category_name") or ""
    if cat_name:
        cat_obj = db.query(Category).filter(
            Category.category_name.ilike(cat_name)
        ).first()
        if cat_obj:
            rule = (
                db.query(AssignmentRule)
                .filter(AssignmentRule.category_id == cat_obj.id,
                        AssignmentRule.is_active == True)
                .first()
            )
            if rule:
                team_obj = db.query(Team).filter(Team.id == rule.team_id).first()
                if team_obj:
                    suggested_team = team_obj.team_name

    # 4. Generate embedding for vector searches
    emb_text  = EmbeddingService.build_embedding_text(subject, description)
    embedding = EmbeddingService.generate_embedding(emb_text)
    vec_str   = "[" + ",".join(str(round(float(v), 8)) for v in embedding) + "]"

    # 5. Similar open tickets
    sim_sql = sa_text("""
        SELECT t.ticket_no, t.subject, t.status,
               ROUND(CAST((1 - (te.embedding <=> CAST(:vec AS vector))) * 100 AS numeric), 1) AS similarity
        FROM ticket_embeddings te
        JOIN tickets t ON t.id = te.ticket_id
        WHERE t.status NOT IN ('CLOSED', 'RESOLVED', 'CANCELLED')
        ORDER BY te.embedding <=> CAST(:vec AS vector)
        LIMIT 5
    """)
    sim_rows = db.execute(sim_sql, {"vec": vec_str}).fetchall()
    similar_tickets = [
        {"ticket_no": r[0], "subject": r[1], "status": r[2], "similarity": float(r[3])}
        for r in sim_rows
        if float(r[3]) > 40
    ][:3]

    # 6. KB article suggestions
    kb_sql = sa_text("""
        SELECT kb.title, kb.resolution,
               ROUND(CAST((1 - (kbe.embedding <=> CAST(:vec AS vector))) * 100 AS numeric), 1) AS similarity
        FROM kb_embeddings kbe
        JOIN knowledge_base kb ON kb.id = kbe.kb_id
        WHERE kb.is_published = true
        ORDER BY kbe.embedding <=> CAST(:vec AS vector)
        LIMIT 5
    """)
    kb_rows = db.execute(kb_sql, {"vec": vec_str}).fetchall()
    kb_suggestions = [
        {"title": r[0], "resolution_preview": (r[1] or "")[:140]}
        for r in kb_rows
        if float(r[2]) > 35
    ][:3]

    return {
        "category": cat_name or None,
        "category_confidence": round((cat.get("confidence") or 0) * 100),
        "priority": priority,
        "urgency": urgency,
        "impact": impact,
        "suggested_team": suggested_team,
        "similar_tickets": similar_tickets,
        "kb_suggestions": kb_suggestions,
    }


# ── Team member workload ───────────────────────────────────────────────────────

def get_team_members_workload(db: Session, user) -> dict:
    """Returns team members with their assigned tickets and current user's member_role."""
    member_record = db.query(TeamMember).filter(TeamMember.user_id == user.user_id).first()
    if not member_record:
        return {
            "team_id": None, "team_name": None,
            "current_user_member_role": "AGENT",
            "members": [], "unassigned_tickets": [],
        }

    team = db.query(Team).filter(Team.id == member_record.team_id).first()
    current_member_role = (member_record.member_role or "AGENT").upper()

    team_members = (
        db.query(TeamMember, User)
        .join(User, TeamMember.user_id == User.user_id)
        .filter(TeamMember.team_id == member_record.team_id)
        .all()
    )

    active_statuses = [
        "OPEN", "IN_PROGRESS", "ASSIGNED", "ESCALATED", "REOPENED",
        "AI_TEAM_REVIEW", "AI_RESOLVED_PENDING_USER_CONFIRMATION", "TEAM_APPROVED_AI_RESPONSE",
    ]
    team_tickets = (
        db.query(Ticket)
        .filter(Ticket.assigned_team_id == member_record.team_id)
        .filter(Ticket.status.in_(active_statuses))
        .order_by(Ticket.created_at.desc())
        .limit(300)
        .all()
    )

    sla_map = _get_sla_minutes_map(db)

    def ticket_preview(t):
        sla = _compute_sla_status(t, sla_map)
        return {
            "ticket_id": str(t.id),
            "ticket_no": t.ticket_no,
            "subject": t.subject,
            "status": t.status,
            "priority": t.priority or "P3",
            "sla_breached": sla.get("sla_breached"),
            "sla_at_risk": sla.get("sla_at_risk"),
            "sla_minutes_remaining": sla.get("sla_minutes_remaining"),
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }

    agent_ticket_map: dict = {}
    unassigned = []
    for t in team_tickets:
        if t.assigned_agent_id:
            aid = str(t.assigned_agent_id)
            agent_ticket_map.setdefault(aid, []).append(ticket_preview(t))
        else:
            unassigned.append(ticket_preview(t))

    members_out = []
    for tm, u in team_members:
        uid = str(u.user_id)
        members_out.append({
            "member_id": str(tm.id),
            "user_id": uid,
            "full_name": u.full_name,
            "member_role": (tm.member_role or "AGENT").upper(),
            "tickets": agent_ticket_map.get(uid, []),
        })

    # All members across every team in the same department (for name resolution + assign dropdown + chart)
    department_members = []
    if team and team.department_id:
        from uuid import UUID as _UUID
        dept_team_ids_uuid = [
            t.id for t in db.query(Team).filter(
                Team.department_id == team.department_id, Team.is_active == True
            ).all()
        ]
        dept_team_ids = [str(tid) for tid in dept_team_ids_uuid]
        dept_rows = (
            db.query(TeamMember, User)
            .join(User, TeamMember.user_id == User.user_id)
            .filter(TeamMember.team_id.in_(dept_team_ids_uuid))
            .all()
        )

        # Count active tickets assigned to each dept member
        from sqlalchemy import func as _func
        dept_ticket_counts = {
            str(row[0]): row[1]
            for row in db.query(Ticket.assigned_agent_id, _func.count(Ticket.id))
            .filter(
                Ticket.assigned_team_id.in_(dept_team_ids_uuid),
                Ticket.assigned_agent_id.isnot(None),
                Ticket.status.in_(active_statuses),
            )
            .group_by(Ticket.assigned_agent_id)
            .all()
        }

        department_members = [
            {
                "user_id": str(u.user_id),
                "full_name": u.full_name,
                "member_role": (tm.member_role or "AGENT").upper(),
                "team_id": str(tm.team_id),
                "ticket_count": dept_ticket_counts.get(str(u.user_id), 0),
            }
            for tm, u in dept_rows
        ]

    return {
        "team_id": str(team.id) if team else None,
        "team_name": team.team_name if team else None,
        "current_user_member_role": current_member_role,
        "members": members_out,
        "unassigned_tickets": unassigned,
        "department_members": department_members,
    }


def assign_ticket_to_member(db: Session, ticket_id: str, agent_user_id: str, current_user) -> dict:
    """Assign a ticket to a specific team member. Only MANAGER can do this."""
    cur_member = db.query(TeamMember).filter(TeamMember.user_id == current_user.user_id).first()
    if not cur_member or (cur_member.member_role or "AGENT").upper() != "MANAGER":
        raise PermissionError("Only team managers can assign tickets to members")

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise ValueError("Ticket not found")

    agent_member = db.query(TeamMember).filter(
        TeamMember.user_id == agent_user_id,
        TeamMember.team_id == cur_member.team_id,
    ).first()
    if not agent_member:
        raise ValueError("Agent is not a member of your team")

    ticket.assigned_agent_id = agent_user_id
    if not ticket.assigned_team_id:
        ticket.assigned_team_id = str(cur_member.team_id)
    db.commit()
    db.refresh(ticket)

    add_timeline_event(
        db, ticket_id, "ASSIGNED_TO_MEMBER",
        f"Ticket assigned to team member by manager",
        performed_by=str(current_user.user_id),
    )
    return {"success": True, "ticket_no": ticket.ticket_no, "agent_user_id": agent_user_id}
