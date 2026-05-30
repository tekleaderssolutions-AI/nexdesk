import secrets
import string
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models import User, Department, Organization, Team, TeamMember, Skill, TeamMemberSkill
from app.core.security import hash_password


def generate_temporary_password(length: int = 12) -> str:
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(characters) for _ in range(length))


# ==================== ORGANIZATIONS ====================

def get_organizations(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Organization).offset(skip).limit(limit).all()


def get_organization_by_id(db: Session, org_id):
    return db.query(Organization).filter(Organization.id == org_id).first()


def create_organization(db: Session, org_name: str, domain=None, plan_type=None, is_active: bool = True):
    org = Organization(org_name=org_name, domain=domain, plan_type=plan_type, is_active=is_active)
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


def update_organization(db: Session, org_id, org_name=None, domain=None, plan_type=None, is_active=None):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise ValueError(f"Organization {org_id} not found")
    if org_name is not None:
        org.org_name = org_name
    if domain is not None:
        org.domain = domain
    if plan_type is not None:
        org.plan_type = plan_type
    if is_active is not None:
        org.is_active = is_active
    db.commit()
    db.refresh(org)
    return org


def delete_organization(db: Session, org_id):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise ValueError(f"Organization {org_id} not found")
    db.delete(org)
    db.commit()


# ==================== DEPARTMENTS ====================

def get_departments(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Department).offset(skip).limit(limit).all()


def get_department_by_id(db: Session, department_id):
    return db.query(Department).filter(Department.id == department_id).first()


def create_department(db: Session, organization_id, department_name: str):
    dept = Department(organization_id=organization_id, department_name=department_name)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


def update_department(db: Session, department_id, department_name=None, organization_id=None, is_active=None):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise ValueError(f"Department {department_id} not found")
    if department_name is not None:
        dept.department_name = department_name
    if organization_id is not None:
        dept.organization_id = organization_id
    if is_active is not None:
        dept.is_active = is_active
    db.commit()
    db.refresh(dept)
    return dept


def delete_department(db: Session, department_id):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise ValueError(f"Department {department_id} not found")
    db.delete(dept)
    db.commit()


# ==================== TEAMS ====================

def get_teams(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Team).offset(skip).limit(limit).all()


def get_team_by_id(db: Session, team_id):
    return db.query(Team).filter(Team.id == team_id).first()


def create_team(db: Session, department_id, team_name: str):
    team = Team(department_id=department_id, team_name=team_name)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


def update_team(db: Session, team_id, team_name=None, department_id=None, is_active=None):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise ValueError(f"Team {team_id} not found")
    if team_name is not None:
        team.team_name = team_name
    if department_id is not None:
        team.department_id = department_id
    if is_active is not None:
        team.is_active = is_active
    db.commit()
    db.refresh(team)
    return team


def delete_team(db: Session, team_id):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise ValueError(f"Team {team_id} not found")
    db.delete(team)
    db.commit()


# ==================== TEAM MEMBERS ====================

