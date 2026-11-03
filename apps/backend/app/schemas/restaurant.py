from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class RestaurantSettingsBase(BaseModel):
    is_tax_enabled: bool = Field(default=True)
    is_tax_inclusive: bool = Field(default=False)
    tax_rate_percent: float = Field(default=5.0, ge=0.0, le=100.0)
    tax_type: str = Field(default="CGST_SGST")
    order_types_json: str = Field(default='["dine_in", "takeaway", "delivery"]')
    kot_printer_name: Optional[str] = "Default"
    bill_printer_name: Optional[str] = "Default"
    paper_width_mm: int = Field(default=80, ge=40, le=120)
    invoice_prefix: str = Field(default="INV-")
    kot_prefix: str = Field(default="KOT-")
    bill_footer_text: str = Field(default="Thank you for dining with us! Please visit again.")
    auto_cut_paper: bool = True


class RestaurantSettingsUpdate(BaseModel):
    is_tax_enabled: Optional[bool] = None
    is_tax_inclusive: Optional[bool] = None
    tax_rate_percent: Optional[float] = None
    tax_type: Optional[str] = None
    paper_width_mm: Optional[int] = None
    invoice_prefix: Optional[str] = None
    kot_prefix: Optional[str] = None
    bill_footer_text: Optional[str] = None
    auto_cut_paper: Optional[bool] = None


class RestaurantSettingsResponse(RestaurantSettingsBase):
    id: str
    restaurant_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RestaurantSetupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    legal_name: Optional[str] = None
    owner_name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=5, max_length=20)
    email: Optional[str] = None
    address: str = Field(..., min_length=5)
    logo_url: Optional[str] = None
    currency: str = "INR"
    currency_symbol: str = "₹"
    language: str = "en"
    gst_registered: bool = False
    gstin: Optional[str] = None

    is_tax_enabled: bool = True
    is_tax_inclusive: bool = False
    tax_rate_percent: float = 5.0
    tax_type: str = "CGST_SGST"
    paper_width_mm: int = 80
    bill_footer_text: Optional[str] = None
    seed_sample_menu: bool = True


class RestaurantUpdateRequest(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    owner_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    currency: Optional[str] = None
    currency_symbol: Optional[str] = None
    language: Optional[str] = None
    gst_registered: Optional[bool] = None
    gstin: Optional[str] = None


class RestaurantResponse(BaseModel):
    id: str
    name: str
    legal_name: Optional[str]
    owner_name: str
    phone: str
    email: Optional[str]
    address: str
    logo_url: Optional[str]
    currency: str
    currency_symbol: str
    language: str
    gst_registered: bool
    gstin: Optional[str]
    settings: Optional[RestaurantSettingsResponse]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
