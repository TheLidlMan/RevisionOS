"""add updated_at timestamps to documents and flashcards

Revision ID: d1e2f3a4b5c6
Revises: c8d4e6f1a2b3
Create Date: 2026-04-11 15:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c8d4e6f1a2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('documents', sa.Column('updated_at', sa.DateTime(), nullable=True))
    op.add_column('flashcards', sa.Column('updated_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('flashcards', 'updated_at')
    op.drop_column('documents', 'updated_at')
