from fastapi import APIRouter, Depends

from app.core.auth import AuthenticatedUser, get_current_user, require_role
from app.domain.roles import UserRole

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=AuthenticatedUser)
def me(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
    return user


@router.get("/collector-only", response_model=AuthenticatedUser)
def collector_only(user: AuthenticatedUser = Depends(require_role(UserRole.COLLECTOR))) -> AuthenticatedUser:
    return user