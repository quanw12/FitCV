from pydantic import BaseModel, EmailStr, Field

from app.models.account import AccountRole


class AccountPublic(BaseModel):
    account_id: int
    email: EmailStr
    full_name: str
    role: AccountRole | None = None
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class AuthSession(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AccountPublic
    requires_role_selection: bool


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=150)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class SelectRoleRequest(BaseModel):
    role: AccountRole


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str
    reset_token: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class OAuthLoginRequest(BaseModel):
    provider: str = Field(pattern="^google$")
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=150)
    avatar_url: str | None = None
