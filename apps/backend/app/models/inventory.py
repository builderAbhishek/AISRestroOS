from typing import Optional, List
from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import TimestampedUUIDModel


class InventoryCategory(TimestampedUUIDModel):
    __tablename__ = "inventory_categories"

    restaurant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    restaurant: Mapped["Restaurant"] = relationship("Restaurant")
    items: Mapped[List["InventoryItem"]] = relationship(
        "InventoryItem", back_populates="category", cascade="all, delete-orphan"
    )


class Supplier(TimestampedUUIDModel):
    __tablename__ = "suppliers"

    restaurant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, default="")
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    @property
    def gst_number(self) -> Optional[str]:
        return self.gstin

    @gst_number.setter
    def gst_number(self, val: Optional[str]):
        self.gstin = val

    restaurant: Mapped["Restaurant"] = relationship("Restaurant")
    items: Mapped[List["InventoryItem"]] = relationship("InventoryItem", back_populates="supplier")
    purchases: Mapped[List["Purchase"]] = relationship("Purchase", back_populates="supplier")


class InventoryItem(TimestampedUUIDModel):
    __tablename__ = "inventory_items"

    restaurant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("inventory_categories.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    supplier_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True, index=True
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    sku: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    # Supported base units: kg, g, L, ml, pcs, packet, bottle, box
    unit: Mapped[str] = mapped_column(String(20), nullable=False, default="kg")
    current_stock: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    min_stock_level: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reorder_level: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # Stored in integer paise (weighted average cost per unit)
    cost_price_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    @property
    def minimum_stock(self) -> float:
        return self.min_stock_level

    @minimum_stock.setter
    def minimum_stock(self, val: float):
        self.min_stock_level = val

    @property
    def cost_per_unit_paise(self) -> int:
        return self.cost_price_paise

    @cost_per_unit_paise.setter
    def cost_per_unit_paise(self, val: int):
        self.cost_price_paise = val

    category: Mapped["InventoryCategory"] = relationship("InventoryCategory", back_populates="items")
    supplier: Mapped[Optional["Supplier"]] = relationship("Supplier", back_populates="items")
    stock_movements: Mapped[List["StockMovement"]] = relationship(
        "StockMovement", back_populates="inventory_item", cascade="all, delete-orphan", order_by="StockMovement.created_at.desc()"
    )
    recipe_ingredients: Mapped[List["RecipeIngredient"]] = relationship(
        "RecipeIngredient", back_populates="inventory_item"
    )
    wastage_records: Mapped[List["WastageRecord"]] = relationship(
        "WastageRecord", back_populates="inventory_item"
    )


class Purchase(TimestampedUUIDModel):
    __tablename__ = "purchases"

    restaurant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    supplier_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    purchase_number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    invoice_number: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    purchase_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Status: draft | received | cancelled
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False, index=True)
    # Payment status: unpaid | partially_paid | paid
    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid", nullable=False, index=True)

    # Financials in integer paise
    subtotal_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tax_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    discount_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    paid_amount_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    due_amount_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    @property
    def total_cost_paise(self) -> int:
        return self.total_paise

    @total_cost_paise.setter
    def total_cost_paise(self, val: int):
        self.total_paise = val

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    received_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="purchases")
    items: Mapped[List["PurchaseItem"]] = relationship(
        "PurchaseItem", back_populates="purchase", cascade="all, delete-orphan"
    )
    payments: Mapped[List["SupplierPayment"]] = relationship(
        "SupplierPayment", back_populates="purchase", cascade="all, delete-orphan", order_by="SupplierPayment.payment_date"
    )


class PurchaseItem(TimestampedUUIDModel):
    __tablename__ = "purchase_items"

    purchase_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inventory_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    unit_cost_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_rate_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tax_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    @property
    def total_cost_paise(self) -> int:
        return self.line_total_paise

    @total_cost_paise.setter
    def total_cost_paise(self, val: int):
        self.line_total_paise = val

    purchase: Mapped["Purchase"] = relationship("Purchase", back_populates="items")
    inventory_item: Mapped["InventoryItem"] = relationship("InventoryItem")


class SupplierPayment(TimestampedUUIDModel):
    __tablename__ = "supplier_payments"

    purchase_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), default="cash", nullable=False)  # cash | upi | card | bank_transfer | other
    payment_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reference_number: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    purchase: Mapped["Purchase"] = relationship("Purchase", back_populates="payments")


class StockMovement(TimestampedUUIDModel):
    __tablename__ = "stock_movements"

    restaurant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inventory_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Movement type: PURCHASE_IN | SALE_CONSUMPTION | WASTAGE | MANUAL_ADJUSTMENT_IN | MANUAL_ADJUSTMENT_OUT | PURCHASE_RETURN | SALE_REVERSAL
    movement_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    previous_stock: Mapped[float] = mapped_column(Float, nullable=False)
    new_stock: Mapped[float] = mapped_column(Float, nullable=False)

    unit_cost_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_cost_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    reference_type: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)  # order | purchase | wastage | manual_adjustment
    reference_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    reference_code: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    @property
    def quantity_change(self) -> float:
        return self.quantity

    @quantity_change.setter
    def quantity_change(self, val: float):
        self.quantity = val

    @property
    def quantity_after(self) -> float:
        return self.new_stock

    @quantity_after.setter
    def quantity_after(self, val: float):
        self.new_stock = val

    inventory_item: Mapped["InventoryItem"] = relationship("InventoryItem", back_populates="stock_movements")


class Recipe(TimestampedUUIDModel):
    __tablename__ = "recipes"

    restaurant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    menu_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    variant_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("menu_variants.id", ondelete="CASCADE"), nullable=True, index=True
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    @property
    def notes(self) -> Optional[str]:
        return self.description

    @notes.setter
    def notes(self, val: Optional[str]):
        self.description = val

    menu_item: Mapped["MenuItem"] = relationship("MenuItem")
    variant: Mapped[Optional["MenuVariant"]] = relationship("MenuVariant")
    ingredients: Mapped[List["RecipeIngredient"]] = relationship(
        "RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan"
    )


class RecipeIngredient(TimestampedUUIDModel):
    __tablename__ = "recipe_ingredients"

    recipe_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inventory_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    is_optional: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    recipe: Mapped["Recipe"] = relationship("Recipe", back_populates="ingredients")
    inventory_item: Mapped["InventoryItem"] = relationship("InventoryItem", back_populates="recipe_ingredients")


class WastageRecord(TimestampedUUIDModel):
    __tablename__ = "wastage_records"

    restaurant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inventory_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    cost_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reason: Mapped[str] = mapped_column(String(100), nullable=False)  # expired | spoilage | preparation_waste | spillage | quality_check | other
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    inventory_item: Mapped["InventoryItem"] = relationship("InventoryItem", back_populates="wastage_records")
