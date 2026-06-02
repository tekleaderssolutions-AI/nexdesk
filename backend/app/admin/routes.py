from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional

from pydantic import BaseModel

from app.db.dependencies import get_db
from app.auth.dependencies import get_current_admin
from app.models import User
from app.admin import schemas, services

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Tool Registry Pydantic Schemas (inline — no separate file needed) ──────────

class ToolOperationParam(BaseModel):
    name: str
    description: Optional[str] = ""
    # in: path | query | body
    location: str = "body"
    required: bool = False
    # source: ticket_id | ticket_creator_email | ticket_creator_name | organization_id | static:<val> | llm_extract
    source: str = "llm_extract"


class ToolOperationCreate(BaseModel):
    operation_id: str
    http_method: str
    path: str
    summary: Optional[str] = ""
    description: Optional[str] = ""
    risk_level: str = "MEDIUM"
    parameters: Optional[List[dict]] = []
    side_effects: Optional[List[str]] = []


class ToolRegistrationCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    base_url: str
    auth_type: str = "none"        # none | bearer | api_key | basic
    auth_config: Optional[dict] = None
    operations: Optional[List[ToolOperationCreate]] = []


class ToolRegistrationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    base_url: Optional[str] = None
    auth_type: Optional[str] = None
    auth_config: Optional[dict] = None
    is_active: Optional[bool] = None


# ==================== ORGANIZATIONS ====================

