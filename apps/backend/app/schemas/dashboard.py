from typing import List, Optional
from pydantic import BaseModel, computed_field


class KPICards(BaseModel):
    total_sales_paise: int
    total_orders_count: int
    average_order_value_paise: int
    pending_amount_paise: int
    completed_orders_count: int
    active_orders_count: int

    @computed_field
    def total_sales_inr(self) -> float:
        return self.total_sales_paise / 100.0

    @computed_field
    def average_order_value_inr(self) -> float:
        return self.average_order_value_paise / 100.0

    @computed_field
    def pending_amount_inr(self) -> float:
        return self.pending_amount_paise / 100.0


class SalesTrendPoint(BaseModel):
    label: str  # e.g., "10:00", "11:00" or "Mon", "Tue"
    sales_paise: int
    orders_count: int

    @computed_field
    def sales_inr(self) -> float:
        return self.sales_paise / 100.0


class DistributionSlice(BaseModel):
    name: str  # e.g. "Dine-in", "Takeaway", "Delivery" or "UPI", "Cash", "Card"
    count: int
    amount_paise: int
    percentage: float

    @computed_field
    def amount_inr(self) -> float:
        return self.amount_paise / 100.0


class TopSellingItem(BaseModel):
    menu_item_id: str
    item_name: str
    quantity_sold: int
    revenue_paise: int

    @computed_field
    def revenue_inr(self) -> float:
        return self.revenue_paise / 100.0


class RecentOrderSummary(BaseModel):
    id: str
    order_code: str
    order_type: str
    table_number: Optional[str]
    status: str
    total_paise: int
    created_at_iso: str
    customer_name: Optional[str]

    @computed_field
    def total_inr(self) -> float:
        return self.total_paise / 100.0


class PaymentSummaryItem(BaseModel):
    payment_method: str
    count: int
    total_paise: int

    @computed_field
    def total_inr(self) -> float:
        return self.total_paise / 100.0


class ShiftDashboardSummary(BaseModel):
    has_active_shift: bool = False
    shift_number: Optional[int] = None
    operator_name: Optional[str] = None
    opening_cash_paise: int = 0
    cash_sales_paise: int = 0
    current_drawer_cash_paise: int = 0
    today_cash_expenses_paise: int = 0


class DashboardMetricsResponse(BaseModel):
    date_filter: str  # today | yesterday | 7days | 30days
    start_date_iso: str
    end_date_iso: str
    kpis: KPICards
    sales_trend: List[SalesTrendPoint] = []
    order_type_distribution: List[DistributionSlice] = []
    payment_distribution: List[DistributionSlice] = []
    top_selling_items: List[TopSellingItem] = []
    recent_orders: List[RecentOrderSummary] = []
    payment_summary: List[PaymentSummaryItem] = []
    cash_summary: Optional[ShiftDashboardSummary] = None
