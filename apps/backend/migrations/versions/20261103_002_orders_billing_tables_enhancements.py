"""orders billing tables enhancements

Revision ID: 20261103_002
Revises: 20261103_001
Create Date: 2026-11-03 11:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20261103_002'
down_revision: Union[str, None] = '20261103_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. orders: payment_status, paid_amount_paise, due_amount_paise, cancellation fields
    order_cols = [c['name'] for c in inspector.get_columns('orders')]
    with op.batch_alter_table('orders', schema=None) as batch_op:
        if 'payment_status' not in order_cols:
            batch_op.add_column(sa.Column('payment_status', sa.String(length=20), server_default='unpaid', nullable=False))
            batch_op.create_index('ix_orders_payment_status', ['payment_status'])
        if 'paid_amount_paise' not in order_cols:
            batch_op.add_column(sa.Column('paid_amount_paise', sa.Integer(), server_default='0', nullable=False))
        if 'due_amount_paise' not in order_cols:
            batch_op.add_column(sa.Column('due_amount_paise', sa.Integer(), server_default='0', nullable=False))
        if 'cancellation_reason' not in order_cols:
            batch_op.add_column(sa.Column('cancellation_reason', sa.Text(), nullable=True))
        if 'cancelled_at' not in order_cols:
            batch_op.add_column(sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True))

    # 2. restaurant_tables: display_order
    table_cols = [c['name'] for c in inspector.get_columns('restaurant_tables')]
    with op.batch_alter_table('restaurant_tables', schema=None) as batch_op:
        if 'display_order' not in table_cols:
            batch_op.add_column(sa.Column('display_order', sa.Integer(), server_default='0', nullable=False))

    # 3. restaurant_settings: receipt_printer_type, default_print_format
    settings_cols = [c['name'] for c in inspector.get_columns('restaurant_settings')]
    with op.batch_alter_table('restaurant_settings', schema=None) as batch_op:
        if 'receipt_printer_type' not in settings_cols:
            batch_op.add_column(sa.Column('receipt_printer_type', sa.String(length=30), server_default='thermal', nullable=False))
        if 'default_print_format' not in settings_cols:
            batch_op.add_column(sa.Column('default_print_format', sa.String(length=20), server_default='80mm', nullable=False))

    # 4. Create refunds table if not exists
    if 'refunds' not in existing_tables:
        op.create_table(
            'refunds',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('invoice_id', sa.String(length=36), sa.ForeignKey('invoices.id', ondelete='CASCADE'), nullable=False),
            sa.Column('order_id', sa.String(length=36), sa.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False),
            sa.Column('amount_paise', sa.Integer(), nullable=False),
            sa.Column('reason', sa.String(length=255), nullable=False),
            sa.Column('payment_method', sa.String(length=20), server_default='original', nullable=False),
            sa.Column('reference_number', sa.String(length=100), nullable=True),
        )
        op.create_index('ix_refunds_invoice_id', 'refunds', ['invoice_id'])
        op.create_index('ix_refunds_order_id', 'refunds', ['order_id'])

    # 5. Create print_jobs table if not exists
    if 'print_jobs' not in existing_tables:
        op.create_table(
            'print_jobs',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('restaurant_id', sa.String(length=36), sa.ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('order_id', sa.String(length=36), nullable=True),
            sa.Column('invoice_id', sa.String(length=36), nullable=True),
            sa.Column('job_type', sa.String(length=20), nullable=False),
            sa.Column('printer_name', sa.String(length=100), nullable=True),
            sa.Column('paper_format', sa.String(length=20), server_default='80mm', nullable=False),
            sa.Column('status', sa.String(length=20), server_default='success', nullable=False),
            sa.Column('content_preview', sa.Text(), nullable=True),
            sa.Column('error_message', sa.Text(), nullable=True),
        )
        op.create_index('ix_print_jobs_restaurant_id', 'print_jobs', ['restaurant_id'])
        op.create_index('ix_print_jobs_order_id', 'print_jobs', ['order_id'])
        op.create_index('ix_print_jobs_invoice_id', 'print_jobs', ['invoice_id'])


def downgrade() -> None:
    op.drop_table('print_jobs')
    op.drop_table('refunds')

    with op.batch_alter_table('restaurant_settings', schema=None) as batch_op:
        batch_op.drop_column('default_print_format')
        batch_op.drop_column('receipt_printer_type')

    with op.batch_alter_table('restaurant_tables', schema=None) as batch_op:
        batch_op.drop_column('display_order')

    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.drop_index('ix_orders_payment_status')
        batch_op.drop_column('cancelled_at')
        batch_op.drop_column('cancellation_reason')
        batch_op.drop_column('due_amount_paise')
        batch_op.drop_column('paid_amount_paise')
        batch_op.drop_column('payment_status')
