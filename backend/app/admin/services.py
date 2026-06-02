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
            from app.models.models import SLARule, PriorityMaster
            sla_rows = (
                db.query(SLARule, PriorityMaster)
                .join(PriorityMaster, SLARule.priority_id == PriorityMaster.id)
                .filter(SLARule.is_active == True)
                .all()
            )
            sla_res_map = {pm.priority_code: rule.resolution_minutes / 60 for rule, pm in sla_rows} if sla_rows else {}
            hours_list = [(t.closed_at - t.created_at).total_seconds() / 3600 for t in closed]
            avg_hours = round(sum(hours_list) / len(hours_list), 1)
            on_time = sum(
                1 for t, h in zip(closed, hours_list)
                if h <= sla_res_map.get(t.priority or "P3", 8)
            )
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


# ==================== SLA RULES ====================

def get_sla_rules(db: Session):
    from app.models.models import SLARule, PriorityMaster
    rows = (
        db.query(SLARule, PriorityMaster)
        .join(PriorityMaster, SLARule.priority_id == PriorityMaster.id)
        .order_by(PriorityMaster.priority_code)
        .all()
    )
    return [
        {
            "id": rule.id,
            "priority_id": rule.priority_id,
            "priority_code": pm.priority_code,
            "priority_name": pm.priority_name,
            "first_response_minutes": rule.first_response_minutes,
            "resolution_minutes": rule.resolution_minutes,
            "is_active": rule.is_active,
            "created_at": rule.created_at,
        }
        for rule, pm in rows
    ]


