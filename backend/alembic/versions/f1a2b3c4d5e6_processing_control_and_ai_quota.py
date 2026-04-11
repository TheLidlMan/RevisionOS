"""processing control and ai quota

Revision ID: f1a2b3c4d5e6
Revises: c8d4e6f1a2b3
Create Date: 2026-04-11 22:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'c8d4e6f1a2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('documents', sa.Column('file_size_bytes', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('documents', sa.Column('file_sha256', sa.String(length=64), nullable=True))
    op.add_column('documents', sa.Column('processing_stage', sa.String(length=50), nullable=True, server_default='uploaded'))
    op.add_column('documents', sa.Column('processing_error', sa.Text(), nullable=True))
    op.add_column('documents', sa.Column('processing_completed', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('documents', sa.Column('processing_total', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('documents', sa.Column('last_pipeline_updated_at', sa.DateTime(), nullable=True))
    op.add_column('documents', sa.Column('cancel_requested_at', sa.DateTime(), nullable=True))
    op.add_column('documents', sa.Column('cancelled_at', sa.DateTime(), nullable=True))
    op.add_column('documents', sa.Column('delete_requested_at', sa.DateTime(), nullable=True))

    op.add_column('modules', sa.Column('pipeline_updated_at', sa.DateTime(), nullable=True))

    op.add_column('module_jobs', sa.Column('started_at', sa.DateTime(), nullable=True))
    op.add_column('module_jobs', sa.Column('finished_at', sa.DateTime(), nullable=True))
    op.add_column('module_jobs', sa.Column('cancel_requested_at', sa.DateTime(), nullable=True))
    op.add_column('module_jobs', sa.Column('cancelled_at', sa.DateTime(), nullable=True))

    op.create_table(
        'ai_usage_events',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('kind', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ai_usage_events_user_id'), 'ai_usage_events', ['user_id'], unique=False)
    op.create_index(op.f('ix_ai_usage_events_kind'), 'ai_usage_events', ['kind'], unique=False)
    op.create_index(op.f('ix_ai_usage_events_created_at'), 'ai_usage_events', ['created_at'], unique=False)


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