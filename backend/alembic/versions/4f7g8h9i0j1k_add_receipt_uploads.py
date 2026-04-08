"""add receipt_uploads table

Revision ID: 4f7g8h9i0j1k
Revises: 3e6f7g8h9i0j
Create Date: 2026-04-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '4f7g8h9i0j1k'
down_revision = '3e6f7g8h9i0j'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'receipt_uploads',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(), nullable=False),
        sa.Column('telegram_chat_id', sa.String(), nullable=True),
        sa.Column('original_filename', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_receipt_uploads_id', 'receipt_uploads', ['id'])
    op.create_index('ix_receipt_uploads_session_id', 'receipt_uploads', ['session_id'])
    op.create_index('ix_receipt_uploads_uploaded_at', 'receipt_uploads', ['uploaded_at'])


def downgrade() -> None:
    op.drop_index('ix_receipt_uploads_uploaded_at', table_name='receipt_uploads')
    op.drop_index('ix_receipt_uploads_session_id', table_name='receipt_uploads')
    op.drop_index('ix_receipt_uploads_id', table_name='receipt_uploads')
    op.drop_table('receipt_uploads')
