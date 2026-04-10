"""constrain study session status

Revision ID: b4c2d1e3f4a5
Revises: a3b7c8d9e0f1
Create Date: 2026-04-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4c2d1e3f4a5'
down_revision: Union[str, None] = 'a3b7c8d9e0f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_STATUS_VALUES = ('ready', 'generating', 'in_progress', 'completed')


def upgrade() -> None:
    op.execute("UPDATE study_sessions SET status = 'in_progress' WHERE status IS NULL")
    op.execute(
        "UPDATE study_sessions SET status = 'in_progress' "
        "WHERE status NOT IN ('ready', 'generating', 'in_progress', 'completed')"
    )

    with op.batch_alter_table('study_sessions') as batch_op:
        batch_op.alter_column(
            'status',
            existing_type=sa.String(length=20),
            nullable=False,
            server_default='in_progress',
        )
        batch_op.create_check_constraint(
            'ck_study_sessions_status',
            "status IN ('ready', 'generating', 'in_progress', 'completed')",
        )


def downgrade() -> None:
    with op.batch_alter_table('study_sessions') as batch_op:
        batch_op.drop_constraint('ck_study_sessions_status', type_='check')
        batch_op.alter_column(
            'status',
            existing_type=sa.String(length=20),
            nullable=True,
            server_default='in_progress',
        )
