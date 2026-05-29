from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_current_admin, get_current_team
from app.auth.schemas import LoginRequest, TokenResponse
from app.auth.services import authenticate_user
from app.core.security import create_access_token
from app.db.dependencies import get_db

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
    return TokenResponse(access_token=access_token)


@router.get("/me")
def read_current_user(current_user=Depends(get_current_user)):
    return {
        "id": str(current_user.user_id),
        "email": current_user.email,
        "role": (current_user.role or '').upper(),
        "full_name": current_user.full_name,
    }


@router.get("/admin/check")
def read_admin(current_admin=Depends(get_current_admin)):
    return {"status": "admin access granted", "email": current_admin.email}


@router.get("/team/check")
def read_team(current_team=Depends(get_current_team)):
    return {"status": "team access granted", "email": current_team.email}
