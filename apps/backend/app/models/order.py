from typing import Optional, List
from sqlalchemy import String, Integer, Float, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import TimestampedUUIDModel


class Order(TimestampedUUIDModel):
    __tablename__ = "orders"

    restaurant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    order_code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    
    # Order type: dine_in | takeaway | delivery
    order_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    table_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("restaurant_tables.id", ondelete="SET NULL"), nullable=True, index=True
    )
    table_number_snapshot: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    customer_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    customer_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Status: active | completed | cancelled
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False, index=True)

    # Money in integer paise
    subtotal_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    discount_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # percentage | amount
    discount_value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    discount_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    tax_rate_percent: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    cgst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sgst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tax_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="orders")
    items: Mapped[List["OrderItem"]] = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan", order_by="OrderItem.created_at"
    )
    kots: Mapped[List["KOT"]] = relationship(
        "KOT", back_populates="order", cascade="all, delete-orphan", order_by="KOT.kot_number"
    )
    invoice: Mapped[Optional["Invoice"]] = relationship(
        "Invoice", back_populates="order", uselist=False, cascade="all, delete-orphan"
    )


class OrderItem(TimestampedUUIDModel):
    __tablename__ = "order_items"

    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    menu_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("menu_items.id", ondelete="RESTRICT"), nullable=False
    )
    variant_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("menu_variants.id", ondelete="SET NULL"), nullable=True
    )

    # Snapshots for immutability
    item_name: Mapped[str] = mapped_column(String(120), nullable=False)
    variant_name: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    unit_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    line_total_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # KOT tracking: how many units of this item have already been sent to kitchen
    kot_status: Mapped[str] = mapped_column(String(20), default="unprinted", nullable=False)  # unprinted | printed
    printed_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    order: Mapped["Order"] = relationship("Order", back_populates="items")
    addons: Mapped[List["OrderItemAddon"]] = relationship(
        "OrderItemAddon", back_populates="order_item", cascade="all, delete-orphan"
    )


class OrderItemAddon(TimestampedUUIDModel):
    __tablename__ = "order_item_addons"

    order_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("order_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    addon_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    addon_name: Mapped[str] = mapped_column(String(80), nullable=False)
    price_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    order_item: Mapped["OrderItem"] = relationship("OrderItem", back_populates="addons")
