from fastapi import APIRouter, Depends

from app.core.auth import AuthenticatedUser, get_current_user
from app.domain.lot_models import MaterialCategory
from app.repositories.demo_store import MATERIALS

router = APIRouter(prefix="/materials", tags=["materials"])


@router.get("", response_model=list[MaterialCategory])
def list_materials(_: AuthenticatedUser = Depends(get_current_user)) -> list[MaterialCategory]:
    return MATERIALS