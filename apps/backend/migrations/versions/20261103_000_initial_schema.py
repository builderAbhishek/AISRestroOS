"""initial schema

Revision ID: 20261103_000
Revises: 
Create Date: 2026-11-03 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20261103_000'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. restaurants
    if 'restaurants' not in existing_tables:
        op.create_table(
            'restaurants',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('name', sa.String(length=120), nullable=False),
            sa.Column('legal_name', sa.String(length=150), nullable=True),
            sa.Column('owner_name', sa.String(length=100), nullable=False),
            sa.Column('phone', sa.String(length=20), nullable=False),
            sa.Column('email', sa.String(length=100), nullable=True),
            sa.Column('address', sa.Text(), nullable=False),
            sa.Column('logo_url', sa.String(length=255), nullable=True),
            sa.Column('currency', sa.String(length=10), server_default='INR', nullable=False),
            sa.Column('currency_symbol', sa.String(length=5), server_default='₹', nullable=False),
            sa.Column('language', sa.String(length=10), server_default='en', nullable=False),
            sa.Column('gst_registered', sa.Boolean(), server_default='0', nullable=False),
            sa.Column('gstin', sa.String(length=20), nullable=True),
        )

    # 2. restaurant_settings
    if 'restaurant_settings' not in existing_tables:
        op.create_table(
            'restaurant_settings',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('restaurant_id', sa.String(length=36), sa.ForeignKey('restaurants.id', ondelete='CASCADE'), unique=True, nullable=False),
            sa.Column('tax_rate_percent', sa.Float(), server_default='5.0', nullable=False),
            sa.Column('tax_type', sa.String(length=20), server_default='CGST_SGST', nullable=False),
            sa.Column('order_types_json', sa.Text(), server_default='["dine_in", "takeaway", "delivery"]', nullable=False),
            sa.Column('kot_printer_name', sa.String(length=100), server_default='Default', nullable=True),
            sa.Column('bill_printer_name', sa.String(length=100), server_default='Default', nullable=True),
            sa.Column('paper_width_mm', sa.Integer(), server_default='80', nullable=False),
            sa.Column('invoice_prefix', sa.String(length=10), server_default='INV-', nullable=False),
            sa.Column('kot_prefix', sa.String(length=10), server_default='KOT-', nullable=False),
            sa.Column('bill_footer_text', sa.Text(), server_default='Thank you for dining with us! Please visit again.', nullable=False),
            sa.Column('auto_cut_paper', sa.Boolean(), server_default='1', nullable=False),
        )

    # 3. tax_configurations
    if 'tax_configurations' not in existing_tables:
        op.create_table(
            'tax_configurations',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('restaurant_id', sa.String(length=36), sa.ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('name', sa.String(length=80), nullable=False),
            sa.Column('rate_percent', sa.Float(), nullable=False),
            sa.Column('cgst_percent', sa.Float(), server_default='0.0', nullable=False),
            sa.Column('sgst_percent', sa.Float(), server_default='0.0', nullable=False),
            sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
        )

    # 4. menu_categories
    if 'menu_categories' not in existing_tables:
        op.create_table(
            'menu_categories',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('restaurant_id', sa.String(length=36), sa.ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('name', sa.String(length=80), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
            sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
        )
        op.create_index('ix_menu_categories_restaurant_id', 'menu_categories', ['restaurant_id'])

    # 5. menu_items
    if 'menu_items' not in existing_tables:
        op.create_table(
            'menu_items',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('restaurant_id', sa.String(length=36), sa.ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('category_id', sa.String(length=36), sa.ForeignKey('menu_categories.id', ondelete='CASCADE'), nullable=False),
            sa.Column('name', sa.String(length=120), nullable=False),
            sa.Column('item_code', sa.String(length=30), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('base_price_paise', sa.Integer(), nullable=False),
            sa.Column('is_veg', sa.Boolean(), server_default='1', nullable=False),
            sa.Column('is_available', sa.Boolean(), server_default='1', nullable=False),
            sa.Column('has_variants', sa.Boolean(), server_default='0', nullable=False),
            sa.Column('image_url', sa.String(length=255), nullable=True),
            sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        )
        op.create_index('ix_menu_items_restaurant_id', 'menu_items', ['restaurant_id'])
        op.create_index('ix_menu_items_category_id', 'menu_items', ['category_id'])
        op.create_index('ix_menu_items_name', 'menu_items', ['name'])
        op.create_index('ix_menu_items_item_code', 'menu_items', ['item_code'])

    # 6. menu_variants
    if 'menu_variants' not in existing_tables:
        op.create_table(
            'menu_variants',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('item_id', sa.String(length=36), sa.ForeignKey('menu_items.id', ondelete='CASCADE'), nullable=False),
            sa.Column('name', sa.String(length=80), nullable=False),
            sa.Column('price_paise', sa.Integer(), nullable=False),
            sa.Column('is_default', sa.Boolean(), server_default='0', nullable=False),
            sa.Column('is_available', sa.Boolean(), server_default='1', nullable=False),
        )
        op.create_index('ix_menu_variants_item_id', 'menu_variants', ['item_id'])

    # 7. addon_groups
    if 'addon_groups' not in existing_tables:
        op.create_table(
            'addon_groups',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('restaurant_id', sa.String(length=36), sa.ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('name', sa.String(length=80), nullable=False),
            sa.Column('min_selection', sa.Integer(), server_default='0', nullable=False),
            sa.Column('max_selection', sa.Integer(), server_default='1', nullable=False),
            sa.Column('is_required', sa.Boolean(), server_default='0', nullable=False),
        )
        op.create_index('ix_addon_groups_restaurant_id', 'addon_groups', ['restaurant_id'])

    # 8. addons
    if 'addons' not in existing_tables:
        op.create_table(
            'addons',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('addon_group_id', sa.String(length=36), sa.ForeignKey('addon_groups.id', ondelete='CASCADE'), nullable=False),
            sa.Column('name', sa.String(length=80), nullable=False),
            sa.Column('price_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('is_available', sa.Boolean(), server_default='1', nullable=False),
        )
        op.create_index('ix_addons_addon_group_id', 'addons', ['addon_group_id'])

    # 9. item_addon_group_association
    if 'item_addon_group_association' not in existing_tables:
        op.create_table(
            'item_addon_group_association',
            sa.Column('menu_item_id', sa.String(length=36), sa.ForeignKey('menu_items.id', ondelete='CASCADE'), primary_key=True),
            sa.Column('addon_group_id', sa.String(length=36), sa.ForeignKey('addon_groups.id', ondelete='CASCADE'), primary_key=True),
        )

    # 10. restaurant_tables
    if 'restaurant_tables' not in existing_tables:
        op.create_table(
            'restaurant_tables',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('restaurant_id', sa.String(length=36), sa.ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('table_number', sa.String(length=20), nullable=False),
            sa.Column('capacity', sa.Integer(), server_default='4', nullable=False),
            sa.Column('section', sa.String(length=50), server_default='Main Dining', nullable=False),
            sa.Column('status', sa.String(length=20), server_default='available', nullable=False),
            sa.Column('current_order_id', sa.String(length=36), nullable=True),
            sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
        )
        op.create_index('ix_restaurant_tables_restaurant_id', 'restaurant_tables', ['restaurant_id'])
        op.create_index('ix_restaurant_tables_table_number', 'restaurant_tables', ['table_number'])

    # 11. orders
    if 'orders' not in existing_tables:
        op.create_table(
            'orders',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('restaurant_id', sa.String(length=36), sa.ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('order_number', sa.Integer(), nullable=False),
            sa.Column('order_code', sa.String(length=30), nullable=False),
            sa.Column('order_type', sa.String(length=20), server_default='dine_in', nullable=False),
            sa.Column('table_id', sa.String(length=36), sa.ForeignKey('restaurant_tables.id', ondelete='SET NULL'), nullable=True),
            sa.Column('table_number_snapshot', sa.String(length=20), nullable=True),
            sa.Column('customer_name', sa.String(length=100), nullable=True),
            sa.Column('customer_phone', sa.String(length=20), nullable=True),
            sa.Column('customer_address', sa.Text(), nullable=True),
            sa.Column('status', sa.String(length=20), server_default='active', nullable=False),
            sa.Column('subtotal_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('discount_type', sa.String(length=20), nullable=True),
            sa.Column('discount_value', sa.Float(), server_default='0.0', nullable=False),
            sa.Column('discount_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('tax_rate_percent', sa.Float(), server_default='0.0', nullable=False),
            sa.Column('cgst_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('sgst_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('tax_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('total_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
        )
        op.create_index('ix_orders_restaurant_id', 'orders', ['restaurant_id'])
        op.create_index('ix_orders_order_code', 'orders', ['order_code'])
        op.create_index('ix_orders_status', 'orders', ['status'])

    # 12. order_items
    if 'order_items' not in existing_tables:
        op.create_table(
            'order_items',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('order_id', sa.String(length=36), sa.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False),
            sa.Column('menu_item_id', sa.String(length=36), sa.ForeignKey('menu_items.id', ondelete='RESTRICT'), nullable=False),
            sa.Column('variant_id', sa.String(length=36), sa.ForeignKey('menu_variants.id', ondelete='SET NULL'), nullable=True),
            sa.Column('item_name', sa.String(length=120), nullable=False),
            sa.Column('variant_name', sa.String(length=80), nullable=True),
            sa.Column('unit_price_paise', sa.Integer(), nullable=False),
            sa.Column('quantity', sa.Integer(), server_default='1', nullable=False),
            sa.Column('line_total_paise', sa.Integer(), nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('kot_status', sa.String(length=20), server_default='pending', nullable=False),
            sa.Column('printed_quantity', sa.Integer(), server_default='0', nullable=False),
        )
        op.create_index('ix_order_items_order_id', 'order_items', ['order_id'])

    # 13. order_item_addons
    if 'order_item_addons' not in existing_tables:
        op.create_table(
            'order_item_addons',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('order_item_id', sa.String(length=36), sa.ForeignKey('order_items.id', ondelete='CASCADE'), nullable=False),
            sa.Column('addon_id', sa.String(length=36), sa.ForeignKey('addons.id', ondelete='RESTRICT'), nullable=False),
            sa.Column('addon_name', sa.String(length=80), nullable=False),
            sa.Column('price_paise', sa.Integer(), server_default='0', nullable=False),
        )
        op.create_index('ix_order_item_addons_order_item_id', 'order_item_addons', ['order_item_id'])

    # 14. kots
    if 'kots' not in existing_tables:
        op.create_table(
            'kots',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('order_id', sa.String(length=36), sa.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False),
            sa.Column('kot_number', sa.Integer(), nullable=False),
            sa.Column('kot_code', sa.String(length=30), nullable=False),
            sa.Column('status', sa.String(length=20), server_default='generated', nullable=False),
            sa.Column('printer_name', sa.String(length=100), nullable=True),
        )
        op.create_index('ix_kots_order_id', 'kots', ['order_id'])
        op.create_index('ix_kots_kot_code', 'kots', ['kot_code'])

    # 15. kot_items
    if 'kot_items' not in existing_tables:
        op.create_table(
            'kot_items',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('kot_id', sa.String(length=36), sa.ForeignKey('kots.id', ondelete='CASCADE'), nullable=False),
            sa.Column('order_item_id', sa.String(length=36), sa.ForeignKey('order_items.id', ondelete='CASCADE'), nullable=False),
            sa.Column('item_name', sa.String(length=120), nullable=False),
            sa.Column('variant_name', sa.String(length=80), nullable=True),
            sa.Column('addons_summary', sa.String(length=255), nullable=True),
            sa.Column('quantity', sa.Integer(), nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
        )
        op.create_index('ix_kot_items_kot_id', 'kot_items', ['kot_id'])

    # 16. invoices
    if 'invoices' not in existing_tables:
        op.create_table(
            'invoices',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('order_id', sa.String(length=36), sa.ForeignKey('orders.id', ondelete='CASCADE'), unique=True, nullable=False),
            sa.Column('invoice_number', sa.String(length=30), unique=True, nullable=False),
            sa.Column('subtotal_paise', sa.Integer(), nullable=False),
            sa.Column('discount_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('cgst_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('sgst_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('total_tax_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('grand_total_paise', sa.Integer(), nullable=False),
            sa.Column('rounded_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('status', sa.String(length=20), server_default='unpaid', nullable=False),
            sa.Column('paid_amount_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('due_amount_paise', sa.Integer(), nullable=False),
        )
        op.create_index('ix_invoices_order_id', 'invoices', ['order_id'])
        op.create_index('ix_invoices_invoice_number', 'invoices', ['invoice_number'])
        op.create_index('ix_invoices_status', 'invoices', ['status'])

    # 17. payments
    if 'payments' not in existing_tables:
        op.create_table(
            'payments',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('invoice_id', sa.String(length=36), sa.ForeignKey('invoices.id', ondelete='CASCADE'), nullable=False),
            sa.Column('order_id', sa.String(length=36), sa.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False),
            sa.Column('payment_method', sa.String(length=20), nullable=False),
            sa.Column('amount_paise', sa.Integer(), nullable=False),
            sa.Column('tendered_amount_paise', sa.Integer(), nullable=True),
            sa.Column('change_due_paise', sa.Integer(), nullable=True),
            sa.Column('reference_number', sa.String(length=100), nullable=True),
            sa.Column('notes', sa.String(length=255), nullable=True),
        )
        op.create_index('ix_payments_invoice_id', 'payments', ['invoice_id'])
        op.create_index('ix_payments_order_id', 'payments', ['order_id'])


def downgrade() -> None:
    pass