def get_admin_csat_analytics(db: Session, days: int = 30, team_id: str = None, rating: int = None) -> dict:
    import datetime
    from app.models.models import CSATFeedback, Ticket, Team, Department, Category, Subcategory
    from sqlalchemy import func as sf

    now = datetime.datetime.utcnow()
    cutoff = now - datetime.timedelta(days=days)

    q = db.query(CSATFeedback).filter(CSATFeedback.created_at >= cutoff)
    if rating:
        q = q.filter(CSATFeedback.rating == rating)
    all_feedback = q.all()

    # Resolve ticket → team → dept
    ticket_ids = [f.ticket_id for f in all_feedback]
    tickets_map: dict = {}
    team_dept_map: dict = {}
    if ticket_ids:
        tix = db.query(Ticket).filter(Ticket.id.in_(ticket_ids)).all()
        tickets_map = {str(t.id): t for t in tix}
        team_ids = list({str(t.assigned_team_id) for t in tix if t.assigned_team_id})
        if team_ids:
            teams = db.query(Team).filter(Team.id.in_(team_ids)).all()
            for t in teams:
                team_dept_map[str(t.id)] = {"team_name": t.team_name, "dept_id": str(t.department_id) if t.department_id else None}
            dept_ids = list({v["dept_id"] for v in team_dept_map.values() if v["dept_id"]})
            if dept_ids:
                depts = db.query(Department).filter(Department.id.in_(dept_ids)).all()
                dept_name_map = {str(d.id): d.department_name for d in depts}
                for v in team_dept_map.values():
                    v["dept_name"] = dept_name_map.get(v["dept_id"], "Unknown")

    if team_id:
        filtered = [f for f in all_feedback if
                    str(tickets_map.get(str(f.ticket_id), object()).assigned_team_id or "") == team_id]
        all_feedback = filtered

    # Aggregate
    total = len(all_feedback)
    if total == 0:
        return {
            "avg_csat": 0, "total_rated": 0, "satisfaction_rate": 0,
            "reopen_rate": 0, "low_satisfaction_count": 0,
            "monthly_trend": [], "dept_csat": [], "alerts": [],
            "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
        }

    avg_csat = round(sum(f.rating for f in all_feedback) / total, 1)
    satisfaction_count = sum(1 for f in all_feedback if f.rating >= 4)
    satisfaction_rate = round(satisfaction_count / total * 100, 1)
    low_satisfaction_count = sum(1 for f in all_feedback if f.rating <= 2)

    # Reopen rate: reopened tickets among all resolved tickets in period
    resolved_count = db.query(Ticket).filter(
        Ticket.status.in_(["RESOLVED", "CLOSED"]),
        Ticket.updated_at >= cutoff,
    ).count()
    reopened_count = db.query(Ticket).filter(
        Ticket.status == "REOPENED",
        Ticket.updated_at >= cutoff,
    ).count()
    reopen_rate = round(reopened_count / max(resolved_count, 1) * 100, 1)

    # Rating distribution
    rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for f in all_feedback:
        rating_distribution[f.rating] = rating_distribution.get(f.rating, 0) + 1

    # Monthly trend (last 6 months)
    monthly: dict = {}
    for f in all_feedback:
        if f.created_at:
            key = f.created_at.strftime("%b %Y")
            if key not in monthly:
                monthly[key] = {"sum": 0, "count": 0, "month_dt": f.created_at.replace(day=1, hour=0, minute=0, second=0)}
            monthly[key]["sum"] += f.rating
            monthly[key]["count"] += 1
    monthly_trend = sorted(
        [{"month": k, "avg": round(v["sum"] / v["count"], 1), "count": v["count"]}
         for k, v in monthly.items()],
        key=lambda x: x["month"],
    )[-6:]

    # Dept/team CSAT breakdown
    dept_buckets: dict = {}
    for f in all_feedback:
        t = tickets_map.get(str(f.ticket_id))
        if not t or not t.assigned_team_id:
            continue
        tid = str(t.assigned_team_id)
        tm = team_dept_map.get(tid, {})
        dept_name = tm.get("dept_name", "Unknown")
        if dept_name not in dept_buckets:
            dept_buckets[dept_name] = {"sum": 0, "count": 0, "reopened": 0}
        dept_buckets[dept_name]["sum"] += f.rating
        dept_buckets[dept_name]["count"] += 1

    dept_csat = sorted([
        {"dept_name": k, "avg": round(v["sum"] / v["count"], 1), "count": v["count"]}
        for k, v in dept_buckets.items()
    ], key=lambda x: x["avg"])

    # Alerts: teams / issues with low scores
    alerts = []
    for dc in dept_csat:
        if dc["avg"] <= 3.0:
            alerts.append({
                "severity": "critical" if dc["avg"] <= 2.5 else "high",
                "title": f"{dc['dept_name']} — Repeated Low Ratings",
                "description": f"{dc['count']} tickets rated avg {dc['avg']}. Below acceptable threshold.",
                "action": "view",
            })
    if reopen_rate >= 8:
        alerts.append({
            "severity": "high",
            "title": "High Reopen Rate Detected",
            "description": f"Reopen rate at {reopen_rate}%, above 8% threshold.",
            "action": "review",
        })
    low_tickets = [f for f in all_feedback if f.rating <= 2 and not (getattr(tickets_map.get(str(f.ticket_id)), 'closed_by_user', False))]
    if low_tickets:
        nos = ", ".join(
            tickets_map[str(f.ticket_id)].ticket_no
            for f in low_tickets[:3]
            if str(f.ticket_id) in tickets_map
        )
        if nos:
            alerts.append({
                "severity": "medium",
                "title": f"{nos} — Marked Low Satisfaction",
                "description": f"{len(low_tickets)} tickets rated 1–2 stars. Pending re-review.",
                "action": "review",
            })

    return {
        "avg_csat": avg_csat,
        "total_rated": total,
        "satisfaction_rate": satisfaction_rate,
        "reopen_rate": reopen_rate,
        "low_satisfaction_count": low_satisfaction_count,
        "monthly_trend": monthly_trend,
        "dept_csat": dept_csat,
        "alerts": alerts,
        "rating_distribution": rating_distribution,
    }


