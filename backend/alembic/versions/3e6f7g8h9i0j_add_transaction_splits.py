"""add transaction_splits table

Revision ID: 3e6f7g8h9i0j
Revises: 2d5e6f7g8h9i
Create Date: 2026-04-07 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '3e6f7g8h9i0j'
down_revision = '2d5e6f7g8h9i'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'transaction_splits',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('transaction_id', sa.Integer(), sa.ForeignKey('transactions.id'), nullable=False),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('categories.id'), nullable=True),
        sa.Column('amount', sa.Numeric(), nullable=False),
        sa.Column('note', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_transaction_splits_transaction_id', 'transaction_splits', ['transaction_id'])


def downgrade() -> None:
    op.drop_index('ix_transaction_splits_transaction_id', table_name='transaction_splits')
    op.drop_table('transaction_splits')
