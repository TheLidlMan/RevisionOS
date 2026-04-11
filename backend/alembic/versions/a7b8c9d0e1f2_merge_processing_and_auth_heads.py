"""merge processing and auth heads

Revision ID: a7b8c9d0e1f2
Revises: e5f6a7b8c9d0, f1a2b3c4d5e6
Create Date: 2026-04-11 22:45:00.000000

"""

from typing import Sequence, Union


revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = ("e5f6a7b8c9d0", "f1a2b3c4d5e6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass