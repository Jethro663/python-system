"""add discussion tables

Revision ID: a71e9d2ab314
Revises: 6a4bcdec436d
Create Date: 2026-05-25 12:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a71e9d2ab314"
down_revision = "6a4bcdec436d"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "discussion_threads",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("author_user_id", sa.Integer(), nullable=False),
        sa.Column("section_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("is_pinned", sa.Boolean(), nullable=False),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["section_id"], ["sections.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("discussion_threads", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_discussion_threads_author_user_id"), ["author_user_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_discussion_threads_section_id"), ["section_id"], unique=False)

    op.create_table(
        "discussion_replies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("thread_id", sa.Integer(), nullable=False),
        sa.Column("author_user_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["thread_id"], ["discussion_threads.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("discussion_replies", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_discussion_replies_author_user_id"), ["author_user_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_discussion_replies_thread_id"), ["thread_id"], unique=False)


def downgrade():
    with op.batch_alter_table("discussion_replies", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_discussion_replies_thread_id"))
        batch_op.drop_index(batch_op.f("ix_discussion_replies_author_user_id"))

    op.drop_table("discussion_replies")

    with op.batch_alter_table("discussion_threads", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_discussion_threads_section_id"))
        batch_op.drop_index(batch_op.f("ix_discussion_threads_author_user_id"))

    op.drop_table("discussion_threads")
