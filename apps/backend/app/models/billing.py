from typing import Optional, List
from sqlalchemy import String, Integer, Float, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import TimestampedUUIDModel


class Invoice(TimestampedUUIDModel):
    __tablename__ = "invoices"

    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("orders.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    invoice_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)

    subtotal_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    taxable_amount_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tax_rate_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tax_type: Mapped[str] = mapped_column(String(20), default="CGST_SGST", nullable=False)
    is_tax_inclusive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cgst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sgst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    igst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_tax_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    grand_total_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    rounded_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Status: unpaid | partially_paid | paid
    status: Mapped[str] = mapped_column(String(20), default="unpaid", nullable=False, index=True)
    paid_amount_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    due_amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)

    order: Mapped["Order"] = relationship("Order", back_populates="invoice")
    payments: Mapped[List["Payment"]] = relationship(
        "Payment", back_populates="invoice", cascade="all, delete-orphan", order_by="Payment.created_at"
    )


class Payment(TimestampedUUIDModel):
    __tablename__ = "payments"

    invoice_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Payment method: cash | upi | card | other
    payment_method: Mapped[str] = mapped_column(String(20), nullable=False)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    tendered_amount_paise: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    change_due_paise: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="payments")
