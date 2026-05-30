from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID


# ==================== ORGANIZATIONS ====================

class OrganizationCreate(BaseModel):
    org_name: str
    domain: Optional[str] = None
    plan_type: Optional[str] = None
    is_active: bool = True


class OrganizationUpdate(BaseModel):
    org_name: Optional[str] = None
    domain: Optional[str] = None
    plan_type: Optional[str] = None
    is_active: Optional[bool] = None


class OrganizationResponse(BaseModel):
    id: UUID
    org_name: str
    domain: Optional[str] = None
    plan_type: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== DEPARTMENTS ====================

class DepartmentBase(BaseModel):
    department_name: str
    organization_id: Optional[UUID] = None


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    department_name: Optional[str] = None
    organization_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class DepartmentResponse(BaseModel):
    id: UUID
    department_name: str
    organization_id: Optional[UUID] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== TEAMS ====================

class TeamCreate(BaseModel):
    department_id: Optional[UUID] = None
    team_name: str


class TeamUpdate(BaseModel):
    department_id: Optional[UUID] = None
    team_name: Optional[str] = None
    is_active: Optional[bool] = None


class TeamResponse(BaseModel):
    id: UUID
    department_id: Optional[UUID] = None
    team_name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== TEAM MEMBERS ====================

class TeamMemberCreate(BaseModel):
    user_id: UUID
    team_id: UUID
    member_role: str = "AGENT"


class TeamMemberUpdate(BaseModel):
    member_role: str


class TeamMemberResponse(BaseModel):
    id: UUID
    user_id: UUID
    team_id: UUID
    member_role: str

    class Config:
        from_attributes = True


class TeamMemberDetailResponse(BaseModel):
    id: UUID
    user_id: UUID
    team_id: UUID
    member_role: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    team_name: Optional[str] = None
    department_name: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== SKILLS ====================

class SkillCreate(BaseModel):
    skill_name: str
    description: Optional[str] = None
    is_active: bool = True


class SkillUpdate(BaseModel):
    skill_name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class SkillResponse(BaseModel):
    id: UUID
    skill_name: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== TEAM MEMBER SKILLS ====================

class TeamMemberSkillCreate(BaseModel):
    team_member_id: UUID
    skill_id: UUID
    proficiency: str = "INTERMEDIATE"


class TeamMemberSkillUpdate(BaseModel):
    proficiency: str


class TeamMemberSkillResponse(BaseModel):
    id: UUID
    team_member_id: UUID
    skill_id: UUID
    proficiency: str

    class Config:
        from_attributes = True


class TeamMemberSkillDetailResponse(BaseModel):
    id: UUID
    team_member_id: UUID
    skill_id: UUID
    proficiency: str
    skill_name: Optional[str] = None
    full_name: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== TEAM STATS ====================

class TeamStatsResponse(BaseModel):
    id: UUID
    team_name: str
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None
    is_active: bool
    member_count: int = 0
    open_tickets: int = 0
    avg_resolution_hours: Optional[float] = None
    sla_percentage: Optional[int] = None

    class Config:
        from_attributes = True


# ==================== MEMBER SKILLS ====================

class MemberSkillItem(BaseModel):
    id: UUID
    skill_id: UUID
    skill_name: str
    proficiency: str

    class Config:
        from_attributes = True


class MemberSkillAdd(BaseModel):
    skill_name: str
    proficiency: str = "INTERMEDIATE"


# ==================== USERS ====================

class UserBase(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    department_id: Optional[UUID] = None
    organization_id: Optional[UUID] = None


class UserCreate(UserBase):
    role: str = "USER"


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[UUID] = None
    role: Optional[str] = None


class UserResponse(UserBase):
    user_id: UUID
    role: str
    is_active: bool
    is_temp_password: bool
    created_by: Optional[UUID] = None
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PasswordResetRequest(BaseModel):
    user_id: UUID


class PasswordResetResponse(BaseModel):
    user_id: UUID
    temporary_password: str
    message: str
