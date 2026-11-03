from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.models.cash import CashRegisterShift, CashTransaction, Expense
from app.models.billing import Payment, Refund
from app.core.exceptions import AISRestroException, PaymentValidationException
from app.core.logging import logger


def get_active_shift(db: Session, restaurant_id: str) -> Optional[CashRegisterShift]:
    """Returns the currently open cash shift for the restaurant, if any."""
    return (
        db.query(CashRegisterShift)
        .filter(
            CashRegisterShift.restaurant_id == restaurant_id,
            CashRegisterShift.status == "open",
        )
        .first()
    )


def open_shift(
    db: Session,
    restaurant_id: str,
    opening_cash_paise: int,
    operator_name: str = "Cashier",
    opening_notes: Optional[str] = None,
) -> CashRegisterShift:
    """
    Opens a new cash shift.
    Prevents duplicate open shifts.
    Records opening float in the cash transaction ledger.
    """
    if opening_cash_paise < 0:
        raise PaymentValidationException("Opening cash amount cannot be negative.")

    existing_active = get_active_shift(db, restaurant_id)
    if existing_active:
        raise AISRestroException(
            f"Shift #{existing_active.shift_number} is already open. Please close it before opening a new shift."
        )

    last_number = (
        db.query(func.max(CashRegisterShift.shift_number))
        .filter(CashRegisterShift.restaurant_id == restaurant_id)
        .scalar()
        or 0
    )
    shift_number = last_number + 1

    shift = CashRegisterShift(
        restaurant_id=restaurant_id,
        shift_number=shift_number,
        operator_name=operator_name.strip() or "Cashier",
        status="open",
        opening_cash_paise=opening_cash_paise,
        opening_notes=opening_notes.strip() if opening_notes else None,
        cash_sales_paise=0,
        cash_in_paise=0,
        cash_out_paise=0,
        cash_expenses_paise=0,
        cash_refunds_paise=0,
    )
    db.add(shift)
    db.flush()

    if opening_cash_paise > 0:
        tx = CashTransaction(
            shift_id=shift.id,
            restaurant_id=restaurant_id,
            transaction_type="CASH_IN",
            amount_paise=opening_cash_paise,
            balance_after_paise=opening_cash_paise,
            category="OPENING_FLOAT",
            notes="Opening cash float",
            operator_name=shift.operator_name,
        )
        db.add(tx)

    db.commit()
    db.refresh(shift)
    logger.info(f"Opened Cash Shift #{shift.shift_number} with float ₹{opening_cash_paise / 100:.2f}")
    return shift


def record_cash_in(
    db: Session,
    shift_id: str,
    restaurant_id: str,
    amount_paise: int,
    category: str = "MANUAL_ADDITION",
    notes: Optional[str] = None,
    operator_name: str = "Cashier",
) -> CashTransaction:
    """Records manual cash injection into the drawer."""
    if amount_paise <= 0:
        raise PaymentValidationException("Cash in amount must be greater than zero.")

    shift = db.query(CashRegisterShift).filter(
        CashRegisterShift.id == shift_id,
        CashRegisterShift.restaurant_id == restaurant_id,
    ).first()

    if not shift or shift.status != "open":
        raise AISRestroException("Cannot add cash: Shift is not open or does not exist.")

    shift.cash_in_paise += amount_paise
    balance_after = shift.current_expected_cash_paise

    tx = CashTransaction(
        shift_id=shift.id,
        restaurant_id=restaurant_id,
        transaction_type="CASH_IN",
        amount_paise=amount_paise,
        balance_after_paise=balance_after,
        category=category,
        notes=notes,
        operator_name=operator_name,
    )
    db.add(tx)
    db.commit()
    db.refresh(shift)
    db.refresh(tx)
    return tx


