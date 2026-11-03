from typing import Optional
from pydantic import BaseModel, Field, computed_field, ConfigDict
from datetime import datetime


class TableCreate(BaseModel):
    table_number: str = Field(..., min_length=1, max_length=30)
    capacity: int = Field(default=4, ge=1, le=50)
    section: str = Field(default="Main Hall", max_length=50)
    display_order: int = Field(default=0)


class TableUpdate(BaseModel):
    table_number: Optional[str] = None
    capacity: Optional[int] = None
    section: Optional[str] = None
    status: Optional[str] = None
    current_order_id: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class TableTransferRequest(BaseModel):
    target_table_id: str = Field(..., min_length=1)


class TableStatsResponse(BaseModel):
    total_tables: int
    available_tables: int
    occupied_tables: int
    bill_pending_tables: int


class TableResponse(BaseModel):
    id: str
    restaurant_id: str
    table_number: str
    capacity: int
    section: str
    status: str
    current_order_id: Optional[str] = None
    is_active: bool = True
    display_order: int = 0
    created_at: datetime
    updated_at: datetime

    # Active order snapshot fields (populated when occupied)
    current_order_code: Optional[str] = None
    current_order_total_paise: Optional[int] = None
    current_order_paid_paise: Optional[int] = None
    current_order_due_paise: Optional[int] = None
    current_order_created_at: Optional[datetime] = None

    @computed_field
    def current_order_total_inr(self) -> Optional[float]:
        return self.current_order_total_paise / 100.0 if self.current_order_total_paise is not None else None

    @computed_field
    def current_order_due_inr(self) -> Optional[float]:
        return self.current_order_due_paise / 100.0 if self.current_order_due_paise is not None else None

    model_config = ConfigDict(from_attributes=True)
