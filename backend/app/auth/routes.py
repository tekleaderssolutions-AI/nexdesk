from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_current_admin, get_current_team
from app.auth.schemas import LoginRequest, TokenResponse
from app.auth.services import authenticate_user
from app.core.security import create_access_token
from app.db.dependencies import get_db
from app.core.security import hash_password
from app.auth.schemas import ChangePasswordRequest

router = APIRouter(prefix="", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": str(user.user_id), "email": user.email, "role": (user.role or '').upper()}
    )
    # Include flag indicating whether the user is still using a temporary password.
    return TokenResponse(access_token=access_token, is_temp_password=bool(user.is_temp_password))


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, db: Session = Depends(get_db)):
    """Allow a user to change their password by providing current password (works with temporary password).

    This endpoint is intentionally unauthenticated so users who only have a temporary
    password can switch to a permanent password before obtaining a token.
    """
    user = authenticate_user(db, payload.email, payload.current_password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or current password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Update password and clear temporary flag
    user.password_hash = hash_password(payload.new_password)
    user.is_temp_password = False
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": "Password changed successfully"}


@router.get("/me")
def read_current_user(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.models import TeamMember, Team
    member = db.query(TeamMember).filter(TeamMember.user_id == current_user.user_id).first()
    department_id = None
    team_id = None
    if member:
        team_id = str(member.team_id)
        team = db.query(Team).filter(Team.id == member.team_id).first()
        if team and team.department_id:
            department_id = str(team.department_id)
    return {
        "id": str(current_user.user_id),
        "email": current_user.email,
        "role": (current_user.role or '').upper(),
        "full_name": current_user.full_name,
        "team_id": team_id,
        "department_id": department_id,
    }


@router.get("/admin/check")
def read_admin(current_admin=Depends(get_current_admin)):
    return {"status": "admin access granted", "email": current_admin.email}


@router.get("/team/check")
def read_team(current_team=Depends(get_current_team)):
    return {"status": "team access granted", "email": current_team.email}
