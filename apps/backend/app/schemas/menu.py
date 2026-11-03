from typing import Optional, List
from pydantic import BaseModel, Field, computed_field, ConfigDict
from datetime import datetime


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class CategoryResponse(CategoryBase):
    id: str
    restaurant_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AddonCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    price_paise: int = Field(default=0, ge=0)
    is_available: bool = True


class AddonResponse(AddonCreate):
    id: str
    addon_group_id: str

    @computed_field
    def price_inr(self) -> float:
        return self.price_paise / 100.0

    model_config = ConfigDict(from_attributes=True)


class AddonGroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    min_selection: int = 0
    max_selection: int = 5
    is_required: bool = False
    addons: List[AddonCreate] = []


class AddonGroupResponse(BaseModel):
    id: str
    name: str
    min_selection: int
    max_selection: int
    is_required: bool
    addons: List[AddonResponse] = []

    model_config = ConfigDict(from_attributes=True)


class VariantCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    price_paise: int = Field(..., ge=0)
    is_default: bool = False
    is_available: bool = True


class VariantResponse(VariantCreate):
    id: str
    item_id: str

    @computed_field
    def price_inr(self) -> float:
        return self.price_paise / 100.0

    model_config = ConfigDict(from_attributes=True)


class CategoryReorderItem(BaseModel):
    id: str
    sort_order: int


class CategoryReorderRequest(BaseModel):
    items: List[CategoryReorderItem]


class MenuItemCreate(BaseModel):
    category_id: str
    name: str = Field(..., min_length=1, max_length=120)
    item_code: Optional[str] = None
    description: Optional[str] = None
    base_price_paise: int = Field(..., ge=0)
    is_veg: bool = True
    item_type: str = Field(default="veg", pattern="^(veg|non_veg|egg)$")
    is_available: bool = True
    is_recommended: bool = False
    is_bestseller: bool = False
    is_tax_inclusive: Optional[bool] = None
    tax_rate_override_percent: Optional[float] = None
    preparation_time_minutes: Optional[int] = None
    has_variants: bool = False
    image_url: Optional[str] = None
    sort_order: int = 0
    variants: Optional[List[VariantCreate]] = None
    addon_group_ids: Optional[List[str]] = None


class MenuItemUpdate(BaseModel):
    category_id: Optional[str] = None
    name: Optional[str] = None
    item_code: Optional[str] = None
    description: Optional[str] = None
    base_price_paise: Optional[int] = None
    is_veg: Optional[bool] = None
    item_type: Optional[str] = None
    is_available: Optional[bool] = None
    is_recommended: Optional[bool] = None
    is_bestseller: Optional[bool] = None
    is_tax_inclusive: Optional[bool] = None
    tax_rate_override_percent: Optional[float] = None
    preparation_time_minutes: Optional[int] = None
    has_variants: Optional[bool] = None
    image_url: Optional[str] = None
    sort_order: Optional[int] = None
    variants: Optional[List[VariantCreate]] = None
    addon_group_ids: Optional[List[str]] = None


class MenuItemResponse(BaseModel):
    id: str
    restaurant_id: str
    category_id: str
    name: str
    item_code: Optional[str]
    description: Optional[str]
    base_price_paise: int
    is_veg: bool
    item_type: str = "veg"
    is_available: bool
    is_recommended: bool = False
    is_bestseller: bool = False
    is_tax_inclusive: Optional[bool] = None
    tax_rate_override_percent: Optional[float] = None
    preparation_time_minutes: Optional[int] = None
    has_variants: bool
    image_url: Optional[str]
    sort_order: int
    variants: List[VariantResponse] = []
    addon_groups: List[AddonGroupResponse] = []
    created_at: datetime
    updated_at: datetime

    @computed_field
    def base_price_inr(self) -> float:
        return self.base_price_paise / 100.0

    model_config = ConfigDict(from_attributes=True)
