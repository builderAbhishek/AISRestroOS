from typing import Optional, List
from pydantic import BaseModel, Field, computed_field, ConfigDict
from datetime import datetime


class OrderItemAddonInput(BaseModel):
    addon_id: Optional[str] = None
    addon_name: str
    price_paise: int = Field(default=0, ge=0)


class OrderItemAddonResponse(BaseModel):
    id: str
    addon_id: Optional[str]
    addon_name: str
    price_paise: int

    @computed_field
    def price_inr(self) -> float:
        return self.price_paise / 100.0

    model_config = ConfigDict(from_attributes=True)


class OrderItemInput(BaseModel):
    menu_item_id: str
    variant_id: Optional[str] = None
    quantity: int = Field(default=1, ge=1)
    notes: Optional[str] = None
    addons: List[OrderItemAddonInput] = []


class OrderItemResponse(BaseModel):
    id: str
    order_id: str
    menu_item_id: str
    variant_id: Optional[str]
    item_name: str
    variant_name: Optional[str]
    unit_price_paise: int
    quantity: int
    line_total_paise: int
    notes: Optional[str]
    kot_status: str
    printed_quantity: int
    addons: List[OrderItemAddonResponse] = []
    created_at: datetime

    @computed_field
    def unit_price_inr(self) -> float:
        return self.unit_price_paise / 100.0

    @computed_field
    def line_total_inr(self) -> float:
        return self.line_total_paise / 100.0

    model_config = ConfigDict(from_attributes=True)


class OrderCreate(BaseModel):
    order_type: str = Field(..., pattern="^(dine_in|takeaway|delivery)$")
    table_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    notes: Optional[str] = None
    discount_type: Optional[str] = Field(default=None, pattern="^(percentage|amount)?$")
    discount_value: float = Field(default=0.0, ge=0.0)
    items: List[OrderItemInput] = Field(..., min_length=1)


class OrderUpdateItems(BaseModel):
    items: List[OrderItemInput] = Field(..., min_length=1)
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    notes: Optional[str] = None


class OrderResponse(BaseModel):
    id: str
    restaurant_id: str
    order_number: int
    order_code: str
    order_type: str
    table_id: Optional[str]
    table_number_snapshot: Optional[str]
    customer_name: Optional[str]
    customer_phone: Optional[str]
    customer_address: Optional[str]
    status: str
    subtotal_paise: int
    discount_type: Optional[str]
    discount_value: float
    discount_paise: int
    tax_rate_percent: float
    cgst_paise: int
    sgst_paise: int
    tax_paise: int
    total_paise: int
    notes: Optional[str]
    items: List[OrderItemResponse] = []
    created_at: datetime
    updated_at: datetime

    @computed_field
    def subtotal_inr(self) -> float:
        return self.subtotal_paise / 100.0

    @computed_field
    def discount_inr(self) -> float:
        return self.discount_paise / 100.0

    @computed_field
    def cgst_inr(self) -> float:
        return self.cgst_paise / 100.0

    @computed_field
    def sgst_inr(self) -> float:
        return self.sgst_paise / 100.0

    @computed_field
    def tax_inr(self) -> float:
        return self.tax_paise / 100.0

    @computed_field
    def total_inr(self) -> float:
        return self.total_paise / 100.0

    model_config = ConfigDict(from_attributes=True)
