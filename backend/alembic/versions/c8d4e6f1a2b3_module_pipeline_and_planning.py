"""module pipeline and deterministic planning

Revision ID: c8d4e6f1a2b3
Revises: b4c2d1e3f4a5
Create Date: 2026-04-11 13:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c8d4e6f1a2b3'
down_revision: Union[str, None] = 'b4c2d1e3f4a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('documents', sa.Column('embedding', sa.Text(), nullable=True))

    op.add_column('modules', sa.Column('exam_date', sa.DateTime(), nullable=True))
    op.add_column('modules', sa.Column('pipeline_status', sa.String(length=20), nullable=False, server_default='idle'))
    op.add_column('modules', sa.Column('pipeline_stage', sa.String(length=50), nullable=False, server_default='idle'))
    op.add_column('modules', sa.Column('pipeline_completed', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('modules', sa.Column('pipeline_total', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('modules', sa.Column('pipeline_error', sa.Text(), nullable=True))
    op.add_column('modules', sa.Column('study_plan_json', sa.Text(), nullable=True))
    op.add_column('modules', sa.Column('study_plan_generated_at', sa.DateTime(), nullable=True))

    op.add_column('concepts', sa.Column('study_weight', sa.Float(), nullable=True, server_default='1.0'))

    op.add_column('flashcards', sa.Column('generation_source', sa.String(length=10), nullable=False, server_default='MANUAL'))

    op.create_table(
        'module_jobs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('module_id', sa.String(length=36), nullable=False),
        sa.Column('document_id', sa.String(length=36), nullable=True),
        sa.Column('job_type', sa.String(length=30), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('stage', sa.String(length=50), nullable=False),
        sa.Column('completed', sa.Integer(), nullable=False),
        sa.Column('total', sa.Integer(), nullable=False),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['module_id'], ['modules.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_module_jobs_module_id'), 'module_jobs', ['module_id'], unique=False)
    op.create_index(op.f('ix_module_jobs_document_id'), 'module_jobs', ['document_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_module_jobs_document_id'), table_name='module_jobs')
    op.drop_index(op.f('ix_module_jobs_module_id'), table_name='module_jobs')
    op.drop_table('module_jobs')

    op.drop_column('flashcards', 'generation_source')
    op.drop_column('concepts', 'study_weight')

    op.drop_column('modules', 'study_plan_generated_at')
    op.drop_column('modules', 'study_plan_json')
    op.drop_column('modules', 'pipeline_error')
    op.drop_column('modules', 'pipeline_total')
    op.drop_column('modules', 'pipeline_completed')
    op.drop_column('modules', 'pipeline_stage')
    op.drop_column('modules', 'pipeline_status')
    op.drop_column('modules', 'exam_date')

    op.drop_column('documents', 'embedding')