def get_admin_analytics(db: Session, dept_id: str = None, team_id: str = None, member_id: str = None, days: int = 90) -> dict:
    import datetime
    from app.models.models import CSATFeedback, Ticket, Team, Department, Category, Subcategory
    from sqlalchemy import func as sf
    from app.models import User

    now = datetime.datetime.utcnow()
    cutoff = now - datetime.timedelta(days=days)

    # Base ticket query (filter by time window)
    q = db.query(Ticket).filter(Ticket.created_at >= cutoff)

    # Resolve filter scope
    if member_id:
        q = q.filter(Ticket.assigned_agent_id == member_id)
    elif team_id:
        q = q.filter(Ticket.assigned_team_id == team_id)
    elif dept_id:
        # get all team_ids in dept
        dept_teams = db.query(Team).filter(Team.department_id == dept_id).all()
        if dept_teams:
            tids = [t.id for t in dept_teams]
            q = q.filter(Ticket.assigned_team_id.in_(tids))
        else:
            q = q.filter(False)

    tickets = q.all()
    total = len(tickets)
    if total == 0:
        return {
            "total_tickets": 0,
            "category_breakdown": [],
            "subcategory_breakdown": [],
            "priority_breakdown": [],
            "status_breakdown": [],
            "csat": {"avg": 0, "satisfaction_rate": 0, "low_count": 0, "distribution": {}},
            "time_to_resolve": {"overall_avg_h": 0, "by_priority": {}},
            "user_stats": [],
        }

    # Category breakdown
    cat_counts: dict = {}
    subcat_counts: dict = {}
    priority_counts: dict = {}
    status_counts: dict = {}
    resolve_times: dict = {}  # priority → list of hours
    creator_stats: dict = {}  # user_id → {tickets, reopened}

    for t in tickets:
        if t.category_id:
            cat_counts[str(t.category_id)] = cat_counts.get(str(t.category_id), 0) + 1
        if t.subcategory_id:
            subcat_counts[str(t.subcategory_id)] = subcat_counts.get(str(t.subcategory_id), 0) + 1
        priority_counts[t.priority] = priority_counts.get(t.priority, 0) + 1
        status_counts[t.status or "OPEN"] = status_counts.get(t.status or "OPEN", 0) + 1
        if t.status in ("RESOLVED", "CLOSED") and t.created_at and t.updated_at:
            h = (t.updated_at - t.created_at).total_seconds() / 3600
            if 0 < h < 720:
                resolve_times.setdefault(t.priority, []).append(h)
        if t.created_by:
            uid = str(t.created_by)
            if uid not in creator_stats:
                creator_stats[uid] = {"tickets": 0, "reopened": 0}
            creator_stats[uid]["tickets"] += 1
            if t.status == "REOPENED":
                creator_stats[uid]["reopened"] += 1

    # Resolve names
    cat_name_map = {}
    if cat_counts:
        cats = db.query(Category).filter(Category.id.in_(list(cat_counts.keys()))).all()
        cat_name_map = {str(c.id): c.category_name for c in cats}
    category_breakdown = sorted(
        [{"category": cat_name_map.get(cid, cid), "count": cnt, "pct": round(cnt / total * 100, 1)}
         for cid, cnt in cat_counts.items()],
        key=lambda x: -x["count"],
    )

    subcat_name_map = {}
    if subcat_counts:
        subcats = db.query(Subcategory).filter(Subcategory.id.in_(list(subcat_counts.keys()))).all()
        subcat_name_map = {str(s.id): s.subcategory_name for s in subcats}
    subcategory_breakdown = sorted(
        [{"subcategory": subcat_name_map.get(sid, sid), "count": cnt, "pct": round(cnt / total * 100, 1)}
         for sid, cnt in subcat_counts.items()],
        key=lambda x: -x["count"],
    )[:8]

    priority_breakdown = [
        {"priority": p, "count": c, "pct": round(c / total * 100, 1)}
        for p, c in sorted(priority_counts.items())
    ]
    status_breakdown = [
        {"status": s, "count": c, "pct": round(c / total * 100, 1)}
        for s, c in sorted(status_counts.items(), key=lambda x: -x[1])
    ]

    # Time to resolve
    by_priority = {p: round(sum(v) / len(v), 1) for p, v in resolve_times.items() if v}
    all_times = [h for v in resolve_times.values() for h in v]
    overall_avg = round(sum(all_times) / len(all_times), 1) if all_times else 0

    # CSAT for these tickets
    ticket_ids = [t.id for t in tickets]
    csat_feedback = db.query(CSATFeedback).filter(CSATFeedback.ticket_id.in_(ticket_ids)).all() if ticket_ids else []
    csat_total = len(csat_feedback)
    csat_dist = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for f in csat_feedback:
        csat_dist[f.rating] = csat_dist.get(f.rating, 0) + 1
    csat_avg = round(sum(f.rating for f in csat_feedback) / csat_total, 1) if csat_total else 0
    csat_sat_rate = round(sum(1 for f in csat_feedback if f.rating >= 4) / max(csat_total, 1) * 100, 1)
    csat_low = sum(1 for f in csat_feedback if f.rating <= 2)

    # User stats
    user_stats = []
    if creator_stats:
        users = db.query(User).filter(User.user_id.in_(list(creator_stats.keys()))).all()
        user_map = {str(u.user_id): u.full_name for u in users}
        user_csat: dict = {}
        for f in csat_feedback:
            t_obj = next((t for t in tickets if t.id == f.ticket_id), None)
            if t_obj and t_obj.created_by:
                uid = str(t_obj.created_by)
                user_csat.setdefault(uid, []).append(f.rating)
        for uid, stats in sorted(creator_stats.items(), key=lambda x: -x[1]["tickets"])[:10]:
            ratings = user_csat.get(uid, [])
            user_stats.append({
                "user_id": uid,
                "name": user_map.get(uid, uid),
                "tickets": stats["tickets"],
                "reopened": stats["reopened"],
                "avg_csat": round(sum(ratings) / len(ratings), 1) if ratings else None,
            })

    resolved_count = sum(1 for t in tickets if t.status in ("RESOLVED", "CLOSED"))
    resolved_pct = round(resolved_count / total * 100, 1) if total else 0

    return {
        "total_tickets": total,
        "resolved_pct": resolved_pct,
        "category_breakdown": category_breakdown,
        "subcategory_breakdown": subcategory_breakdown,
        "priority_breakdown": priority_breakdown,
        "status_breakdown": status_breakdown,
        "csat": {
            "avg": csat_avg,
            "total": csat_total,
            "satisfaction_rate": csat_sat_rate,
            "low_count": csat_low,
            "distribution": csat_dist,
        },
        "time_to_resolve": {"overall_avg_h": overall_avg, "by_priority": by_priority},
        "user_stats": user_stats,
    }


