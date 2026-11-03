from typing import Optional, List
from sqlalchemy import String, Boolean, Text, ForeignKey, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import TimestampedUUIDModel


class Restaurant(TimestampedUUIDModel):
    __tablename__ = "restaurants"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    legal_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    owner_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    logo_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    currency_symbol: Mapped[str] = mapped_column(String(5), default="₹", nullable=False)
    language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    gst_registered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    gstin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    fssai_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    # Relationships
    settings: Mapped[Optional["RestaurantSettings"]] = relationship(
        "RestaurantSettings", back_populates="restaurant", uselist=False, cascade="all, delete-orphan"
    )
    categories: Mapped[List["MenuCategory"]] = relationship(
        "MenuCategory", back_populates="restaurant", cascade="all, delete-orphan"
    )
    tables: Mapped[List["RestaurantTable"]] = relationship(
        "RestaurantTable", back_populates="restaurant", cascade="all, delete-orphan"
    )
    orders: Mapped[List["Order"]] = relationship(
        "Order", back_populates="restaurant", cascade="all, delete-orphan"
    )
    tax_configs: Mapped[List["TaxConfiguration"]] = relationship(
        "TaxConfiguration", back_populates="restaurant", cascade="all, delete-orphan"
    )


class RestaurantSettings(TimestampedUUIDModel):
    __tablename__ = "restaurant_settings"

    restaurant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    is_tax_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_tax_inclusive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tax_rate_percent: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    tax_type: Mapped[str] = mapped_column(String(20), default="CGST_SGST", nullable=False)
    order_types_json: Mapped[str] = mapped_column(
        Text, default='["dine_in", "takeaway", "delivery"]', nullable=False
    )
    kot_printer_name: Mapped[Optional[str]] = mapped_column(String(100), default="Default", nullable=True)
    bill_printer_name: Mapped[Optional[str]] = mapped_column(String(100), default="Default", nullable=True)
    paper_width_mm: Mapped[int] = mapped_column(Integer, default=80, nullable=False)
    invoice_prefix: Mapped[str] = mapped_column(String(10), default="INV-", nullable=False)
    kot_prefix: Mapped[str] = mapped_column(String(10), default="KOT-", nullable=False)
    bill_footer_text: Mapped[str] = mapped_column(
        Text, default="Thank you for dining with us! Please visit again.", nullable=False
    )
    auto_cut_paper: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    receipt_printer_type: Mapped[str] = mapped_column(String(30), default="thermal", nullable=False)
    default_print_format: Mapped[str] = mapped_column(String(20), default="80mm", nullable=False)

    # Receipt Customization
    show_logo_on_receipt: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    show_fssai_on_receipt: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    show_gstin_on_receipt: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    show_customer_info_on_receipt: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    show_tax_breakdown_on_receipt: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    receipt_header_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Automated Backup Settings
    auto_backup_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    auto_backup_interval: Mapped[str] = mapped_column(String(20), default="daily", nullable=False)
    auto_backup_time: Mapped[str] = mapped_column(String(10), default="23:00", nullable=False)
    auto_backup_path: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    backup_retention_count: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    last_backup_at: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    last_backup_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="settings")
