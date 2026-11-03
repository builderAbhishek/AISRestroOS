from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class TableCreate(BaseModel):
    table_number: str = Field(..., min_length=1, max_length=30)
    capacity: int = Field(default=4, ge=1, le=50)
    section: str = Field(default="Main Hall", max_length=50)


class TableUpdate(BaseModel):
    table_number: Optional[str] = None
    capacity: Optional[int] = None
    section: Optional[str] = None
    status: Optional[str] = None
    current_order_id: Optional[str] = None
    is_active: Optional[bool] = None


class TableResponse(BaseModel):
    id: str
    restaurant_id: str
    table_number: str
    capacity: int
    section: str
    status: str
    current_order_id: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
