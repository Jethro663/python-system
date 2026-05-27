"""add module subject tag

Revision ID: e6c7d5a4f910
Revises: d4bc9f3d9f21
Create Date: 2026-05-25 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e6c7d5a4f910"
down_revision = "d4bc9f3d9f21"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("modules", sa.Column("subject_tag", sa.String(length=100), nullable=True))


def downgrade():
    op.drop_column("modules", "subject_tag")
