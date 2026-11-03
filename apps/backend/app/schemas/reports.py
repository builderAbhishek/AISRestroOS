from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class ExecutiveOverviewResponse(BaseModel):
    start_date: str
    end_date: str
    total_orders_count: int
    cancelled_orders_count: int
    gross_sales_paise: int
    discount_paise: int
    net_sales_paise: int
    tax_paise: int
    grand_total_paise: int
    aov_paise: int
    payments_collected_paise: int
    refunds_issued_paise: int
    outstanding_dues_paise: int
    sales_growth_pct: float
    orders_growth_pct: float


class SalesTrendPoint(BaseModel):
    date: str
    orders_count: int
    gross_sales_paise: int
    discount_paise: int
    net_sales_paise: int
    tax_paise: int
    grand_total_paise: int


class ItemWiseSaleItem(BaseModel):
    menu_item_id: str
    item_name: str
    variant_id: Optional[str] = None
    variant_name: Optional[str] = None
    quantity_sold: int
    total_sales_paise: int


class CategoryWiseSaleItem(BaseModel):
    category_name: str
    quantity_sold: int
    total_sales_paise: int
    percentage: float


class OrderTypeSaleItem(BaseModel):
    order_type: str
    label: str
    orders_count: int
    net_sales_paise: int
    grand_total_paise: int
    percentage: float


class PaymentBreakdownItem(BaseModel):
    method: str
    label: str
    count: int
    amount_paise: int
    percentage: float


class PaymentMethodReportResponse(BaseModel):
    total_collected_paise: int
    payment_count: int
    breakdown: List[PaymentBreakdownItem]


class TaxInvoiceEntry(BaseModel):
    invoice_number: str
    created_at: Optional[str] = None
    taxable_amount_paise: int
    cgst_paise: int
    sgst_paise: int
    igst_paise: int
    total_tax_paise: int
    grand_total_paise: int
    status: str


class TaxReportResponse(BaseModel):
    taxable_amount_paise: int
    cgst_paise: int
    sgst_paise: int
    igst_paise: int
    total_tax_paise: int
    grand_total_paise: int
    invoices_count: int
    invoices: List[TaxInvoiceEntry]


class InventoryAnalyticsResponse(BaseModel):
    total_items_count: int
    total_stock_value_paise: int
    low_stock_count: int
    low_stock_items: List[Dict[str, Any]]
    purchases_cost_paise: int
    consumption_cost_paise: int
    wastage_cost_paise: int
    wastage_records: List[Dict[str, Any]]


class ProfitabilityResponse(BaseModel):
    net_sales_paise: int
    cogs_paise: int
    gross_profit_paise: int
    gross_margin_pct: float
    recipe_coverage_pct: float
    disclaimer: str
