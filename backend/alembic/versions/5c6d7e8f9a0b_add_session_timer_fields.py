"""add study session timer fields

Revision ID: 5c6d7e8f9a0b
Revises: 4b5c6d7e8f9a
Create Date: 2026-05-03 23:22:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "5c6d7e8f9a0b"
down_revision: Union[str, None] = "4b5c6d7e8f9a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("study_sessions", sa.Column("active_duration_sec", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("study_sessions", sa.Column("paused_at", sa.DateTime(), nullable=True))
    op.add_column("study_sessions", sa.Column("resumed_at", sa.DateTime(), nullable=True))
    op.add_column("study_sessions", sa.Column("timer_state", sa.String(length=20), nullable=False, server_default="running"))


def downgrade() -> None:
    op.drop_column("study_sessions", "timer_state")
    op.drop_column("study_sessions", "resumed_at")
    op.drop_column("study_sessions", "paused_at")
    op.drop_column("study_sessions", "active_duration_sec")