@router.get("/organizations", response_model=List[schemas.OrganizationResponse])
def list_organizations(
    skip: int = 0,
    limit: int = 100,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.get_organizations(db, skip=skip, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/organizations/{org_id}", response_model=schemas.OrganizationResponse)
def get_organization(
    org_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    org = services.get_organization_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.post("/organizations", response_model=schemas.OrganizationResponse, status_code=201)
def create_organization(
    payload: schemas.OrganizationCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.create_organization(
            db, org_name=payload.org_name, domain=payload.domain,
            plan_type=payload.plan_type, is_active=payload.is_active,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/organizations/{org_id}", response_model=schemas.OrganizationResponse)
def update_organization(
    org_id: UUID,
    payload: schemas.OrganizationUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.update_organization(
            db, org_id, org_name=payload.org_name, domain=payload.domain,
            plan_type=payload.plan_type, is_active=payload.is_active,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/organizations/{org_id}", status_code=204)
def delete_organization(
    org_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        services.delete_organization(db, org_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== DEPARTMENTS ====================

@router.get("/departments", response_model=List[schemas.DepartmentResponse])
def list_departments(
    skip: int = 0,
    limit: int = 100,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.get_departments(db, skip=skip, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/departments/{department_id}", response_model=schemas.DepartmentResponse)
def get_department(
    department_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    dept = services.get_department_by_id(db, department_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return dept


@router.post("/departments", response_model=schemas.DepartmentResponse, status_code=201)
def create_department(
    payload: schemas.DepartmentCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.create_department(
            db, organization_id=payload.organization_id,
            department_name=payload.department_name,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/departments/{department_id}", response_model=schemas.DepartmentResponse)
def update_department(
    department_id: UUID,
    payload: schemas.DepartmentUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.update_department(
            db, department_id, department_name=payload.department_name,
            organization_id=payload.organization_id, is_active=payload.is_active,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/departments/{department_id}", status_code=204)
def delete_department(
    department_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        services.delete_department(db, department_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== TEAMS ====================

@router.get("/teams", response_model=List[schemas.TeamResponse])
def list_teams(
    skip: int = 0,
    limit: int = 100,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.get_teams(db, skip=skip, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/teams/stats", response_model=List[schemas.TeamStatsResponse])
def list_teams_with_stats(
    skip: int = 0,
    limit: int = 100,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.get_teams_with_stats(db, skip=skip, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/teams/{team_id}", response_model=schemas.TeamResponse)
def get_team(
    team_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    team = services.get_team_by_id(db, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@router.post("/teams", response_model=schemas.TeamResponse, status_code=201)
def create_team(
    payload: schemas.TeamCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.create_team(
            db, department_id=payload.department_id, team_name=payload.team_name,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/teams/{team_id}", response_model=schemas.TeamResponse)
def update_team(
    team_id: UUID,
    payload: schemas.TeamUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.update_team(
            db, team_id, team_name=payload.team_name,
            department_id=payload.department_id, is_active=payload.is_active,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/teams/{team_id}", status_code=204)
def delete_team(
    team_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        services.delete_team(db, team_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== TEAM MEMBERS ====================

@router.get("/team-members", response_model=List[schemas.TeamMemberDetailResponse])
def list_team_members(
    skip: int = 0,
    limit: int = 100,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.get_team_members(db, skip=skip, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/team-members", response_model=schemas.TeamMemberResponse, status_code=201)
def create_team_member(
    payload: schemas.TeamMemberCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.create_team_member(
            db, user_id=payload.user_id, team_id=payload.team_id,
            member_role=payload.member_role,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/team-members/{member_id}", response_model=schemas.TeamMemberResponse)
def update_team_member(
    member_id: UUID,
    payload: schemas.TeamMemberUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.update_team_member_role(db, member_id, member_role=payload.member_role)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/team-members/{member_id}/skills", response_model=List[schemas.MemberSkillItem])
def get_member_skills(
    member_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.get_member_skills(db, member_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/team-members/{member_id}/skills", response_model=schemas.MemberSkillItem, status_code=201)
def add_member_skill(
    member_id: UUID,
    payload: schemas.MemberSkillAdd,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.add_skill_to_member(db, member_id, payload.skill_name, payload.proficiency)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/team-members/{member_id}", status_code=204)
def delete_team_member(
    member_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        services.delete_team_member(db, member_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== KB EMBEDDINGS ====================

@router.post("/kb-embeddings/generate")
def generate_kb_embeddings(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Batch-generate MiniLM embeddings for all published KB articles that
    don't yet have a vector stored. Safe to call repeatedly (idempotent).
    """
    try:
        from app.services.kb_embedding_service import embed_all_kb_articles
        result = embed_all_kb_articles(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/backfill-auto-resolve")
def backfill_auto_resolve(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Run the AI resolution confidence pipeline on all OPEN/IN_PROGRESS P3/P4/P5
    tickets. Tickets scoring >= 90 are moved to AI_RESOLVED_PENDING_USER_CONFIRMATION.
    P1/P2 tickets are never touched.
    """
    try:
        from app.services.kb_similarity_service import run_auto_resolve_backfill
        return run_auto_resolve_backfill(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== SKILLS ====================

@router.get("/skills", response_model=List[schemas.SkillResponse])
def list_skills(
    skip: int = 0,
    limit: int = 100,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.get_skills(db, skip=skip, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/skills/{skill_id}", response_model=schemas.SkillResponse)
def get_skill(
    skill_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    skill = services.get_skill_by_id(db, skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.post("/skills", response_model=schemas.SkillResponse, status_code=201)
def create_skill(
    payload: schemas.SkillCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.create_skill(
            db, skill_name=payload.skill_name, description=payload.description,
            is_active=payload.is_active,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/skills/{skill_id}", response_model=schemas.SkillResponse)
def update_skill(
    skill_id: UUID,
    payload: schemas.SkillUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.update_skill(
            db, skill_id, skill_name=payload.skill_name,
            description=payload.description, is_active=payload.is_active,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/skills/{skill_id}", status_code=204)
def delete_skill(
    skill_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        services.delete_skill(db, skill_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== TEAM MEMBER SKILLS ====================

@router.get("/team-member-skills", response_model=List[schemas.TeamMemberSkillDetailResponse])
def list_team_member_skills(
    skip: int = 0,
    limit: int = 100,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.get_team_member_skills(db, skip=skip, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/team-member-skills", response_model=schemas.TeamMemberSkillResponse, status_code=201)
def create_team_member_skill(
    payload: schemas.TeamMemberSkillCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.create_team_member_skill(
            db, team_member_id=payload.team_member_id,
            skill_id=payload.skill_id, proficiency=payload.proficiency,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/team-member-skills/{tms_id}", response_model=schemas.TeamMemberSkillResponse)
def update_team_member_skill(
    tms_id: UUID,
    payload: schemas.TeamMemberSkillUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.update_team_member_skill(db, tms_id, proficiency=payload.proficiency)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/team-member-skills/{tms_id}", status_code=204)
def delete_team_member_skill(
    tms_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        services.delete_team_member_skill(db, tms_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== SLA RULES ====================

@router.get("/sla-rules", response_model=List[schemas.SLARuleResponse])
def list_sla_rules(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.get_sla_rules(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/sla-rules/{rule_id}", response_model=schemas.SLARuleResponse)
def update_sla_rule(
    rule_id: UUID,
    payload: schemas.SLARuleUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.update_sla_rule(
            db, rule_id,
            first_response_minutes=payload.first_response_minutes,
            resolution_minutes=payload.resolution_minutes,
            is_active=payload.is_active,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== USERS ====================

@router.get("/users", response_model=List[schemas.UserResponse])
def list_users(
    skip: int = 0,
    limit: int = 100,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.get_users(db, skip=skip, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}", response_model=schemas.UserResponse)
def get_user(
    user_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = services.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/users", response_model=schemas.UserResponse)
def create_user(
    payload: schemas.UserCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        user, _ = services.create_user(
            db=db, full_name=payload.full_name, email=payload.email,
            phone=payload.phone, department_id=payload.department_id,
            organization_id=payload.organization_id, role=payload.role,
            created_by_user_id=current_admin.user_id,
        )
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/users/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: UUID,
    payload: schemas.UserUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.update_user(
            db=db, user_id=user_id, full_name=payload.full_name,
            phone=payload.phone, department_id=payload.department_id, role=payload.role,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/users/{user_id}/activate", response_model=schemas.UserResponse)
def activate_user(
    user_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.activate_user(db, user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/users/{user_id}/deactivate", response_model=schemas.UserResponse)
def deactivate_user(
    user_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return services.deactivate_user(db, user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/users/{user_id}/reset-password", response_model=schemas.PasswordResetResponse)
def reset_password(
    user_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        user, temp_password = services.reset_user_password(db, user_id)
        return schemas.PasswordResetResponse(
            user_id=user.user_id,
            temporary_password=temp_password,
            message=f"Password reset for {user.email}. User must change password on next login.",
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Tool Registry ──────────────────────────────────────────────────────────────

@router.post("/tools", status_code=201)
def create_tool(
    payload: ToolRegistrationCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Register a new external API tool with its operations."""
    from app.models.models import ToolRegistration, ToolCatalogOperation
    tool = ToolRegistration(
        name=payload.name,
        description=payload.description,
        base_url=payload.base_url.rstrip("/"),
        auth_type=payload.auth_type,
        auth_config=payload.auth_config,
        is_active=True,
    )
    db.add(tool)
    db.flush()

    for op_data in (payload.operations or []):
        params = []
        for p in (op_data.parameters or []):
            entry = dict(p)
            if "location" in entry and "in" not in entry:
                entry["in"] = entry.pop("location")
            params.append(entry)
        op = ToolCatalogOperation(
            tool_id=tool.id,
            operation_id=op_data.operation_id,
            http_method=op_data.http_method.upper(),
            path=op_data.path,
            summary=op_data.summary,
            description=op_data.description,
            risk_level=(op_data.risk_level or "MEDIUM").upper(),
            parameters=params,
            side_effects=op_data.side_effects or [],
            is_active=True,
        )
        db.add(op)

    db.commit()
    db.refresh(tool)
    return {"id": str(tool.id), "name": tool.name, "base_url": tool.base_url, "is_active": tool.is_active}


@router.get("/tools")
def list_tools(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    from app.models.models import ToolRegistration, ToolCatalogOperation
    tools = db.query(ToolRegistration).order_by(ToolRegistration.is_active.desc()).all()
    result = []
    for t in tools:
        op_count = db.query(ToolCatalogOperation).filter(
            ToolCatalogOperation.tool_id == t.id, ToolCatalogOperation.is_active == True
        ).count()
        result.append({
            "id": str(t.id),
            "name": t.name,
            "description": t.description,
            "base_url": t.base_url,
            "auth_type": t.auth_type,
            "is_active": t.is_active,
            "operation_count": op_count,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })
    return result


@router.get("/tools/catalog/active")
def get_active_catalog(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Return the full active tool catalog — same view the LLM receives."""
    from app.services.action_engine_service import get_tool_catalog
    return get_tool_catalog(db)


@router.get("/tools/{tool_id}")
def get_tool(
    tool_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    from app.models.models import ToolRegistration, ToolCatalogOperation
    tool = db.query(ToolRegistration).filter(ToolRegistration.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    ops = db.query(ToolCatalogOperation).filter(ToolCatalogOperation.tool_id == tool_id).all()
    return {
        "id": str(tool.id),
        "name": tool.name,
        "description": tool.description,
        "base_url": tool.base_url,
        "auth_type": tool.auth_type,
        "is_active": tool.is_active,
        "operations": [
            {
                "id": str(op.id),
                "operation_id": op.operation_id,
                "http_method": op.http_method,
                "path": op.path,
                "summary": op.summary,
                "description": op.description,
                "risk_level": op.risk_level,
                "parameters": op.parameters or [],
                "side_effects": op.side_effects or [],
                "is_active": op.is_active,
            }
            for op in ops
        ],
    }


@router.put("/tools/{tool_id}")
def update_tool(
    tool_id: UUID,
    payload: ToolRegistrationUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    from app.models.models import ToolRegistration
    tool = db.query(ToolRegistration).filter(ToolRegistration.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    if payload.name is not None:
        tool.name = payload.name
    if payload.description is not None:
        tool.description = payload.description
    if payload.base_url is not None:
        tool.base_url = payload.base_url.rstrip("/")
    if payload.auth_type is not None:
        tool.auth_type = payload.auth_type
    if payload.auth_config is not None:
        tool.auth_config = payload.auth_config
    if payload.is_active is not None:
        tool.is_active = payload.is_active
    db.add(tool)
    db.commit()
    return {"id": str(tool.id), "name": tool.name, "is_active": tool.is_active}


@router.post("/tools/{tool_id}/operations", status_code=201)
def add_operation(
    tool_id: UUID,
    payload: ToolOperationCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    from app.models.models import ToolRegistration, ToolCatalogOperation
    tool = db.query(ToolRegistration).filter(ToolRegistration.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    existing = db.query(ToolCatalogOperation).filter(
        ToolCatalogOperation.operation_id == payload.operation_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"operationId {payload.operation_id!r} already registered")
    params = []
    for p in (payload.parameters or []):
        entry = dict(p)
        if "location" in entry and "in" not in entry:
            entry["in"] = entry.pop("location")
        params.append(entry)
    op = ToolCatalogOperation(
        tool_id=tool_id,
        operation_id=payload.operation_id,
        http_method=payload.http_method.upper(),
        path=payload.path,
        summary=payload.summary,
        description=payload.description,
        risk_level=(payload.risk_level or "MEDIUM").upper(),
        parameters=params,
        side_effects=payload.side_effects or [],
        is_active=True,
    )
    db.add(op)
    db.commit()
    db.refresh(op)
    return {"id": str(op.id), "operation_id": op.operation_id, "risk_level": op.risk_level}


@router.put("/tools/{tool_id}/operations/{op_id}")
def update_operation(
    tool_id: UUID,
    op_id: UUID,
    payload: ToolOperationCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    from app.models.models import ToolCatalogOperation
    op = db.query(ToolCatalogOperation).filter(
        ToolCatalogOperation.id == op_id, ToolCatalogOperation.tool_id == tool_id
    ).first()
    if not op:
        raise HTTPException(status_code=404, detail="Operation not found")
    op.operation_id = payload.operation_id
    op.http_method  = payload.http_method.upper()
    op.path         = payload.path
    op.summary      = payload.summary
    op.description  = payload.description
    op.risk_level   = (payload.risk_level or "MEDIUM").upper()
    op.side_effects = payload.side_effects or []
    params = []
    for p in (payload.parameters or []):
        entry = dict(p)
        if "location" in entry and "in" not in entry:
            entry["in"] = entry.pop("location")
        params.append(entry)
    op.parameters = params
    db.add(op)
    db.commit()
    return {"id": str(op.id), "operation_id": op.operation_id}


@router.delete("/tools/{tool_id}/operations/{op_id}", status_code=204)
def delete_operation(
    tool_id: UUID,
    op_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    from app.models.models import ToolCatalogOperation
    op = db.query(ToolCatalogOperation).filter(
        ToolCatalogOperation.id == op_id, ToolCatalogOperation.tool_id == tool_id
    ).first()
    if not op:
        raise HTTPException(status_code=404, detail="Operation not found")
    op.is_active = False
    db.add(op)
    db.commit()


@router.delete("/tools/{tool_id}", status_code=204)
def deactivate_tool(
    tool_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    from app.models.models import ToolRegistration
    tool = db.query(ToolRegistration).filter(ToolRegistration.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    tool.is_active = False
    db.add(tool)
    db.commit()


# ==================== ANALYTICS & CSAT ==================

@router.get("/csat-analytics")
def admin_csat_analytics(
    days: int = 30,
    team_id: Optional[str] = None,
    rating: Optional[int] = None,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return services.get_admin_csat_analytics(db, days=days, team_id=team_id, rating=rating)


@router.get("/analytics")
def admin_analytics(
    dept_id: Optional[str] = None,
    team_id: Optional[str] = None,
    member_id: Optional[str] = None,
    days: int = 90,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return services.get_admin_analytics(db, dept_id=dept_id, team_id=team_id, member_id=member_id, days=days)


@router.get("/structure")
def admin_org_structure(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return services.get_org_structure(db)
