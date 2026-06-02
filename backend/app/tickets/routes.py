from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_admin, get_current_team, get_current_user
from app.db.dependencies import get_db
from app.models import Ticket
from app.tickets import schemas, services
from app.tickets.schemas import (
    AISuggestionResponse, TicketRelationshipResponse, TicketResolutionResponse,
    ResolutionConfidenceResponse, TicketMessageCreate, TicketMessageResponse,
    ActionEngineRequest, ActionEngineResponse, ActionConfirmRequest,
    TeamAIActionRequest, AIResolutionDataResponse, ConversationCreate, ConversationResponse,
)

router = APIRouter(prefix="", tags=["Tickets"])


def assert_ticket_visible(ticket: Ticket, current_user) -> None:
    if current_user.role.upper() == "ADMIN":
        return
    if ticket.created_by == current_user.user_id:
        return
    if current_user.role.upper() == "TEAM" and ticket.assigned_team_id is not None:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ticket access denied")


@router.get("/csat", response_model=List[schemas.CSATResponse])
def get_my_csat(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return services.get_user_csat_records(db, current_user)


@router.post("/tickets/{ticket_id}/csat", response_model=schemas.CSATResponse)
def submit_csat(ticket_id: UUID, payload: schemas.CSATCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return services.submit_csat(db, str(ticket_id), current_user, payload.rating, payload.feedback_text, payload.is_resolved)


@router.post("/tickets/analyze", response_model=schemas.TicketAnalyzeResponse)
def analyze_ticket(payload: schemas.TicketAnalyzeRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return services.analyze_ticket_preview(db, payload.subject, payload.description)


@router.get("/team/members-workload", response_model=schemas.TeamMembersWorkloadResponse)
def get_team_members_workload(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return services.get_team_members_workload(db, current_user)


@router.post("/tickets/{ticket_id}/assign-to-member")
def assign_ticket_to_member(
    ticket_id: UUID,
    payload: schemas.AssignToMemberRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == str(ticket_id)).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    assert_ticket_visible(ticket, current_user)
    try:
        return services.assign_ticket_to_member(db, str(ticket_id), str(payload.agent_user_id), current_user)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/tickets", response_model=schemas.TicketResponse)
def create_ticket(payload: schemas.TicketCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    ticket = services.create_ticket(
        db=db,
        user=current_user,
        subject=payload.subject,
        description=payload.description,
        category_id=payload.category_id,
        subcategory_id=payload.subcategory_id,
        priority=payload.priority,
        source=payload.source,
        major_incident_flag=payload.major_incident_flag,
        emergency_override=payload.emergency_override,
        attachments=[attachment.dict() for attachment in payload.attachments] if payload.attachments else None,
    )
    return ticket


@router.get("/tickets", response_model=List[schemas.TicketResponse])
def list_tickets(
    ticket_no: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    created_by: Optional[UUID] = Query(None),
    department_id: Optional[UUID] = Query(None),
    assigned_team_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    category_id: Optional[UUID] = Query(None),
    scope: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tickets = services.list_tickets(
        db=db,
        current_user=current_user,
        ticket_no=ticket_no,
        subject=subject,
        created_by=str(created_by) if created_by else None,
        department_id=str(department_id) if department_id else None,
        assigned_team_id=str(assigned_team_id) if assigned_team_id else None,
        status=status,
        priority=priority,
        category_id=str(category_id) if category_id else None,
        scope=scope,
        from_date=from_date,
        to_date=to_date,
        skip=skip,
        limit=limit,
    )
    return tickets


@router.get("/tickets/search", response_model=List[schemas.TicketResponse])
def search_tickets(
    ticket_no: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    created_by: Optional[UUID] = Query(None),
    department_id: Optional[UUID] = Query(None),
    assigned_team_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    category_id: Optional[UUID] = Query(None),
    scope: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_tickets(
        ticket_no=ticket_no,
        subject=subject,
        created_by=created_by,
        department_id=department_id,
        assigned_team_id=assigned_team_id,
        status=status,
        priority=priority,
        category_id=category_id,
        scope=scope,
        from_date=from_date,
        to_date=to_date,
        skip=skip,
        limit=limit,
        current_user=current_user,
        db=db,
    )


@router.get("/tickets/{ticket_id}/sla-status")
def get_ticket_sla_status(ticket_id: UUID, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == str(ticket_id)).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    assert_ticket_visible(ticket, current_user)
    sla_map = services._get_sla_minutes_map(db)
    return services._compute_sla_status(ticket, sla_map)


@router.get("/tickets/{ticket_id}", response_model=schemas.TicketResponse)
def get_ticket(ticket_id: UUID, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    assert_ticket_visible(ticket, current_user)
    return ticket


@router.put("/tickets/{ticket_id}", response_model=schemas.TicketResponse)
def update_ticket(
    ticket_id: UUID,
    payload: schemas.TicketUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if current_user.role.upper() == "ADMIN":
        pass
    elif current_user.role.upper() == "TEAM":
        if ticket.assigned_team_id is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ticket assignment required for team updates")
    elif ticket.created_by != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ticket update denied")

    if current_user.role.upper() == "USER" and (
        payload.priority is not None
        or payload.impact is not None
        or payload.urgency is not None
        or payload.scope is not None
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Users may only update ticket subject and description")

    ticket = services.update_ticket(
        db=db,
        ticket=ticket,
        subject=payload.subject,
        description=payload.description,
        category_id=payload.category_id,
        subcategory_id=payload.subcategory_id,
        priority=payload.priority,
        impact=payload.impact,
        urgency=payload.urgency,
        scope=payload.scope,
    )
    return ticket


@router.put("/tickets/{ticket_id}/status", response_model=schemas.TicketResponse)
def change_ticket_status(
    ticket_id: UUID,
    payload: schemas.TicketStatusUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    role = current_user.role.upper()
    if role == "TEAM":
        if ticket.assigned_team_id is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ticket must be assigned before team can update status")
    elif role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only team or admin can update ticket status")

    try:
        ticket = services.update_ticket_status(db=db, ticket=ticket, status=payload.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return ticket


@router.get("/tickets/{ticket_id}/relationships", response_model=List[TicketRelationshipResponse])
def get_ticket_relationships(
    ticket_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    assert_ticket_visible(ticket, current_user)
    return services.get_ticket_relationships(db, str(ticket_id))


@router.post("/tickets/{ticket_id}/classify")
def classify_ticket(
    ticket_id: UUID,
    current_admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    from app.services.classification_service import run_classification_pipeline
    result = run_classification_pipeline(db, ticket)
    return result


@router.put("/tickets/{ticket_id}/assign", response_model=schemas.TicketResponse)
def assign_ticket(
    ticket_id: UUID,
    payload: schemas.TicketAssignRequest,
    current_admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    try:
        ticket = services.assign_ticket(
            db=db,
            ticket=ticket,
            assigned_team_id=payload.assigned_team_id,
            assigned_agent_id=payload.assigned_agent_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return ticket


@router.get("/tickets/{ticket_id}/timeline")
def get_ticket_timeline(
    ticket_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    assert_ticket_visible(ticket, current_user)
    return services.get_ticket_timeline(db, str(ticket_id))


@router.get("/dashboard/stats")
def get_dashboard_stats(
    current_admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return services.get_admin_dashboard_stats(db)


@router.get("/notifications")
def get_my_notifications(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return services.get_notifications_for_user(db, str(current_user.user_id))


@router.post("/notifications/read")
def mark_notifications_read(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    services.mark_notifications_read(db, str(current_user.user_id))
    return {"ok": True}


@router.get("/department/stats")
def get_department_stats(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return services.get_department_dashboard_stats(db, current_user)


@router.get("/departments")
def list_departments(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.models import Department
    depts = db.query(Department).filter(Department.is_active == True).order_by(Department.department_name).all()
    return [{"id": str(d.id), "name": d.department_name} for d in depts]


@router.get("/departments/{dept_id}/teams")
def list_teams_for_department(
    dept_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.models import Team
    teams = (
        db.query(Team)
        .filter(Team.department_id == dept_id, Team.is_active == True)
        .order_by(Team.team_name)
        .all()
    )
    return [{"id": str(t.id), "name": t.team_name} for t in teams]


@router.get("/tickets/{ticket_id}/ai-suggestion", response_model=AISuggestionResponse)
def get_ai_suggestion(
    ticket_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    assert_ticket_visible(ticket, current_user)

    from app.services.ai_suggestion_service import get_suggestion
    suggestion = get_suggestion(db, str(ticket_id))
    if not suggestion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No AI suggestion available yet")

    return AISuggestionResponse(
        id=suggestion.id,
        ticket_id=suggestion.ticket_id,
        problem_summary=suggestion.problem_summary,
        probable_root_cause=suggestion.probable_root_cause,
        suggested_steps=suggestion.suggested_steps_json or [],
        confidence=float(suggestion.confidence),
        recommended_escalation_team=suggestion.recommended_escalation_team,
        resolution=suggestion.resolution,
        created_at=suggestion.created_at,
    )


@router.post("/tickets/{ticket_id}/ai-suggestion/generate", response_model=dict)
def regenerate_ai_suggestion(
    ticket_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually trigger AI suggestion generation (or re-generation)."""
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    assert_ticket_visible(ticket, current_user)
    if not ticket.assigned_team_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ticket must be assigned to a team first")

    from app.services.ai_suggestion_service import trigger_async
    trigger_async(str(ticket_id))
    return {"ok": True, "message": "AI suggestion generation started"}


@router.get("/tickets/{ticket_id}/resolution-confidence", response_model=ResolutionConfidenceResponse)
def get_resolution_confidence(
    ticket_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Run the KB similarity + resolution confidence pipeline for a ticket.
    Embeds the ticket, searches KB via pgvector, scores the match, and returns
    a decision label with component scores. Results are cached in DB.
    """
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    assert_ticket_visible(ticket, current_user)

    from app.services.kb_similarity_service import run_resolution_confidence
    result = run_resolution_confidence(db, ticket)
    return result


@router.get("/tickets/{ticket_id}/resolution", response_model=TicketResolutionResponse)
def get_ticket_resolution(
    ticket_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    assert_ticket_visible(ticket, current_user)

    from app.models.models import TicketResolution
    resolution = (
        db.query(TicketResolution)
        .filter(TicketResolution.ticket_id == ticket_id)
        .first()
    )
    if not resolution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No resolution recorded")
    return resolution


# ── AI Resolution: Accept / Reject ───────────────────────────────────────────

@router.post("/tickets/{ticket_id}/accept-resolution", response_model=schemas.TicketResponse)
def accept_resolution(
    ticket_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if ticket.created_by != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only the ticket creator can accept this resolution")
    try:
        ticket = services.accept_ai_resolution(db, ticket, current_user)
    except (ValueError, PermissionError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return ticket


@router.post("/tickets/{ticket_id}/reject-resolution", response_model=schemas.TicketResponse)
def reject_resolution(
    ticket_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if ticket.created_by != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only the ticket creator can reject this resolution")
    try:
        ticket = services.reject_ai_resolution(db, ticket, current_user)
    except (ValueError, PermissionError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return ticket


# ── Ticket Messages (chat) ────────────────────────────────────────────────────

@router.get("/tickets/{ticket_id}/messages", response_model=List[TicketMessageResponse])
def get_ticket_messages(
    ticket_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    assert_ticket_visible(ticket, current_user)
    return services.get_ticket_messages(db, str(ticket_id))


@router.post("/tickets/{ticket_id}/messages", response_model=TicketMessageResponse, status_code=status.HTTP_201_CREATED)
def send_ticket_message(
    ticket_id: UUID,
    payload: TicketMessageCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    assert_ticket_visible(ticket, current_user)
    if not payload.message_body.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message body cannot be empty")
    return services.create_ticket_message(db, str(ticket_id), current_user, payload.message_body)


# ── AI Action Engine ──────────────────────────────────────────────────────────

@router.post("/tickets/{ticket_id}/discover-actions", response_model=ActionEngineResponse)
def discover_actions(
    ticket_id: UUID,
    payload: ActionEngineRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Run the AI Action Engine pipeline for a ticket.
    Discovers registered OpenAPI actions, selects the best one via LLM,
    evaluates risk, and executes automatically for LOW-risk actions.
    """
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    assert_ticket_visible(ticket, current_user)

    from app.services.action_engine_service import run_action_engine
    result = run_action_engine(
        db=db,
        ticket=ticket,
        kb_confidence=payload.kb_confidence or 0.0,
        kb_title=payload.kb_title or "",
        kb_resolution=payload.kb_resolution or "",
    )
    return result


@router.post("/tickets/{ticket_id}/confirm-action", response_model=schemas.TicketResponse)
def confirm_action(
    ticket_id: UUID,
    payload: ActionConfirmRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """User confirms whether the automated action resolved their issue."""
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if ticket.created_by != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the ticket creator can confirm action results")
    if ticket.status != "AI_ACTION_COMPLETED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ticket is not awaiting action confirmation")

    from app.services.action_engine_service import confirm_action as engine_confirm
    ticket = engine_confirm(db, ticket, current_user, payload.resolved)
    return ticket


@router.get("/tickets/{ticket_id}/action-execution")
def get_action_execution(
    ticket_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the latest action execution record for a ticket."""
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    assert_ticket_visible(ticket, current_user)

    from app.models.models import TicketActionExecution
    exe = (
        db.query(TicketActionExecution)
        .filter(TicketActionExecution.ticket_id == ticket_id)
        .order_by(TicketActionExecution.executed_at.desc())
        .first()
    )
    if not exe:
        return None
    return {
        "id": str(exe.id),
        "operation_id": exe.operation_id,
        "execution_status": exe.execution_status,
        "action_summary": exe.action_summary,
        "confidence": float(exe.confidence) if exe.confidence else None,
        "risk_level": exe.risk_level,
        "selection_reason": exe.selection_reason,
        "risk_reason": exe.risk_reason,
        "user_confirmed": exe.user_confirmed,
        "executed_at": exe.executed_at.isoformat() if exe.executed_at else None,
    }


# ── Team AI Action (Approve / Edit / Reject) ─────────────────────────────────

@router.post("/tickets/{ticket_id}/team-ai-action", response_model=schemas.TicketResponse)
def team_ai_action(
    ticket_id: UUID,
    payload: TeamAIActionRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Team approves, edits, or rejects the AI suggested resolution."""
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    role = current_user.role.upper()
    if role not in ("TEAM", "ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only team or admin can review AI suggestions")
    if ticket.status != "AI_TEAM_REVIEW":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ticket is not awaiting AI team review")

    action = (payload.action or "").upper()
    if action not in ("APPROVE", "EDIT", "REJECT"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="action must be APPROVE, EDIT, or REJECT")
    if action == "EDIT" and not (payload.edited_solution or "").strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="edited_solution is required when action=EDIT")

    return services.team_ai_action(db, ticket, action, payload.edited_solution, current_user)


@router.get("/tickets/{ticket_id}/ai-resolution", response_model=AIResolutionDataResponse)
def get_ai_resolution(
    ticket_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the AI resolution data for a ticket (solution text, confidence, approval info)."""
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    assert_ticket_visible(ticket, current_user)

    priority = (ticket.priority or "P3").upper()
    if ticket.resolution_type == "AI_AUTO_RESOLVE":
        level = "L1_AUTO"
    elif ticket.resolution_type == "AI_TEAM_REVIEW":
        level = "L2_TEAM_REVIEW"
    elif priority in ("P1", "P2"):
        level = "L3_INTERNAL"
    else:
        level = "NONE"

    return AIResolutionDataResponse(
        ticket_id=str(ticket_id),
        level=level,
        original_ai_solution=ticket.original_ai_solution,
        edited_team_solution=ticket.edited_team_solution,
        approved_by=ticket.ai_solution_approved_by,
        approved_at=ticket.ai_solution_approved_at,
        resolution_type=ticket.resolution_type,
        final_confidence=float(ticket.final_resolution_confidence) if ticket.final_resolution_confidence else None,
        status=ticket.status,
    )


# ── Conversations (P1/P2 structured thread) ───────────────────────────────────

@router.get("/tickets/{ticket_id}/conversations", response_model=List[ConversationResponse])
def get_conversations(
    ticket_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    assert_ticket_visible(ticket, current_user)

    role = current_user.role.upper()
    include_internal = role in ("TEAM", "ADMIN")
    return services.get_ticket_conversations(db, str(ticket_id), include_internal=include_internal)


@router.post("/tickets/{ticket_id}/conversations", response_model=ConversationResponse,
             status_code=status.HTTP_201_CREATED)
def send_conversation_message(
    ticket_id: UUID,
    payload: ConversationCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = services.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    assert_ticket_visible(ticket, current_user)
    if not payload.message.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message cannot be empty")
    return services.create_conversation_message(
        db, str(ticket_id), current_user, payload.message, payload.attachment_url
    )


# ── Knowledge Base ─────────────────────────────────────────────────────────────

@router.get("/knowledge-base", response_model=List[schemas.KBArticleResponse])
def list_kb_articles(
    category: Optional[str] = Query(None),
    team: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.models import KnowledgeBase
    q = db.query(KnowledgeBase).filter(KnowledgeBase.is_published == True)
    if category:
        q = q.filter(KnowledgeBase.category == category)
    if team:
        q = q.filter(KnowledgeBase.assigned_team == team)
    if priority:
        q = q.filter(KnowledgeBase.priority == priority)
    if search:
        like = f"%{search}%"
        from sqlalchemy import or_
        q = q.filter(
            or_(
                KnowledgeBase.title.ilike(like),
                KnowledgeBase.description.ilike(like),
                KnowledgeBase.resolution.ilike(like),
            )
        )
    return q.order_by(KnowledgeBase.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/knowledge-base/meta")
def kb_meta(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.models import KnowledgeBase
    from sqlalchemy import func as sqlfunc
    rows = db.query(KnowledgeBase.category, sqlfunc.count(KnowledgeBase.id)).group_by(KnowledgeBase.category).all()
    categories = [{"name": r[0], "count": r[1]} for r in rows if r[0]]
    teams_rows = db.query(KnowledgeBase.assigned_team, sqlfunc.count(KnowledgeBase.id)).group_by(KnowledgeBase.assigned_team).all()
    teams = [{"name": r[0], "count": r[1]} for r in teams_rows if r[0]]
    return {"categories": categories, "teams": teams}


@router.get("/knowledge-base/{kb_id}", response_model=schemas.KBArticleResponse)
def get_kb_article(
    kb_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.models import KnowledgeBase
    article = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return article