def get_team_members(db: Session, skip: int = 0, limit: int = 100):
    rows = (
        db.query(TeamMember, User, Team, Department)
        .join(User, TeamMember.user_id == User.user_id)
        .join(Team, TeamMember.team_id == Team.id)
        .outerjoin(Department, Team.department_id == Department.id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    result = []
    for tm, user, team, dept in rows:
        result.append({
            "id": tm.id,
            "user_id": tm.user_id,
            "team_id": tm.team_id,
            "member_role": tm.member_role,
            "full_name": user.full_name,
            "email": user.email,
            "team_name": team.team_name,
            "department_name": dept.department_name if dept else None,
        })
    return result


def get_team_member_by_id(db: Session, member_id):
    return db.query(TeamMember).filter(TeamMember.id == member_id).first()


def create_team_member(db: Session, user_id, team_id, member_role: str = "AGENT"):
    existing = db.query(TeamMember).filter(
        TeamMember.user_id == user_id,
        TeamMember.team_id == team_id,
    ).first()
    if existing:
        raise ValueError("User is already a member of this team")
    member = TeamMember(user_id=user_id, team_id=team_id, member_role=member_role.upper())
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def update_team_member_role(db: Session, member_id, member_role: str):
    member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
    if not member:
        raise ValueError(f"Team member {member_id} not found")
    member.member_role = member_role.upper()
    db.commit()
    db.refresh(member)
    return member


def delete_team_member(db: Session, member_id):
    member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
    if not member:
        raise ValueError(f"Team member {member_id} not found")
    db.delete(member)
    db.commit()


# ==================== SKILLS ====================

def get_skills(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Skill).offset(skip).limit(limit).all()


def get_skill_by_id(db: Session, skill_id):
    return db.query(Skill).filter(Skill.id == skill_id).first()


def create_skill(db: Session, skill_name: str, description=None, is_active: bool = True):
    existing = db.query(Skill).filter(Skill.skill_name == skill_name).first()
    if existing:
        raise ValueError(f"Skill '{skill_name}' already exists")
    skill = Skill(skill_name=skill_name, description=description, is_active=is_active)
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


def update_skill(db: Session, skill_id, skill_name=None, description=None, is_active=None):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        raise ValueError(f"Skill {skill_id} not found")
    if skill_name is not None:
        skill.skill_name = skill_name
    if description is not None:
        skill.description = description
    if is_active is not None:
        skill.is_active = is_active
    db.commit()
    db.refresh(skill)
    return skill


def delete_skill(db: Session, skill_id):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        raise ValueError(f"Skill {skill_id} not found")
    db.delete(skill)
    db.commit()


# ==================== TEAM MEMBER SKILLS ====================

def get_teams_with_stats(db: Session, skip: int = 0, limit: int = 100):
    from app.models.models import Ticket
    teams = db.query(Team).offset(skip).limit(limit).all()
    result = []
    for team in teams:
        member_count = db.query(TeamMember).filter(TeamMember.team_id == team.id).count()
        open_tickets = db.query(Ticket).filter(
            Ticket.assigned_team_id == team.id,
            Ticket.status.in_(["OPEN", "IN_PROGRESS", "ASSIGNED"])
        ).count()
        closed = db.query(Ticket).filter(
            Ticket.assigned_team_id == team.id,
            Ticket.status == "CLOSED",
            Ticket.closed_at.isnot(None)
        ).all()
        avg_hours = None
        sla_pct = None
        if closed:
            hours_list = [(t.closed_at - t.created_at).total_seconds() / 3600 for t in closed]
            avg_hours = round(sum(hours_list) / len(hours_list), 1)
            on_time = sum(1 for h in hours_list if h <= 8)
            sla_pct = round(on_time / len(closed) * 100)
        dept = db.query(Department).filter(Department.id == team.department_id).first() if team.department_id else None
        result.append({
            "id": team.id,
            "team_name": team.team_name,
            "department_id": team.department_id,
            "department_name": dept.department_name if dept else None,
            "is_active": team.is_active,
            "member_count": member_count,
            "open_tickets": open_tickets,
            "avg_resolution_hours": avg_hours,
            "sla_percentage": sla_pct,
        })
    return result


def get_member_skills(db: Session, member_id):
    rows = (
        db.query(TeamMemberSkill, Skill)
        .join(Skill, TeamMemberSkill.skill_id == Skill.id)
        .filter(TeamMemberSkill.team_member_id == member_id)
        .all()
    )
    return [{"id": tms.id, "skill_id": skill.id, "skill_name": skill.skill_name, "proficiency": tms.proficiency} for tms, skill in rows]


def add_skill_to_member(db: Session, member_id, skill_name: str, proficiency: str = "INTERMEDIATE"):
    skill = db.query(Skill).filter(Skill.skill_name == skill_name.strip()).first()
    if not skill:
        skill = Skill(skill_name=skill_name.strip(), is_active=True)
        db.add(skill)
        db.flush()
    existing = db.query(TeamMemberSkill).filter(
        TeamMemberSkill.team_member_id == member_id,
        TeamMemberSkill.skill_id == skill.id,
    ).first()
    if existing:
        raise ValueError("Skill already assigned to this member")
    tms = TeamMemberSkill(team_member_id=member_id, skill_id=skill.id, proficiency=proficiency.upper())
    db.add(tms)
    db.commit()
    db.refresh(tms)
    return {"id": tms.id, "skill_id": skill.id, "skill_name": skill.skill_name, "proficiency": tms.proficiency}


def get_team_member_skills(db: Session, skip: int = 0, limit: int = 100):
    rows = (
        db.query(TeamMemberSkill, Skill, User)
        .join(Skill, TeamMemberSkill.skill_id == Skill.id)
        .join(TeamMember, TeamMemberSkill.team_member_id == TeamMember.id)
        .join(User, TeamMember.user_id == User.user_id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    result = []
    for tms, skill, user in rows:
        result.append({
            "id": tms.id,
            "team_member_id": tms.team_member_id,
            "skill_id": tms.skill_id,
            "proficiency": tms.proficiency,
            "skill_name": skill.skill_name,
            "full_name": user.full_name,
        })
    return result


def get_team_member_skill_by_id(db: Session, tms_id):
    return db.query(TeamMemberSkill).filter(TeamMemberSkill.id == tms_id).first()


def create_team_member_skill(db: Session, team_member_id, skill_id, proficiency: str = "INTERMEDIATE"):
    existing = db.query(TeamMemberSkill).filter(
        TeamMemberSkill.team_member_id == team_member_id,
        TeamMemberSkill.skill_id == skill_id,
    ).first()
    if existing:
        raise ValueError("This skill is already assigned to the team member")
    tms = TeamMemberSkill(
        team_member_id=team_member_id,
        skill_id=skill_id,
        proficiency=proficiency.upper(),
    )
    db.add(tms)
    db.commit()
    db.refresh(tms)
    return tms


def update_team_member_skill(db: Session, tms_id, proficiency: str):
    tms = db.query(TeamMemberSkill).filter(TeamMemberSkill.id == tms_id).first()
    if not tms:
        raise ValueError(f"Team member skill {tms_id} not found")
    tms.proficiency = proficiency.upper()
    db.commit()
    db.refresh(tms)
    return tms


def delete_team_member_skill(db: Session, tms_id):
    tms = db.query(TeamMemberSkill).filter(TeamMemberSkill.id == tms_id).first()
    if not tms:
        raise ValueError(f"Team member skill {tms_id} not found")
    db.delete(tms)
    db.commit()


# ==================== USERS ====================

def create_user(db: Session, full_name, email, phone, department_id, organization_id, role, created_by_user_id):
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValueError(f"Email {email} already exists")
    temp_password = generate_temporary_password()
    user = User(
        full_name=full_name,
        email=email,
        password_hash=hash_password(temp_password),
        phone=phone,
        department_id=department_id,
        organization_id=organization_id,
        role=role.upper(),
        is_temp_password=True,
        is_active=True,
        created_by=created_by_user_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, temp_password


def reset_user_password(db: Session, user_id):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise ValueError(f"User {user_id} not found")
    temp_password = generate_temporary_password()
    user.password_hash = hash_password(temp_password)
    user.is_temp_password = True
    db.commit()
    db.refresh(user)
    return user, temp_password


def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(User).offset(skip).limit(limit).all()


def get_user_by_id(db: Session, user_id):
    return db.query(User).filter(User.user_id == user_id).first()


def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


def update_user(db: Session, user_id, full_name=None, phone=None, department_id=None, role=None):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise ValueError(f"User {user_id} not found")
    if full_name is not None:
        user.full_name = full_name
    if phone is not None:
        user.phone = phone
    if department_id is not None:
        user.department_id = department_id
    if role is not None:
        user.role = role.upper()
    db.commit()
    db.refresh(user)
    return user


def activate_user(db: Session, user_id):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise ValueError(f"User {user_id} not found")
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


def deactivate_user(db: Session, user_id):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise ValueError(f"User {user_id} not found")
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user
