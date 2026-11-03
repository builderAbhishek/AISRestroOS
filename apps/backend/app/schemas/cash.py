from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class ShiftOpenRequest(BaseModel):
    opening_cash_paise: int = Field(ge=0, description="Opening cash in paise")
    operator_name: str = Field(default="Cashier", min_length=1, max_length=100)
    opening_notes: Optional[str] = None


class ShiftCloseRequest(BaseModel):
    actual_closing_cash_paise: int = Field(ge=0, description="Actual counted cash in drawer in paise")
    closing_notes: Optional[str] = None
    closing_operator_name: Optional[str] = None


class CashInRequest(BaseModel):
    amount_paise: int = Field(gt=0, description="Amount in paise to add into drawer")
    category: str = Field(default="FLOAT_ADDITION", max_length=50)
    notes: Optional[str] = None
    operator_name: str = Field(default="Cashier", max_length=100)


class CashOutRequest(BaseModel):
    amount_paise: int = Field(gt=0, description="Amount in paise to withdraw from drawer")
    category: str = Field(default="BANK_DEPOSIT", max_length=50)
    notes: Optional[str] = None
    operator_name: str = Field(default="Cashier", max_length=100)


class ExpenseCreateRequest(BaseModel):
    category: str = Field(min_length=1, max_length=100)
    amount_paise: int = Field(gt=0)
    payment_method: str = Field(default="cash")  # cash | upi | card | other
    description: str = Field(min_length=1)
    recipient: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    expense_date: Optional[str] = None


class CashTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    shift_id: str
    transaction_type: str
    amount_paise: int
    balance_after_paise: int
    category: Optional[str] = None
    notes: Optional[str] = None
    operator_name: str
    reference_id: Optional[str] = None
    created_at: datetime


class ExpenseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    shift_id: Optional[str] = None
    category: str
    amount_paise: int
    payment_method: str
    description: str
    recipient: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    expense_date: datetime
    created_at: datetime


class CashRegisterShiftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    shift_number: int
    operator_name: str
    status: str
    opened_at: datetime
    closed_at: Optional[datetime] = None
    opening_cash_paise: int
    opening_notes: Optional[str] = None
    cash_sales_paise: int
    cash_in_paise: int
    cash_out_paise: int
    cash_expenses_paise: int
    cash_refunds_paise: int
    current_expected_cash_paise: int
    expected_closing_cash_paise: Optional[int] = None
    actual_closing_cash_paise: Optional[int] = None
    variance_paise: Optional[int] = None
    closing_notes: Optional[str] = None
    closing_operator_name: Optional[str] = None


class CashShiftDetailResponse(CashRegisterShiftResponse):
    transactions: List[CashTransactionResponse] = []
    expenses: List[ExpenseResponse] = []


class CashDashboardMetricsResponse(BaseModel):
    has_active_shift: bool
    active_shift: Optional[CashRegisterShiftResponse] = None
    today_cash_sales_paise: int
    today_cash_expenses_paise: int
    current_drawer_cash_paise: int
