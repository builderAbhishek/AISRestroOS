from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


# --- Category ---
class InventoryCategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class InventoryCategoryCreate(InventoryCategoryBase):
    pass


class InventoryCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None


class InventoryCategoryResponse(InventoryCategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    restaurant_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# --- Supplier ---
class SupplierBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    gst_number: Optional[str] = None


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    gst_number: Optional[str] = None


class SupplierResponse(SupplierBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    restaurant_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# --- Inventory Item ---
class InventoryItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    sku: Optional[str] = None
    category_id: Optional[str] = None
    supplier_id: Optional[str] = None
    unit: str = Field(default="kg")
    current_stock: float = Field(default=0.0)
    minimum_stock: float = Field(default=0.0)
    reorder_level: float = Field(default=0.0)
    cost_per_unit_paise: int = Field(default=0, ge=0)
    is_active: bool = True
    notes: Optional[str] = None


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    sku: Optional[str] = None
    category_id: Optional[str] = None
    supplier_id: Optional[str] = None
    unit: Optional[str] = None
    minimum_stock: Optional[float] = None
    reorder_level: Optional[float] = None
    cost_per_unit_paise: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class InventoryItemResponse(InventoryItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    restaurant_id: str
    category_name: Optional[str] = None
    supplier_name: Optional[str] = None
    stock_value_paise: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# --- Purchases ---
class PurchaseItemInput(BaseModel):
    inventory_item_id: str
    quantity: float = Field(..., gt=0)
    unit: str = Field(...)
    unit_cost_paise: int = Field(..., ge=0)


class PurchaseItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    inventory_item_id: str
    item_name: Optional[str] = None
    quantity: float
    unit: str
    unit_cost_paise: int
    total_cost_paise: int


class SupplierPaymentInput(BaseModel):
    amount_paise: int = Field(..., gt=0)
    payment_method: str = Field(default="cash")
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class SupplierPaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    amount_paise: int
    payment_method: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class PurchaseCreate(BaseModel):
    supplier_id: Optional[str] = None
    invoice_number: Optional[str] = None
    purchase_date: Optional[str] = None
    notes: Optional[str] = None
    items: List[PurchaseItemInput] = Field(..., min_length=1)
    auto_receive: bool = False
    initial_payment: Optional[SupplierPaymentInput] = None


class PurchaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    restaurant_id: str
    purchase_number: str
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    invoice_number: Optional[str] = None
    purchase_date: Optional[datetime] = None
    status: str
    subtotal_paise: int
    tax_paise: int
    total_cost_paise: int
    paid_amount_paise: int
    due_amount_paise: int
    notes: Optional[str] = None
    items: List[PurchaseItemResponse] = []
    payments: List[SupplierPaymentResponse] = []
    created_at: Optional[datetime] = None


# --- Recipe ---
class RecipeIngredientInput(BaseModel):
    inventory_item_id: str
    quantity: float = Field(..., gt=0)
    unit: str = Field(...)


class RecipeIngredientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    inventory_item_id: str
    inventory_item_name: Optional[str] = None
    quantity: float
    unit: str
    cost_per_unit_paise: int = 0
    total_cost_paise: int = 0


class RecipeCreateOrUpdate(BaseModel):
    menu_item_id: str
    variant_id: Optional[str] = None
    notes: Optional[str] = None
    ingredients: List[RecipeIngredientInput] = Field(..., min_length=1)


class RecipeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    restaurant_id: str
    menu_item_id: str
    menu_item_name: Optional[str] = None
    variant_id: Optional[str] = None
    variant_name: Optional[str] = None
    notes: Optional[str] = None
    ingredients: List[RecipeIngredientResponse] = []
    total_cost_paise: int = 0
    created_at: Optional[datetime] = None


# --- Wastage & Adjustments ---
class WastageCreate(BaseModel):
    inventory_item_id: str
    quantity: float = Field(..., gt=0)
    unit: Optional[str] = None
    reason: str = Field(..., min_length=1)
    notes: Optional[str] = None


class WastageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    inventory_item_id: str
    item_name: Optional[str] = None
    quantity: float
    unit: Optional[str] = None
    cost_paise: int
    reason: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class StockAdjustmentCreate(BaseModel):
    inventory_item_id: str
    adjustment_type: str = Field(..., description="add, subtract, or set")
    quantity: float = Field(..., ge=0)
    reason: str = Field(..., min_length=1)
    notes: Optional[str] = None


class StockMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    inventory_item_id: str
    item_name: Optional[str] = None
    movement_type: str
    quantity_change: float
    quantity_after: float
    unit: Optional[str] = None
    unit_cost_paise: int
    total_cost_paise: int
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    reason: Optional[str] = None
    created_at: Optional[datetime] = None


# --- Inventory Dashboard Stats ---
class InventoryDashboardResponse(BaseModel):
    total_items: int
    total_stock_value_paise: int
    low_stock_count: int
    out_of_stock_count: int
    today_purchases_paise: int
    today_consumption_paise: int
    today_wastage_paise: int
    low_stock_items: List[InventoryItemResponse]
    recent_movements: List[StockMovementResponse]
    top_consumed_ingredients: List[dict]
