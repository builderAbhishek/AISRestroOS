from typing import Optional, List
from datetime import datetime
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import TimestampedUUIDModel


class CashRegisterShift(TimestampedUUIDModel):
    __tablename__ = "cash_register_shifts"

    restaurant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    shift_number: Mapped[int] = mapped_column(Integer, nullable=False)
    operator_name: Mapped[str] = mapped_column(String(100), default="Cashier", nullable=False)
    # status: open | closed
    status: Mapped[str] = mapped_column(String(20), default="open", nullable=False, index=True)

    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    opening_cash_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    opening_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Aggregated shift movements
    cash_sales_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cash_in_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cash_out_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cash_expenses_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cash_refunds_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Closing reconciliation
    expected_closing_cash_paise: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    actual_closing_cash_paise: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    variance_paise: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # actual - expected
    closing_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    closing_operator_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    transactions: Mapped[List["CashTransaction"]] = relationship(
        "CashTransaction", back_populates="shift", cascade="all, delete-orphan", order_by="CashTransaction.created_at"
    )
    expenses: Mapped[List["Expense"]] = relationship(
        "Expense", back_populates="shift"
    )

    @property
    def current_expected_cash_paise(self) -> int:
        """Dynamically computes the live expected cash in the drawer."""
        return (
            self.opening_cash_paise
            + self.cash_sales_paise
            + self.cash_in_paise
            - self.cash_out_paise
            - self.cash_expenses_paise
            - self.cash_refunds_paise
        )


class CashTransaction(TimestampedUUIDModel):
    __tablename__ = "cash_transactions"

    shift_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cash_register_shifts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    restaurant_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    # transaction_type: CASH_IN | CASH_OUT | CASH_SALE | CASH_REFUND | CASH_EXPENSE | CASH_CORRECTION
    transaction_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)  # always positive
    balance_after_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    operator_name: Mapped[str] = mapped_column(String(100), default="Cashier", nullable=False)
    reference_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    shift: Mapped["CashRegisterShift"] = relationship("CashRegisterShift", back_populates="transactions")


class Expense(TimestampedUUIDModel):
    __tablename__ = "expenses"

    restaurant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    shift_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("cash_register_shifts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    # payment_method: cash | upi | card | other
    payment_method: Mapped[str] = mapped_column(String(20), default="cash", nullable=False, index=True)
    expense_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    recipient: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    shift: Mapped[Optional["CashRegisterShift"]] = relationship("CashRegisterShift", back_populates="expenses")
