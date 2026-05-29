from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from app.db.dependencies import get_db
from app.auth.dependencies import get_current_admin
from app.models import User
from app.admin import schemas, services

router = APIRouter(prefix="/admin", tags=["Admin"])


# ==================== USER MANAGEMENT ====================

@router.get("/users", response_model=List[schemas.UserResponse])
def list_users(
    skip: int = 0,
    limit: int = 100,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get all users (admin only)."""
    try:
        users = services.get_users(db, skip=skip, limit=limit)
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}", response_model=schemas.UserResponse)
def get_user(
    user_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get a specific user (admin only)."""
    try:
        user = services.get_user_by_id(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users", response_model=schemas.UserResponse)
def create_user(
    payload: schemas.UserCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Create a new user (admin only)."""
    try:
        user, temp_password = services.create_user(
            db=db,
            full_name=payload.full_name,
            email=payload.email,
            phone=payload.phone,
            department_id=payload.department_id,
            organization_id=payload.organization_id,
            role=payload.role,
            created_by_user_id=current_admin.user_id,
        )
        # Note: temp_password is returned via separate response model with password
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
    """Update user information (admin only)."""
    try:
        user = services.update_user(
            db=db,
            user_id=user_id,
            full_name=payload.full_name,
            phone=payload.phone,
            department_id=payload.department_id,
            role=payload.role,
        )
        return user
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
    """Activate a user (admin only)."""
    try:
        user = services.activate_user(db, user_id)
        return user
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
    """Deactivate a user (admin only)."""
    try:
        user = services.deactivate_user(db, user_id)
        return user
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
    """Reset user password and return temporary password (admin only)."""
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


# ==================== DEPARTMENT MANAGEMENT ====================

@router.get("/departments", response_model=List[schemas.DepartmentResponse])
def list_departments(
    skip: int = 0,
    limit: int = 100,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get all departments (admin only)."""
    try:
        departments = services.get_departments(db, skip=skip, limit=limit)
        return departments
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/departments/{department_id}", response_model=schemas.DepartmentResponse)
def get_department(
    department_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get a specific department (admin only)."""
    try:
        department = services.get_department_by_id(db, department_id)
        if not department:
            raise HTTPException(status_code=404, detail="Department not found")
        return department
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/departments", response_model=schemas.DepartmentResponse)
def create_department(
    payload: schemas.DepartmentCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Create a new department (admin only)."""
    try:
        department = services.create_department(
            db=db,
            organization_id=payload.organization_id,
            department_name=payload.department_name,
        )
        return department
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
