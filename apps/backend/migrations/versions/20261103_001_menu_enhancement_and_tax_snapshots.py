"""menu enhancement and tax snapshots

Revision ID: 20261103_001
Revises: 
Create Date: 2026-11-03 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20261103_001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. menu_categories
    with op.batch_alter_table('menu_categories', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_deleted', sa.Boolean(), server_default='0', nullable=False))

    # 2. menu_items
    with op.batch_alter_table('menu_items', schema=None) as batch_op:
        batch_op.add_column(sa.Column('item_type', sa.String(length=20), server_default='veg', nullable=False))
        batch_op.add_column(sa.Column('is_recommended', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('is_bestseller', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('is_tax_inclusive', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('tax_rate_override_percent', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('preparation_time_minutes', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('is_deleted', sa.Boolean(), server_default='0', nullable=False))

    # 3. restaurant_settings
    with op.batch_alter_table('restaurant_settings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_tax_enabled', sa.Boolean(), server_default='1', nullable=False))
        batch_op.add_column(sa.Column('is_tax_inclusive', sa.Boolean(), server_default='0', nullable=False))

    # 4. orders
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('tax_type', sa.String(length=20), server_default='CGST_SGST', nullable=False))
        batch_op.add_column(sa.Column('is_tax_inclusive', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('taxable_amount_paise', sa.Integer(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('igst_paise', sa.Integer(), server_default='0', nullable=False))

    # 5. invoices
    with op.batch_alter_table('invoices', schema=None) as batch_op:
        batch_op.add_column(sa.Column('tax_rate_percent', sa.Float(), server_default='0.0', nullable=False))
        batch_op.add_column(sa.Column('tax_type', sa.String(length=20), server_default='CGST_SGST', nullable=False))
        batch_op.add_column(sa.Column('is_tax_inclusive', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('taxable_amount_paise', sa.Integer(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('igst_paise', sa.Integer(), server_default='0', nullable=False))


def downgrade() -> None:
    with op.batch_alter_table('invoices', schema=None) as batch_op:
        batch_op.drop_column('igst_paise')
        batch_op.drop_column('taxable_amount_paise')
        batch_op.drop_column('is_tax_inclusive')
        batch_op.drop_column('tax_type')
        batch_op.drop_column('tax_rate_percent')

    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.drop_column('igst_paise')
        batch_op.drop_column('taxable_amount_paise')
        batch_op.drop_column('is_tax_inclusive')
        batch_op.drop_column('tax_type')

    with op.batch_alter_table('restaurant_settings', schema=None) as batch_op:
        batch_op.drop_column('is_tax_inclusive')
        batch_op.drop_column('is_tax_enabled')

    with op.batch_alter_table('menu_items', schema=None) as batch_op:
        batch_op.drop_column('is_deleted')
        batch_op.drop_column('preparation_time_minutes')
        batch_op.drop_column('tax_rate_override_percent')
        batch_op.drop_column('is_tax_inclusive')
        batch_op.drop_column('is_bestseller')
        batch_op.drop_column('is_recommended')
        batch_op.drop_column('item_type')

    with op.batch_alter_table('menu_categories', schema=None) as batch_op:
        batch_op.drop_column('is_deleted')
