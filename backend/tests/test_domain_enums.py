from app.domain.lot_status import LotStatus
from app.domain.roles import UserRole


def test_required_roles_exist():
    assert {role.value for role in UserRole} == {"COLLECTOR", "RECYCLER", "ADMIN"}


def test_required_lot_statuses_exist():
    assert LotStatus.DRAFT.value == "DRAFT"
    assert LotStatus.CLOSED.value == "CLOSED"
    assert len(list(LotStatus)) == 20