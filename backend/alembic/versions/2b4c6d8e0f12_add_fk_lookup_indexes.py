"""add foreign key lookup indexes

Revision ID: 2b4c6d8e0f12
Revises: merge_all_heads
Create Date: 2026-05-02 17:10:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "2b4c6d8e0f12"
down_revision: Union[str, Sequence[str], None] = "merge_all_heads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_review_logs_session_id", "review_logs", ["session_id"], unique=False)
    op.create_index("ix_review_logs_item_id", "review_logs", ["item_id"], unique=False)
    op.create_index("ix_documents_module_id", "documents", ["module_id"], unique=False)
    op.create_index("ix_study_sessions_module_id", "study_sessions", ["module_id"], unique=False)
    op.create_index("ix_flashcards_module_id", "flashcards", ["module_id"], unique=False)
    op.create_index("ix_flashcards_concept_id", "flashcards", ["concept_id"], unique=False)
    op.create_index("ix_flashcards_source_document_id", "flashcards", ["source_document_id"], unique=False)
    op.create_index("ix_quiz_questions_module_id", "quiz_questions", ["module_id"], unique=False)
    op.create_index("ix_quiz_questions_concept_id", "quiz_questions", ["concept_id"], unique=False)
    op.create_index("ix_quiz_questions_source_document_id", "quiz_questions", ["source_document_id"], unique=False)
    op.create_index("ix_concepts_module_id", "concepts", ["module_id"], unique=False)
    op.create_index("ix_concepts_parent_concept_id", "concepts", ["parent_concept_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_concepts_parent_concept_id", table_name="concepts")
    op.drop_index("ix_concepts_module_id", table_name="concepts")
    op.drop_index("ix_quiz_questions_source_document_id", table_name="quiz_questions")
    op.drop_index("ix_quiz_questions_concept_id", table_name="quiz_questions")
    op.drop_index("ix_quiz_questions_module_id", table_name="quiz_questions")
    op.drop_index("ix_flashcards_source_document_id", table_name="flashcards")
    op.drop_index("ix_flashcards_concept_id", table_name="flashcards")
    op.drop_index("ix_flashcards_module_id", table_name="flashcards")
    op.drop_index("ix_study_sessions_module_id", table_name="study_sessions")
    op.drop_index("ix_documents_module_id", table_name="documents")
    op.drop_index("ix_review_logs_item_id", table_name="review_logs")
    op.drop_index("ix_review_logs_session_id", table_name="review_logs")
