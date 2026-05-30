from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from app.db.dependencies import get_db
from app.auth.dependencies import get_current_admin
from app.models import User
from app.admin import schemas, services

router = APIRouter(prefix="/admin", tags=["Admin"])


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
