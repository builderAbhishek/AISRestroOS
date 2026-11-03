"""Add backup records, settings enhancements, and cash management

Revision ID: 20261103_004
Revises: 20261103_003
Create Date: 2026-11-03 17:15:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20261103_004'
down_revision: Union[str, None] = '20261103_003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing_tables = insp.get_table_names()

    # 1. Backup records
    if 'backup_records' not in existing_tables:
        op.create_table(
            'backup_records',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('restaurant_id', sa.String(length=36), nullable=False),
            sa.Column('filename', sa.String(length=255), nullable=False),
            sa.Column('file_path', sa.String(length=500), nullable=False),
            sa.Column('file_size_bytes', sa.Integer(), nullable=False, server_default="0"),
            sa.Column('backup_type', sa.String(length=30), nullable=False, server_default="manual"),
            sa.Column('status', sa.String(length=20), nullable=False, server_default="success"),
            sa.Column('duration_ms', sa.Integer(), nullable=False, server_default="0"),
            sa.Column('version', sa.String(length=20), nullable=False, server_default="1.0.0"),
            sa.Column('tables_count', sa.Integer(), nullable=False, server_default="0"),
            sa.Column('records_count', sa.Integer(), nullable=False, server_default="0"),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_backup_records_restaurant_id'), 'backup_records', ['restaurant_id'], unique=False)

    # 2. Cash register shifts
    if 'cash_register_shifts' not in existing_tables:
        op.create_table(
            'cash_register_shifts',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('restaurant_id', sa.String(length=36), nullable=False),
            sa.Column('shift_number', sa.Integer(), nullable=False),
            sa.Column('operator_name', sa.String(length=100), nullable=False, server_default="Cashier"),
            sa.Column('status', sa.String(length=20), nullable=False, server_default="open"),
            sa.Column('opened_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('opening_cash_paise', sa.Integer(), nullable=False, server_default="0"),
            sa.Column('opening_notes', sa.Text(), nullable=True),
            sa.Column('cash_sales_paise', sa.Integer(), nullable=False, server_default="0"),
            sa.Column('cash_in_paise', sa.Integer(), nullable=False, server_default="0"),
            sa.Column('cash_out_paise', sa.Integer(), nullable=False, server_default="0"),
            sa.Column('cash_expenses_paise', sa.Integer(), nullable=False, server_default="0"),
            sa.Column('cash_refunds_paise', sa.Integer(), nullable=False, server_default="0"),
            sa.Column('expected_closing_cash_paise', sa.Integer(), nullable=True),
            sa.Column('actual_closing_cash_paise', sa.Integer(), nullable=True),
            sa.Column('variance_paise', sa.Integer(), nullable=True),
            sa.Column('closing_notes', sa.Text(), nullable=True),
            sa.Column('closing_operator_name', sa.String(length=100), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['restaurant_id'], ['restaurants.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_cash_register_shifts_restaurant_id'), 'cash_register_shifts', ['restaurant_id'], unique=False)
        op.create_index(op.f('ix_cash_register_shifts_status'), 'cash_register_shifts', ['status'], unique=False)

    # 3. Cash transactions
    if 'cash_transactions' not in existing_tables:
        op.create_table(
            'cash_transactions',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('shift_id', sa.String(length=36), nullable=False),
            sa.Column('restaurant_id', sa.String(length=36), nullable=False),
            sa.Column('transaction_type', sa.String(length=30), nullable=False),
            sa.Column('amount_paise', sa.Integer(), nullable=False),
            sa.Column('balance_after_paise', sa.Integer(), nullable=False, server_default="0"),
            sa.Column('category', sa.String(length=50), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('operator_name', sa.String(length=100), nullable=False, server_default="Cashier"),
            sa.Column('reference_id', sa.String(length=100), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['shift_id'], ['cash_register_shifts.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_cash_transactions_shift_id'), 'cash_transactions', ['shift_id'], unique=False)
        op.create_index(op.f('ix_cash_transactions_restaurant_id'), 'cash_transactions', ['restaurant_id'], unique=False)
        op.create_index(op.f('ix_cash_transactions_transaction_type'), 'cash_transactions', ['transaction_type'], unique=False)

    # 4. Expenses
    if 'expenses' not in existing_tables:
        op.create_table(
            'expenses',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('restaurant_id', sa.String(length=36), nullable=False),
            sa.Column('shift_id', sa.String(length=36), nullable=True),
            sa.Column('category', sa.String(length=100), nullable=False),
            sa.Column('amount_paise', sa.Integer(), nullable=False),
            sa.Column('payment_method', sa.String(length=20), nullable=False, server_default="cash"),
            sa.Column('expense_date', sa.DateTime(timezone=True), nullable=False),
            sa.Column('description', sa.Text(), nullable=False),
            sa.Column('recipient', sa.String(length=100), nullable=True),
            sa.Column('reference_number', sa.String(length=100), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['restaurant_id'], ['restaurants.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['shift_id'], ['cash_register_shifts.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_expenses_restaurant_id'), 'expenses', ['restaurant_id'], unique=False)
        op.create_index(op.f('ix_expenses_shift_id'), 'expenses', ['shift_id'], unique=False)
        op.create_index(op.f('ix_expenses_category'), 'expenses', ['category'], unique=False)
        op.create_index(op.f('ix_expenses_payment_method'), 'expenses', ['payment_method'], unique=False)

    # 5. Alter restaurants table
    rest_cols = [c['name'] for c in insp.get_columns('restaurants')]
    with op.batch_alter_table('restaurants') as batch_op:
        if 'fssai_number' not in rest_cols:
            batch_op.add_column(sa.Column('fssai_number', sa.String(length=30), nullable=True))

    # 6. Alter restaurant_settings table
    settings_cols = [c['name'] for c in insp.get_columns('restaurant_settings')]
    with op.batch_alter_table('restaurant_settings') as batch_op:
        if 'show_logo_on_receipt' not in settings_cols:
            batch_op.add_column(sa.Column('show_logo_on_receipt', sa.Boolean(), nullable=False, server_default=sa.true()))
        if 'show_fssai_on_receipt' not in settings_cols:
            batch_op.add_column(sa.Column('show_fssai_on_receipt', sa.Boolean(), nullable=False, server_default=sa.true()))
        if 'show_gstin_on_receipt' not in settings_cols:
            batch_op.add_column(sa.Column('show_gstin_on_receipt', sa.Boolean(), nullable=False, server_default=sa.true()))
        if 'show_customer_info_on_receipt' not in settings_cols:
            batch_op.add_column(sa.Column('show_customer_info_on_receipt', sa.Boolean(), nullable=False, server_default=sa.true()))
        if 'show_tax_breakdown_on_receipt' not in settings_cols:
            batch_op.add_column(sa.Column('show_tax_breakdown_on_receipt', sa.Boolean(), nullable=False, server_default=sa.true()))
        if 'receipt_header_note' not in settings_cols:
            batch_op.add_column(sa.Column('receipt_header_note', sa.Text(), nullable=True))
        if 'auto_backup_enabled' not in settings_cols:
            batch_op.add_column(sa.Column('auto_backup_enabled', sa.Boolean(), nullable=False, server_default=sa.false()))
        if 'auto_backup_interval' not in settings_cols:
            batch_op.add_column(sa.Column('auto_backup_interval', sa.String(length=20), nullable=False, server_default="daily"))
        if 'auto_backup_time' not in settings_cols:
            batch_op.add_column(sa.Column('auto_backup_time', sa.String(length=10), nullable=False, server_default="23:00"))
        if 'auto_backup_path' not in settings_cols:
            batch_op.add_column(sa.Column('auto_backup_path', sa.String(length=255), nullable=True))
        if 'backup_retention_count' not in settings_cols:
            batch_op.add_column(sa.Column('backup_retention_count', sa.Integer(), nullable=False, server_default="15"))
        if 'last_backup_at' not in settings_cols:
            batch_op.add_column(sa.Column('last_backup_at', sa.String(length=40), nullable=True))
        if 'last_backup_status' not in settings_cols:
            batch_op.add_column(sa.Column('last_backup_status', sa.String(length=20), nullable=True))

    # 7. Alter payments and refunds table
    payment_cols = [c['name'] for c in insp.get_columns('payments')]
    with op.batch_alter_table('payments') as batch_op:
        if 'shift_id' not in payment_cols:
            batch_op.add_column(sa.Column('shift_id', sa.String(length=36), nullable=True))
            batch_op.create_index(batch_op.f('ix_payments_shift_id'), ['shift_id'], unique=False)

    refund_cols = [c['name'] for c in insp.get_columns('refunds')]
    with op.batch_alter_table('refunds') as batch_op:
        if 'shift_id' not in refund_cols:
            batch_op.add_column(sa.Column('shift_id', sa.String(length=36), nullable=True))
            batch_op.create_index(batch_op.f('ix_refunds_shift_id'), ['shift_id'], unique=False)


def downgrade() -> None:
    pass
