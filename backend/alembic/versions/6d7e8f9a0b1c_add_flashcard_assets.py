"""add flashcard assets table

Revision ID: 6d7e8f9a0b1c
Revises: 5c6d7e8f9a0b
Create Date: 2026-05-03 23:23:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "6d7e8f9a0b1c"
down_revision: Union[str, None] = "5c6d7e8f9a0b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "flashcard_assets",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("flashcard_id", sa.String(length=36), nullable=False),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("original_filename", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["flashcard_id"], ["flashcards.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_flashcard_assets_flashcard_id"), "flashcard_assets", ["flashcard_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_flashcard_assets_flashcard_id"), table_name="flashcard_assets")
    op.drop_table("flashcard_assets")
