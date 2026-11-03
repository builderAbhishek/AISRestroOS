"""inventory and reports models

Revision ID: 20261103_003
Revises: 20261103_002
Create Date: 2026-11-03 14:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20261103_003'
down_revision: Union[str, None] = '20261103_002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. inventory_categories
    if 'inventory_categories' not in existing_tables:
        op.create_table(
            'inventory_categories',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('restaurant_id', sa.String(length=36), sa.ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('name', sa.String(length=80), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index('ix_inventory_categories_restaurant_id', 'inventory_categories', ['restaurant_id'])
        op.create_index('ix_inventory_categories_name', 'inventory_categories', ['name'])

    # 2. suppliers
    if 'suppliers' not in existing_tables:
        op.create_table(
            'suppliers',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('restaurant_id', sa.String(length=36), sa.ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.Column('contact_person', sa.String(length=100), nullable=True),
            sa.Column('phone', sa.String(length=20), nullable=False),
            sa.Column('email', sa.String(length=100), nullable=True),
            sa.Column('address', sa.Text(), nullable=True),
            sa.Column('gstin', sa.String(length=20), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index('ix_suppliers_restaurant_id', 'suppliers', ['restaurant_id'])
        op.create_index('ix_suppliers_name', 'suppliers', ['name'])

    # 3. inventory_items
    if 'inventory_items' not in existing_tables:
        op.create_table(
            'inventory_items',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('restaurant_id', sa.String(length=36), sa.ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('category_id', sa.String(length=36), sa.ForeignKey('inventory_categories.id', ondelete='RESTRICT'), nullable=False),
            sa.Column('supplier_id', sa.String(length=36), sa.ForeignKey('suppliers.id', ondelete='SET NULL'), nullable=True),
            sa.Column('name', sa.String(length=120), nullable=False),
            sa.Column('sku', sa.String(length=50), nullable=True),
            sa.Column('unit', sa.String(length=20), server_default='kg', nullable=False),
            sa.Column('current_stock', sa.Float(), server_default='0.0', nullable=False),
            sa.Column('min_stock_level', sa.Float(), server_default='0.0', nullable=False),
            sa.Column('reorder_level', sa.Float(), server_default='0.0', nullable=False),
            sa.Column('cost_price_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index('ix_inventory_items_restaurant_id', 'inventory_items', ['restaurant_id'])
        op.create_index('ix_inventory_items_category_id', 'inventory_items', ['category_id'])
        op.create_index('ix_inventory_items_supplier_id', 'inventory_items', ['supplier_id'])
        op.create_index('ix_inventory_items_name', 'inventory_items', ['name'])
        op.create_index('ix_inventory_items_sku', 'inventory_items', ['sku'])

    # 4. purchases
    if 'purchases' not in existing_tables:
        op.create_table(
            'purchases',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('restaurant_id', sa.String(length=36), sa.ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('supplier_id', sa.String(length=36), sa.ForeignKey('suppliers.id', ondelete='RESTRICT'), nullable=False),
            sa.Column('purchase_number', sa.String(length=40), nullable=False),
            sa.Column('invoice_number', sa.String(length=80), nullable=True),
            sa.Column('purchase_date', sa.DateTime(timezone=True), nullable=False),
            sa.Column('status', sa.String(length=20), server_default='draft', nullable=False),
            sa.Column('payment_status', sa.String(length=20), server_default='unpaid', nullable=False),
            sa.Column('subtotal_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('tax_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('discount_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('total_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('paid_amount_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('due_amount_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('received_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('cancellation_reason', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index('ix_purchases_restaurant_id', 'purchases', ['restaurant_id'])
        op.create_index('ix_purchases_supplier_id', 'purchases', ['supplier_id'])
        op.create_index('ix_purchases_purchase_number', 'purchases', ['purchase_number'])
        op.create_index('ix_purchases_status', 'purchases', ['status'])
        op.create_index('ix_purchases_payment_status', 'purchases', ['payment_status'])

    # 5. purchase_items
    if 'purchase_items' not in existing_tables:
        op.create_table(
            'purchase_items',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('purchase_id', sa.String(length=36), sa.ForeignKey('purchases.id', ondelete='CASCADE'), nullable=False),
            sa.Column('inventory_item_id', sa.String(length=36), sa.ForeignKey('inventory_items.id', ondelete='RESTRICT'), nullable=False),
            sa.Column('quantity', sa.Float(), nullable=False),
            sa.Column('unit', sa.String(length=20), nullable=False),
            sa.Column('unit_cost_paise', sa.Integer(), nullable=False),
            sa.Column('line_total_paise', sa.Integer(), nullable=False),
            sa.Column('tax_rate_percent', sa.Float(), server_default='0.0', nullable=False),
            sa.Column('tax_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index('ix_purchase_items_purchase_id', 'purchase_items', ['purchase_id'])
        op.create_index('ix_purchase_items_inventory_item_id', 'purchase_items', ['inventory_item_id'])

    # 6. supplier_payments
    if 'supplier_payments' not in existing_tables:
        op.create_table(
            'supplier_payments',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('purchase_id', sa.String(length=36), sa.ForeignKey('purchases.id', ondelete='CASCADE'), nullable=False),
            sa.Column('amount_paise', sa.Integer(), nullable=False),
            sa.Column('payment_method', sa.String(length=20), server_default='cash', nullable=False),
            sa.Column('payment_date', sa.DateTime(timezone=True), nullable=False),
            sa.Column('reference_number', sa.String(length=80), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index('ix_supplier_payments_purchase_id', 'supplier_payments', ['purchase_id'])

    # 7. stock_movements
    if 'stock_movements' not in existing_tables:
        op.create_table(
            'stock_movements',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('restaurant_id', sa.String(length=36), sa.ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('inventory_item_id', sa.String(length=36), sa.ForeignKey('inventory_items.id', ondelete='CASCADE'), nullable=False),
            sa.Column('movement_type', sa.String(length=30), nullable=False),
            sa.Column('quantity', sa.Float(), nullable=False),
            sa.Column('unit', sa.String(length=20), nullable=False),
            sa.Column('previous_stock', sa.Float(), nullable=False),
            sa.Column('new_stock', sa.Float(), nullable=False),
            sa.Column('unit_cost_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('total_cost_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('reference_type', sa.String(length=30), nullable=True),
            sa.Column('reference_id', sa.String(length=36), nullable=True),
            sa.Column('reference_code', sa.String(length=40), nullable=True),
            sa.Column('reason', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index('ix_stock_movements_restaurant_id', 'stock_movements', ['restaurant_id'])
        op.create_index('ix_stock_movements_inventory_item_id', 'stock_movements', ['inventory_item_id'])
        op.create_index('ix_stock_movements_movement_type', 'stock_movements', ['movement_type'])
        op.create_index('ix_stock_movements_reference_id', 'stock_movements', ['reference_id'])

    # 8. recipes
    if 'recipes' not in existing_tables:
        op.create_table(
            'recipes',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('restaurant_id', sa.String(length=36), sa.ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('menu_item_id', sa.String(length=36), sa.ForeignKey('menu_items.id', ondelete='CASCADE'), nullable=False),
            sa.Column('variant_id', sa.String(length=36), sa.ForeignKey('menu_variants.id', ondelete='CASCADE'), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index('ix_recipes_restaurant_id', 'recipes', ['restaurant_id'])
        op.create_index('ix_recipes_menu_item_id', 'recipes', ['menu_item_id'])
        op.create_index('ix_recipes_variant_id', 'recipes', ['variant_id'])

    # 9. recipe_ingredients
    if 'recipe_ingredients' not in existing_tables:
        op.create_table(
            'recipe_ingredients',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('recipe_id', sa.String(length=36), sa.ForeignKey('recipes.id', ondelete='CASCADE'), nullable=False),
            sa.Column('inventory_item_id', sa.String(length=36), sa.ForeignKey('inventory_items.id', ondelete='RESTRICT'), nullable=False),
            sa.Column('quantity', sa.Float(), nullable=False),
            sa.Column('unit', sa.String(length=20), nullable=False),
            sa.Column('is_optional', sa.Boolean(), server_default='0', nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index('ix_recipe_ingredients_recipe_id', 'recipe_ingredients', ['recipe_id'])
        op.create_index('ix_recipe_ingredients_inventory_item_id', 'recipe_ingredients', ['inventory_item_id'])

    # 10. wastage_records
    if 'wastage_records' not in existing_tables:
        op.create_table(
            'wastage_records',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('restaurant_id', sa.String(length=36), sa.ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('inventory_item_id', sa.String(length=36), sa.ForeignKey('inventory_items.id', ondelete='RESTRICT'), nullable=False),
            sa.Column('quantity', sa.Float(), nullable=False),
            sa.Column('unit', sa.String(length=20), nullable=False),
            sa.Column('cost_paise', sa.Integer(), server_default='0', nullable=False),
            sa.Column('reason', sa.String(length=100), nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index('ix_wastage_records_restaurant_id', 'wastage_records', ['restaurant_id'])
        op.create_index('ix_wastage_records_inventory_item_id', 'wastage_records', ['inventory_item_id'])


def downgrade() -> None:
    pass
