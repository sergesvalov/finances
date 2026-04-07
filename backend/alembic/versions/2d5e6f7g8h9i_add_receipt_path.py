"""add receipt_path to transactions

Revision ID: 2d5e6f7g8h9i
Revises: 1c4d5e6f7g8h
Create Date: 2026-04-07 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2d5e6f7g8h9i'
down_revision = '1c4d5e6f7g8h'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('transactions',
        sa.Column('receipt_path', sa.String(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('transactions', 'receipt_path')
