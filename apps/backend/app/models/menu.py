from typing import Optional, List
from sqlalchemy import String, Boolean, Text, ForeignKey, Integer, Float, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import TimestampedUUIDModel, Base

item_addon_group_association = Table(
    "item_addon_group_association",
    Base.metadata,
    Column("menu_item_id", String(36), ForeignKey("menu_items.id", ondelete="CASCADE"), primary_key=True),
    Column("addon_group_id", String(36), ForeignKey("addon_groups.id", ondelete="CASCADE"), primary_key=True),
)


class MenuCategory(TimestampedUUIDModel):
    __tablename__ = "menu_categories"

    restaurant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="categories")
    items: Mapped[List["MenuItem"]] = relationship(
        "MenuItem", back_populates="category", cascade="all, delete-orphan", order_by="MenuItem.sort_order"
    )


class MenuItem(TimestampedUUIDModel):
    __tablename__ = "menu_items"

    restaurant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("menu_categories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    item_code: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Price stored in integer paise (e.g. ₹150.00 = 15000 paise)
    base_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    is_veg: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    item_type: Mapped[str] = mapped_column(String(20), default="veg", nullable=False)  # veg | non_veg | egg
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_recommended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_bestseller: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_tax_inclusive: Mapped[Optional[bool]] = mapped_column(Boolean, default=None, nullable=True)
    tax_rate_override_percent: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    preparation_time_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    has_variants: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    category: Mapped["MenuCategory"] = relationship("MenuCategory", back_populates="items")
    variants: Mapped[List["MenuVariant"]] = relationship(
        "MenuVariant", back_populates="item", cascade="all, delete-orphan"
    )
    addon_groups: Mapped[List["AddonGroup"]] = relationship(
        "AddonGroup", secondary=item_addon_group_association, back_populates="menu_items"
    )


class MenuVariant(TimestampedUUIDModel):
    __tablename__ = "menu_variants"

    item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)  # e.g., "Regular", "Large", "Half", "Full"
    price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    item: Mapped["MenuItem"] = relationship("MenuItem", back_populates="variants")


class AddonGroup(TimestampedUUIDModel):
    __tablename__ = "addon_groups"

    restaurant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)  # e.g. "Choose Crust", "Extra Toppings"
    min_selection: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_selection: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    addons: Mapped[List["Addon"]] = relationship(
        "Addon", back_populates="group", cascade="all, delete-orphan"
    )
    menu_items: Mapped[List["MenuItem"]] = relationship(
        "MenuItem", secondary=item_addon_group_association, back_populates="addon_groups"
    )


class Addon(TimestampedUUIDModel):
    __tablename__ = "addons"

    addon_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("addon_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    price_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    group: Mapped["AddonGroup"] = relationship("AddonGroup", back_populates="addons")
