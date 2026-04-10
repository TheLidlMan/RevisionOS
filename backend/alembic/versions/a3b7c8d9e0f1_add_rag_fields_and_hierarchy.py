"""add rag fields and hierarchy

Revision ID: a3b7c8d9e0f1
Revises: 609db23bfda9
Create Date: 2026-04-10 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3b7c8d9e0f1'
down_revision: Union[str, None] = '609db23bfda9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Document: add summary field
    op.add_column('documents', sa.Column('summary', sa.Text(), nullable=True))

    # Concept: add hierarchy fields
    op.add_column('concepts', sa.Column('parent_concept_id', sa.String(length=36), nullable=True))
    op.add_column('concepts', sa.Column('order_index', sa.Integer(), server_default='0', nullable=True))
    op.create_foreign_key(
        'fk_concepts_parent_id', 'concepts', 'concepts',
        ['parent_concept_id'], ['id'], ondelete='SET NULL'
    )

    # StudySession: add status field
    op.add_column('study_sessions', sa.Column('status', sa.String(length=20), server_default='in_progress', nullable=True))


def downgrade() -> None:
    op.drop_column('study_sessions', 'status')
    op.drop_constraint('fk_concepts_parent_id', 'concepts', type_='foreignkey')
    op.drop_column('concepts', 'order_index')
    op.drop_column('concepts', 'parent_concept_id')
    op.drop_column('documents', 'summary')
