from typing import Optional, List
from sqlalchemy import String, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import TimestampedUUIDModel


class KOT(TimestampedUUIDModel):
    __tablename__ = "kots"

    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kot_number: Mapped[int] = mapped_column(Integer, nullable=False)
    kot_code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="generated", nullable=False)  # generated | printed | reprinted
    printer_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    order: Mapped["Order"] = relationship("Order", back_populates="kots")
    items: Mapped[List["KOTItem"]] = relationship(
        "KOTItem", back_populates="kot", cascade="all, delete-orphan"
    )


class KOTItem(TimestampedUUIDModel):
    __tablename__ = "kot_items"

    kot_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("kots.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("order_items.id", ondelete="CASCADE"), nullable=False
    )
    item_name: Mapped[str] = mapped_column(String(120), nullable=False)
    variant_name: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    addons_summary: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    kot: Mapped["KOT"] = relationship("KOT", back_populates="items")