def record_cash_out(
    db: Session,
    shift_id: str,
    restaurant_id: str,
    amount_paise: int,
    category: str = "MANUAL_WITHDRAWAL",
    notes: Optional[str] = None,
    operator_name: str = "Cashier",
) -> CashTransaction:
    """Records manual cash withdrawal from the drawer. Cannot exceed available cash."""
    if amount_paise <= 0:
        raise PaymentValidationException("Cash out amount must be greater than zero.")

    shift = db.query(CashRegisterShift).filter(
        CashRegisterShift.id == shift_id,
        CashRegisterShift.restaurant_id == restaurant_id,
    ).first()

    if not shift or shift.status != "open":
        raise AISRestroException("Cannot withdraw cash: Shift is not open or does not exist.")

    current_cash = shift.current_expected_cash_paise
    if amount_paise > current_cash:
        raise PaymentValidationException(
            f"Cash out amount (₹{amount_paise / 100:.2f}) exceeds current register balance (₹{current_cash / 100:.2f})."
        )

    shift.cash_out_paise += amount_paise
    balance_after = shift.current_expected_cash_paise

    tx = CashTransaction(
        shift_id=shift.id,
        restaurant_id=restaurant_id,
        transaction_type="CASH_OUT",
        amount_paise=amount_paise,
        balance_after_paise=balance_after,
        category=category,
        notes=notes,
        operator_name=operator_name,
    )
    db.add(tx)
    db.commit()
    db.refresh(shift)
    db.refresh(tx)
    return tx


def record_cash_sale(
    db: Session,
    shift: CashRegisterShift,
    amount_paise: int,
    order_id: str,
    payment_id: str,
    notes: Optional[str] = None,
) -> CashTransaction:
    """Called automatically upon POS cash settlement."""
    shift.cash_sales_paise += amount_paise
    balance_after = shift.current_expected_cash_paise

    tx = CashTransaction(
        shift_id=shift.id,
        restaurant_id=shift.restaurant_id,
        transaction_type="CASH_SALE",
        amount_paise=amount_paise,
        balance_after_paise=balance_after,
        category="ORDER_PAYMENT",
        notes=notes or f"Cash payment for order",
        operator_name=shift.operator_name,
        reference_id=order_id,
    )
    db.add(tx)
    return tx


def record_cash_refund(
    db: Session,
    shift: CashRegisterShift,
    amount_paise: int,
    order_id: str,
    refund_id: str,
    notes: Optional[str] = None,
) -> CashTransaction:
    """Called automatically upon cash refund."""
    shift.cash_refunds_paise += amount_paise
    balance_after = shift.current_expected_cash_paise

    tx = CashTransaction(
        shift_id=shift.id,
        restaurant_id=shift.restaurant_id,
        transaction_type="CASH_REFUND",
        amount_paise=amount_paise,
        balance_after_paise=balance_after,
        category="ORDER_REFUND",
        notes=notes or f"Cash refund for order",
        operator_name=shift.operator_name,
        reference_id=order_id,
    )
    db.add(tx)
    return tx


