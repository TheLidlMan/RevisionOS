"""add auth session lookup index

Revision ID: 1c2d3e4f5a6b
Revises: 0f1e2d3c4b5a
Create Date: 2026-04-12 12:30:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "1c2d3e4f5a6b"
down_revision: Union[str, None] = "0f1e2d3c4b5a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_auth_sessions_active_lookup "
        "ON auth_sessions (token_hash, expires_at, user_id) "
        "WHERE revoked = false"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_auth_sessions_active_lookup")