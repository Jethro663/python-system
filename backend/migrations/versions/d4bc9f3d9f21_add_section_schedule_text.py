"""add section schedule text

Revision ID: d4bc9f3d9f21
Revises: b8cd4a51f4f2
Create Date: 2026-05-25 13:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d4bc9f3d9f21"
down_revision = "b8cd4a51f4f2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("sections", sa.Column("schedule_text", sa.String(length=255), nullable=True))


def downgrade():
    op.drop_column("sections", "schedule_text")
