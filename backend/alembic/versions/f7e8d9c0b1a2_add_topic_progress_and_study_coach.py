"""add topic progress and study coach persistence

Revision ID: f7e8d9c0b1a2
Revises: c8d4e6f1a2b3
Create Date: 2026-04-29 23:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7e8d9c0b1a2"
down_revision: Union[str, None] = "c8d4e6f1a2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "topic_progress",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("module_id", sa.String(length=36), nullable=False),
        sa.Column("concept_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="not_started"),
        sa.Column("progress_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("last_score_pct", sa.Float(), nullable=True),
        sa.Column("confidence_pct", sa.Float(), nullable=True),
        sa.Column("question_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("correct_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("last_activity_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["concept_id"], ["concepts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["module_id"], ["modules.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "concept_id", name="uq_topic_progress_user_concept"),
    )
    op.create_index(op.f("ix_topic_progress_user_id"), "topic_progress", ["user_id"], unique=False)
    op.create_index(op.f("ix_topic_progress_module_id"), "topic_progress", ["module_id"], unique=False)
    op.create_index(op.f("ix_topic_progress_concept_id"), "topic_progress", ["concept_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_topic_progress_concept_id"), table_name="topic_progress")
    op.drop_index(op.f("ix_topic_progress_module_id"), table_name="topic_progress")
    op.drop_index(op.f("ix_topic_progress_user_id"), table_name="topic_progress")
    op.drop_table("topic_progress")
