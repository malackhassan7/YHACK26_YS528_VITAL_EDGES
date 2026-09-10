from enum import StrEnum


class UserRole(StrEnum):
    COLLECTOR = "COLLECTOR"
    RECYCLER = "RECYCLER"
    ADMIN = "ADMIN"