"""add ai request lock table

Revision ID: 0f1e2d3c4b5a
Revises: f1a2b3c4d5e6
Create Date: 2026-04-12 12:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = '0f1e2d3c4b5a'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _index_exists(inspector, table_name: str, index_name: str) -> bool:
    if not _table_exists(inspector, table_name):
        return False
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _table_exists(inspector, 'ai_request_locks'):
        op.create_table(
            'ai_request_locks',
            sa.Column('name', sa.String(length=50), nullable=False),
            sa.Column('owner_id', sa.String(length=36), nullable=True),
            sa.Column('acquired_at', sa.DateTime(), nullable=True),
            sa.Column('heartbeat_at', sa.DateTime(), nullable=True),
            sa.Column('expires_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('name'),
        )
        inspector = inspect(bind)

    for index_name, columns in [
        (op.f('ix_ai_request_locks_owner_id'), ['owner_id']),
        (op.f('ix_ai_request_locks_expires_at'), ['expires_at']),
    ]:
        if not _index_exists(inspector, 'ai_request_locks', index_name):
            op.create_index(index_name, 'ai_request_locks', columns, unique=False)
            inspector = inspect(bind)


def downgrade() -> None:
    op.drop_index(op.f('ix_ai_request_locks_expires_at'), table_name='ai_request_locks')
    op.drop_index(op.f('ix_ai_request_locks_owner_id'), table_name='ai_request_locks')
    op.drop_table('ai_request_locks')