def get_org_structure(db: Session) -> dict:
    departments = db.query(Department).filter(Department.is_active == True).order_by(Department.department_name).all()
    result = []
    for dept in departments:
        teams = db.query(Team).filter(Team.department_id == dept.id, Team.is_active == True).order_by(Team.team_name).all()
        teams_list = []
        for team in teams:
            from app.models import TeamMember, User
            members_q = (
                db.query(TeamMember, User)
                .join(User, TeamMember.user_id == User.user_id)
                .filter(TeamMember.team_id == team.id)
                .all()
            )
            members = [{"user_id": str(u.user_id), "full_name": u.full_name, "member_role": tm.member_role} for tm, u in members_q]
            teams_list.append({"id": str(team.id), "name": team.team_name, "members": members})
        result.append({"id": str(dept.id), "name": dept.department_name, "teams": teams_list})
    return {"departments": result}


def update_sla_rule(db: Session, rule_id, first_response_minutes=None, resolution_minutes=None, is_active=None):
    from app.models.models import SLARule, PriorityMaster
    rule = db.query(SLARule).filter(SLARule.id == rule_id).first()
    if not rule:
        raise ValueError(f"SLA rule {rule_id} not found")
    if first_response_minutes is not None:
        rule.first_response_minutes = first_response_minutes
    if resolution_minutes is not None:
        rule.resolution_minutes = resolution_minutes
    if is_active is not None:
        rule.is_active = is_active
    db.commit()
    db.refresh(rule)
    pm = db.query(PriorityMaster).filter(PriorityMaster.id == rule.priority_id).first()
    return {
        "id": rule.id,
        "priority_id": rule.priority_id,
        "priority_code": pm.priority_code if pm else "",
        "priority_name": pm.priority_name if pm else "",
        "first_response_minutes": rule.first_response_minutes,
        "resolution_minutes": rule.resolution_minutes,
        "is_active": rule.is_active,
        "created_at": rule.created_at,
    }
