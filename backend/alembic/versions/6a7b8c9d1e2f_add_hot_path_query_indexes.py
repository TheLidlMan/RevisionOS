"""add hot path query indexes

Revision ID: 6a7b8c9d1e2f
Revises: 2b4c6d8e0f12
Create Date: 2026-05-03 23:15:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6a7b8c9d1e2f"
down_revision: Union[str, Sequence[str], None] = "2b4c6d8e0f12"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create_index_if_missing(index_name: str, table_name: str, columns: list[str]) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_indexes = {index["name"] for index in inspector.get_indexes(table_name)}
    if index_name not in existing_indexes:
        op.create_index(index_name, table_name, columns, unique=False)


def _drop_index_if_exists(index_name: str, table_name: str) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_indexes = {index["name"] for index in inspector.get_indexes(table_name)}
    if index_name in existing_indexes:
        op.drop_index(index_name, table_name=table_name)


def upgrade() -> None:
    _create_index_if_missing(
        "ix_concepts_user_id_module_id_importance_score",
        "concepts",
        ["user_id", "module_id", "importance_score"],
    )
    _create_index_if_missing(
        "ix_documents_module_id_delete_requested_at_created_at",
        "documents",
        ["module_id", "delete_requested_at", "created_at"],
    )
    _create_index_if_missing(
        "ix_quiz_questions_user_id_module_id_created_at",
        "quiz_questions",
        ["user_id", "module_id", "created_at"],
    )
    _create_index_if_missing(
        "ix_review_logs_item_id_answered_at",
        "review_logs",
        ["item_id", "answered_at"],
    )


def downgrade() -> None:
    _drop_index_if_exists("ix_review_logs_item_id_answered_at", "review_logs")
    _drop_index_if_exists("ix_quiz_questions_user_id_module_id_created_at", "quiz_questions")
    _drop_index_if_exists(
        "ix_documents_module_id_delete_requested_at_created_at",
        "documents",
    )
    _drop_index_if_exists(
        "ix_concepts_user_id_module_id_importance_score",
        "concepts",
    )
