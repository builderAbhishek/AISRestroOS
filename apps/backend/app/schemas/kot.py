from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class KOTItemResponse(BaseModel):
    id: str
    order_item_id: str
    item_name: str
    variant_name: Optional[str]
    addons_summary: Optional[str]
    quantity: int
    notes: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class KOTResponse(BaseModel):
    id: str
    order_id: str
    kot_number: int
    kot_code: str
    status: str
    printer_name: Optional[str]
    created_at: datetime
    items: List[KOTItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class KOTPrintResult(BaseModel):
    kot: KOTResponse
    formatted_text: str
    is_new_items_printed: bool
    printer_status: str = "success"
    message: str
