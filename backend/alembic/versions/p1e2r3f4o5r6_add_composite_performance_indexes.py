"""add composite performance indexes

Revision ID: p1e2r3f4o5r6
Revises: a7b8c9d0e1f2, 609db23bfda9, b4c2d1e3f4a5, c8d4e6f1a2b3
Create Date: 2026-05-02 12:00:00.000000

Adds composite indexes to speed up the most common query patterns:

- flashcards(user_id, next_review)  – due-card queries filtered by user
- flashcards(module_id, user_id)    – module-scoped lookups
- quiz_questions(user_id, module_id) – session question fetches
- review_logs(user_id, answered_at) – per-user analytics range scans
- study_sessions(user_id, created_at) – session history queries
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "p1e2r3f4o5r6"
# depends on the final merge head
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add created_at column to study_sessions if it doesn't exist (may have been
    # missed in initial schema on some environments)
    try:
        op.add_column("study_sessions", sa.Column("created_at", sa.DateTime(), nullable=True))
    except Exception:
        pass  # Column already exists

    # --- flashcards ---
    op.create_index(
        "ix_flashcards_user_id_due",
        "flashcards",
        ["user_id", "due"],
        unique=False,
    )
    op.create_index(
        "ix_flashcards_module_id_user_id",
        "flashcards",
        ["module_id", "user_id"],
        unique=False,
    )

    # --- quiz_questions ---
    op.create_index(
        "ix_quiz_questions_user_id_module_id",
        "quiz_questions",
        ["user_id", "module_id"],
        unique=False,
    )

    # --- review_logs ---
    op.create_index(
        "ix_review_logs_user_id_answered_at",
        "review_logs",
        ["user_id", "answered_at"],
        unique=False,
    )

    # --- study_sessions (quiz_sessions) ---
    op.create_index(
        "ix_study_sessions_user_id_created_at",
        "study_sessions",
        ["user_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_study_sessions_user_id_created_at", table_name="study_sessions")
    op.drop_index("ix_review_logs_user_id_answered_at", table_name="review_logs")
    op.drop_index("ix_quiz_questions_user_id_module_id", table_name="quiz_questions")
    op.drop_index("ix_flashcards_module_id_user_id", table_name="flashcards")
    op.drop_index("ix_flashcards_user_id_due", table_name="flashcards")
