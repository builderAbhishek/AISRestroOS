from typing import Optional, List
from pydantic import BaseModel, Field, computed_field, ConfigDict
from datetime import datetime


class PaymentInput(BaseModel):
    payment_method: str = Field(..., pattern="^(cash|upi|card|other)$")
    amount_paise: int = Field(..., gt=0)
    tendered_amount_paise: Optional[int] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    id: str
    invoice_id: str
    order_id: str
    payment_method: str
    amount_paise: int
    tendered_amount_paise: Optional[int]
    change_due_paise: Optional[int]
    reference_number: Optional[str]
    notes: Optional[str]
    created_at: datetime

    @computed_field
    def amount_inr(self) -> float:
        return self.amount_paise / 100.0

    @computed_field
    def change_due_inr(self) -> Optional[float]:
        return self.change_due_paise / 100.0 if self.change_due_paise is not None else None

    model_config = ConfigDict(from_attributes=True)


class InvoiceResponse(BaseModel):
    id: str
    order_id: str
    invoice_number: str
    subtotal_paise: int
    discount_paise: int
    taxable_amount_paise: int = 0
    tax_rate_percent: float = 0.0
    tax_type: str = "CGST_SGST"
    is_tax_inclusive: bool = False
    cgst_paise: int
    sgst_paise: int
    igst_paise: int = 0
    total_tax_paise: int
    grand_total_paise: int
    rounded_paise: int
    status: str
    paid_amount_paise: int
    due_amount_paise: int
    payments: List[PaymentResponse] = []
    created_at: datetime

    @computed_field
    def subtotal_inr(self) -> float:
        return self.subtotal_paise / 100.0

    @computed_field
    def discount_inr(self) -> float:
        return self.discount_paise / 100.0

    @computed_field
    def taxable_amount_inr(self) -> float:
        return self.taxable_amount_paise / 100.0

    @computed_field
    def cgst_inr(self) -> float:
        return self.cgst_paise / 100.0

    @computed_field
    def sgst_inr(self) -> float:
        return self.sgst_paise / 100.0

    @computed_field
    def igst_inr(self) -> float:
        return self.igst_paise / 100.0

    @computed_field
    def total_tax_inr(self) -> float:
        return self.total_tax_paise / 100.0

    @computed_field
    def grand_total_inr(self) -> float:
        return self.grand_total_paise / 100.0

    @computed_field
    def paid_amount_inr(self) -> float:
        return self.paid_amount_paise / 100.0

    @computed_field
    def due_amount_inr(self) -> float:
        return self.due_amount_paise / 100.0

    model_config = ConfigDict(from_attributes=True)


class SettlementRequest(BaseModel):
    payments: List[PaymentInput] = Field(..., min_length=1)
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None


class SettlementResponse(BaseModel):
    invoice: InvoiceResponse
    order_id: str
    order_status: str
    receipt_text: str
    message: str


class BillCalculationResponse(BaseModel):
    subtotal_paise: int
    discount_paise: int
    taxable_amount_paise: int = 0
    cgst_paise: int
    sgst_paise: int
    igst_paise: int = 0
    total_tax_paise: int
    grand_total_paise: int
    tax_rate_percent: float
    tax_type: str = "CGST_SGST"
    is_tax_inclusive: bool = False

    @computed_field
    def subtotal_inr(self) -> float:
        return self.subtotal_paise / 100.0

    @computed_field
    def discount_inr(self) -> float:
        return self.discount_paise / 100.0

    @computed_field
    def taxable_amount_inr(self) -> float:
        return self.taxable_amount_paise / 100.0

    @computed_field
    def cgst_inr(self) -> float:
        return self.cgst_paise / 100.0

    @computed_field
    def sgst_inr(self) -> float:
        return self.sgst_paise / 100.0

    @computed_field
    def igst_inr(self) -> float:
        return self.igst_paise / 100.0

    @computed_field
    def total_tax_inr(self) -> float:
        return self.total_tax_paise / 100.0

    @computed_field
    def grand_total_inr(self) -> float:
        return self.grand_total_paise / 100.0
