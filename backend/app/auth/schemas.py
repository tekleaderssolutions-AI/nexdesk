from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_temp_password: bool = False


class ChangePasswordRequest(BaseModel):
    email: EmailStr
    current_password: str
    new_password: str


class TokenPayload(BaseModel):
    sub: str
    email: EmailStr
    role: str
    exp: int
