"""add flashcard difficulty and bookmark fields

Revision ID: 3a4b5c6d7e8f
Revises: merge_all_heads
Create Date: 2026-05-03 23:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "3a4b5c6d7e8f"
down_revision: Union[str, None] = "merge_all_heads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("flashcards", sa.Column("study_difficulty", sa.String(length=10), nullable=False, server_default="MEDIUM"))
    op.add_column("flashcards", sa.Column("is_bookmarked", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_index(op.f("ix_flashcards_is_bookmarked"), "flashcards", ["is_bookmarked"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_flashcards_is_bookmarked"), table_name="flashcards")
    op.drop_column("flashcards", "is_bookmarked")
    op.drop_column("flashcards", "study_difficulty")
