"""merge all migration heads into single timeline

Revision ID: merge_all_heads
Revises: 1c2d3e4f5a6b, f7e8d9c0b1a2, p1e2r3f4o5r6
Create Date: 2026-05-02 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'merge_all_heads'
down_revision: Union[str, Sequence[str]] = ('1c2d3e4f5a6b', 'f7e8d9c0b1a2', 'p1e2r3f4o5r6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass  # No schema changes — this is a pure merge point


def downgrade() -> None:
    pass
