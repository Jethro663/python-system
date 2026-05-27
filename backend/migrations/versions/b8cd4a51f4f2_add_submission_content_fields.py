"""add submission content fields

Revision ID: b8cd4a51f4f2
Revises: a71e9d2ab314
Create Date: 2026-05-25 13:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b8cd4a51f4f2"
down_revision = "a71e9d2ab314"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("submissions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("response_text", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("uploaded_file_path", sa.String(length=500), nullable=True))


def downgrade():
    with op.batch_alter_table("submissions", schema=None) as batch_op:
        batch_op.drop_column("uploaded_file_path")
        batch_op.drop_column("response_text")
