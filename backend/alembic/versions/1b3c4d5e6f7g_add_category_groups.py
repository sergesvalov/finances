"""add category groups

Revision ID: 1b3c4d5e6f7g
Revises: 1a2b3c4d5e6f
Create Date: 2026-03-28 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1b3c4d5e6f7g'
down_revision = '1a2b3c4d5e6f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    groups_table = op.create_table('category_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_category_groups_id'), 'category_groups', ['id'], unique=False)
    op.create_index(op.f('ix_category_groups_name'), 'category_groups', ['name'], unique=True)

    op.add_column('categories', sa.Column('group_id', sa.Integer(), nullable=True))
    # It passes with postgres
    op.create_foreign_key('fk_category_group', 'categories', 'category_groups', ['group_id'], ['id'])

    # Seed
    op.bulk_insert(groups_table, [
        {'id': 1, 'name': 'Food'},
        {'id': 2, 'name': 'Bills'},
        {'id': 3, 'name': 'Other expenses'}
    ])

    op.execute("UPDATE categories SET group_id = 1 WHERE lower(trim(name)) IN ('delivery', 'smart', 'proteas bakery', 'sklavenitis', 'food', 'supermarket', 'groceries', 'restaurants', 'cafe')")
    op.execute("UPDATE categories SET group_id = 2 WHERE lower(trim(name)) IN ('phone', 'internet', 'car gas', 'bills', 'utilities', 'gas', 'electricity', 'water', 'rent')")
    op.execute("UPDATE categories SET group_id = 3 WHERE group_id IS NULL AND lower(trim(name)) != 'uncategorized'")


def downgrade() -> None:
    op.drop_constraint('fk_category_group', 'categories', type_='foreignkey')
    op.drop_column('categories', 'group_id')
    op.drop_index(op.f('ix_category_groups_name'), table_name='category_groups')
    op.drop_index(op.f('ix_category_groups_id'), table_name='category_groups')
    op.drop_table('category_groups')
