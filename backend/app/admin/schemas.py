from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID


class DepartmentBase(BaseModel):
    department_name: str
    organization_id: Optional[UUID] = None


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentResponse(DepartmentBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class UserBase(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    department_id: Optional[UUID] = None
    organization_id: Optional[UUID] = None


class UserCreate(UserBase):
    role: str = "USER"  # USER, TEAM, or ADMIN


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
