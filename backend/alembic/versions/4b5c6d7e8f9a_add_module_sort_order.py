"""add module sort order

Revision ID: 4b5c6d7e8f9a
Revises: 3a4b5c6d7e8f
Create Date: 2026-05-03 23:21:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "4b5c6d7e8f9a"
down_revision: Union[str, None] = "3a4b5c6d7e8f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("modules", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))
    op.create_index(op.f("ix_modules_sort_order"), "modules", ["sort_order"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_modules_sort_order"), table_name="modules")
    op.drop_column("modules", "sort_order")
