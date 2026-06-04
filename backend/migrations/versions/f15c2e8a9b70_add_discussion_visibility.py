"""add discussion visibility

Revision ID: f15c2e8a9b70
Revises: e6c7d5a4f910
Create Date: 2026-06-04 10:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "f15c2e8a9b70"
down_revision = "e6c7d5a4f910"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("discussion_threads", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "visibility",
                sa.String(length=50),
                nullable=False,
                server_default="section",
            )
        )

    with op.batch_alter_table("discussion_threads", schema=None) as batch_op:
        batch_op.alter_column("visibility", server_default=None)


def downgrade():
    with op.batch_alter_table("discussion_threads", schema=None) as batch_op:
        batch_op.drop_column("visibility")
