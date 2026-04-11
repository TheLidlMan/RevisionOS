"""processing control and ai quota

Revision ID: f1a2b3c4d5e6
Revises: c8d4e6f1a2b3
Create Date: 2026-04-11 22:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'c8d4e6f1a2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _column_exists(inspector, table_name: str, column_name: str) -> bool:
    if not _table_exists(inspector, table_name):
        return False
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _index_exists(inspector, table_name: str, index_name: str) -> bool:
    if not _table_exists(inspector, table_name):
        return False
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    document_columns = [
        ("file_size_bytes", sa.Column('file_size_bytes', sa.Integer(), nullable=True, server_default='0')),
        ("file_sha256", sa.Column('file_sha256', sa.String(length=64), nullable=True)),
        ("processing_stage", sa.Column('processing_stage', sa.String(length=50), nullable=True, server_default='uploaded')),
        ("processing_error", sa.Column('processing_error', sa.Text(), nullable=True)),
        ("processing_completed", sa.Column('processing_completed', sa.Integer(), nullable=False, server_default='0')),
        ("processing_total", sa.Column('processing_total', sa.Integer(), nullable=False, server_default='0')),
        ("last_pipeline_updated_at", sa.Column('last_pipeline_updated_at', sa.DateTime(), nullable=True)),
        ("cancel_requested_at", sa.Column('cancel_requested_at', sa.DateTime(), nullable=True)),
        ("cancelled_at", sa.Column('cancelled_at', sa.DateTime(), nullable=True)),
        ("delete_requested_at", sa.Column('delete_requested_at', sa.DateTime(), nullable=True)),
    ]
    for column_name, column in document_columns:
        if not _column_exists(inspector, 'documents', column_name):
            op.add_column('documents', column)
            inspector = inspect(bind)

    if not _column_exists(inspector, 'modules', 'pipeline_updated_at'):
        op.add_column('modules', sa.Column('pipeline_updated_at', sa.DateTime(), nullable=True))
        inspector = inspect(bind)

    module_job_columns = [
        ("started_at", sa.Column('started_at', sa.DateTime(), nullable=True)),
        ("finished_at", sa.Column('finished_at', sa.DateTime(), nullable=True)),
        ("cancel_requested_at", sa.Column('cancel_requested_at', sa.DateTime(), nullable=True)),
        ("cancelled_at", sa.Column('cancelled_at', sa.DateTime(), nullable=True)),
    ]
    for column_name, column in module_job_columns:
        if not _column_exists(inspector, 'module_jobs', column_name):
            op.add_column('module_jobs', column)
            inspector = inspect(bind)

    if not _table_exists(inspector, 'ai_usage_events'):
        op.create_table(
            'ai_usage_events',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('user_id', sa.String(length=36), nullable=False),
            sa.Column('kind', sa.String(length=50), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        inspector = inspect(bind)

    for index_name, columns in [
        (op.f('ix_ai_usage_events_user_id'), ['user_id']),
        (op.f('ix_ai_usage_events_kind'), ['kind']),
        (op.f('ix_ai_usage_events_created_at'), ['created_at']),
    ]:
        if not _index_exists(inspector, 'ai_usage_events', index_name):
            op.create_index(index_name, 'ai_usage_events', columns, unique=False)
            inspector = inspect(bind)


def downgrade() -> None:
    op.drop_index(op.f('ix_ai_usage_events_created_at'), table_name='ai_usage_events')
    op.drop_index(op.f('ix_ai_usage_events_kind'), table_name='ai_usage_events')
    op.drop_index(op.f('ix_ai_usage_events_user_id'), table_name='ai_usage_events')
    op.drop_table('ai_usage_events')

    op.drop_column('module_jobs', 'cancelled_at')
    op.drop_column('module_jobs', 'cancel_requested_at')
    op.drop_column('module_jobs', 'finished_at')
    op.drop_column('module_jobs', 'started_at')

    op.drop_column('modules', 'pipeline_updated_at')

    op.drop_column('documents', 'delete_requested_at')
    op.drop_column('documents', 'cancelled_at')
    op.drop_column('documents', 'cancel_requested_at')
    op.drop_column('documents', 'last_pipeline_updated_at')
    op.drop_column('documents', 'processing_total')
    op.drop_column('documents', 'processing_completed')
    op.drop_column('documents', 'processing_error')
    op.drop_column('documents', 'processing_stage')
    op.drop_column('documents', 'file_sha256')
    op.drop_column('documents', 'file_size_bytes')