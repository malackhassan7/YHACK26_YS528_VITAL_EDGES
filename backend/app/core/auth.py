from typing import Annotated

from fastapi import Depends, Header
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.domain.roles import UserRole


class AuthenticatedUser(BaseModel):
    id: str
    email: str
    displayName: str
    role: UserRole
    isDemo: bool


DEMO_USERS: dict[str, AuthenticatedUser] = {
    "demo-token-collector": AuthenticatedUser(id="collector-profile", email="collector@demo.local", displayName="Meena Collector", role=UserRole.COLLECTOR, isDemo=True),
    "demo-token-recycler": AuthenticatedUser(id="recycler-profile", email="recycler@demo.local", displayName="GreenLoop Recycler", role=UserRole.RECYCLER, isDemo=True),
    "demo-token-admin": AuthenticatedUser(id="admin-profile", email="admin@demo.local", displayName="Asha Admin", role=UserRole.ADMIN, isDemo=True),
}


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise ApiError(status_code=401, code="UNAUTHORIZED", message="Missing bearer token.")
    return authorization.removeprefix("Bearer ").strip()


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    token = _extract_bearer_token(authorization)
    if settings.auth_mode == "demo":
        user = DEMO_USERS.get(token)
        if user is None:
            raise ApiError(status_code=401, code="UNAUTHORIZED", message="Invalid demo token.")
        return user

    raise ApiError(status_code=501, code="AUTH_NOT_CONFIGURED", message="Supabase JWT verification is not configured in this foundation build.")


def require_role(*allowed_roles: UserRole):
    async def dependency(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role not in allowed_roles:
            raise ApiError(status_code=403, code="FORBIDDEN", message="This role is not allowed to access the requested resource.")
        return user

    return dependency