def record_expense(
    db: Session,
    restaurant_id: str,
    category: str,
    amount_paise: int,
    payment_method: str = "cash",
    description: str = "",
    recipient: Optional[str] = None,
    reference_number: Optional[str] = None,
    notes: Optional[str] = None,
    expense_date: Optional[datetime] = None,
) -> Expense:
    """
    Records an expense.
    If paid in cash:
      - Validates against active shift balance (if shift open).
      - Decrements drawer cash by adding to shift.cash_expenses_paise.
      - Logs CASH_EXPENSE in audit ledger.
    If paid via UPI/Card/Other:
      - Physical cash is unaffected.
    """
    if amount_paise <= 0:
        raise PaymentValidationException("Expense amount must be greater than zero.")

    method = payment_method.lower().strip()
    active_shift = get_active_shift(db, restaurant_id)

    if method == "cash" and active_shift:
        current_cash = active_shift.current_expected_cash_paise
        if amount_paise > current_cash:
            raise PaymentValidationException(
                f"Cash expense (₹{amount_paise / 100:.2f}) exceeds current cash register balance (₹{current_cash / 100:.2f})."
            )
        active_shift.cash_expenses_paise += amount_paise

    expense = Expense(
        restaurant_id=restaurant_id,
        shift_id=active_shift.id if (method == "cash" and active_shift) else None,
        category=category.strip(),
        amount_paise=amount_paise,
        payment_method=method,
        expense_date=expense_date or datetime.now(timezone.utc),
        description=description.strip(),
        recipient=recipient.strip() if recipient else None,
        reference_number=reference_number.strip() if reference_number else None,
        notes=notes.strip() if notes else None,
    )
    db.add(expense)
    db.flush()

    if method == "cash" and active_shift:
        tx = CashTransaction(
            shift_id=active_shift.id,
            restaurant_id=restaurant_id,
            transaction_type="CASH_EXPENSE",
            amount_paise=amount_paise,
            balance_after_paise=active_shift.current_expected_cash_paise,
            category=f"EXPENSE: {category}",
            notes=description,
            operator_name=active_shift.operator_name,
            reference_id=expense.id,
        )
        db.add(tx)

    db.commit()
    db.refresh(expense)
    return expense


def close_shift(
    db: Session,
    shift_id: str,
    restaurant_id: str,
    actual_closing_cash_paise: int,
    closing_notes: Optional[str] = None,
    closing_operator_name: Optional[str] = None,
) -> CashRegisterShift:
    """
    Reconciles and closes an active shift.
    Formula:
      Expected Cash = Opening Cash + Cash Sales + Cash In - Cash Out - Cash Expenses - Cash Refunds
      Variance = Actual Cash - Expected Cash
    Closed shift is marked immutable.
    """
    if actual_closing_cash_paise < 0:
        raise PaymentValidationException("Counted cash cannot be negative.")

    shift = db.query(CashRegisterShift).filter(
        CashRegisterShift.id == shift_id,
        CashRegisterShift.restaurant_id == restaurant_id,
    ).first()

    if not shift:
        raise AISRestroException("Shift not found.")
    if shift.status == "closed":
        raise AISRestroException(f"Shift #{shift.shift_number} is already closed.")

    expected = shift.current_expected_cash_paise
    variance = actual_closing_cash_paise - expected

    shift.expected_closing_cash_paise = expected
    shift.actual_closing_cash_paise = actual_closing_cash_paise
    shift.variance_paise = variance
    shift.closing_notes = closing_notes.strip() if closing_notes else None
    shift.closing_operator_name = (closing_operator_name or shift.operator_name).strip()
    shift.status = "closed"
    shift.closed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(shift)
    logger.info(
        f"Closed Shift #{shift.shift_number}: Expected ₹{expected / 100:.2f}, "
        f"Actual ₹{actual_closing_cash_paise / 100:.2f}, Variance ₹{variance / 100:.2f}"
    )
    return shift


def list_shifts(
    db: Session,
    restaurant_id: str,
    limit: int = 50,
    offset: int = 0,
) -> List[CashRegisterShift]:
    """Returns shift history ordered by opened_at descending."""
    return (
        db.query(CashRegisterShift)
        .filter(CashRegisterShift.restaurant_id == restaurant_id)
        .order_by(desc(CashRegisterShift.opened_at))
        .offset(offset)
        .limit(limit)
        .all()
    )


def list_expenses(
    db: Session,
    restaurant_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category: Optional[str] = None,
    payment_method: Optional[str] = None,
) -> List[Expense]:
    """Filtered list of expenses."""
    q = db.query(Expense).filter(Expense.restaurant_id == restaurant_id)
    if start_date:
        q = q.filter(Expense.expense_date >= start_date)
    if end_date:
        q = q.filter(Expense.expense_date <= end_date)
    if category and category != "all":
        q = q.filter(Expense.category == category)
    if payment_method and payment_method != "all":
        q = q.filter(Expense.payment_method == payment_method.lower())
    return q.order_by(desc(Expense.expense_date)).all()
