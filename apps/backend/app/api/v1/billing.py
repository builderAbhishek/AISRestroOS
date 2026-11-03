from typing import Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_restaurant
from app.models.restaurant import Restaurant
from app.models.order import Order
from app.models.billing import Invoice
from app.schemas.billing import (
    SettlementRequest,
    SettlementResponse,
    BillCalculationResponse,
    InvoiceResponse,
)
from app.core.exceptions import EntityNotFoundException, InvalidOrderStateException
from app.business_logic.pricing_calculator import calculate_order_financials
from app.business_logic.settlement_service import (
    get_or_create_invoice,
    process_order_settlement,
)
from app.printing.escpos_formatter import format_customer_invoice

router = APIRouter(prefix="/orders", tags=["Billing & Settlement"])


@router.get("/{order_id}/calculate-bill", response_model=BillCalculationResponse)
def calculate_bill_preview(
    order_id: str,
    discount_type: Optional[str] = None,
    discount_value: Optional[float] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Computes a preview of subtotal, discount, CGST, SGST, and grand total.
    """
    order = (
        db.query(Order)
        .filter(Order.id == order_id, Order.restaurant_id == restaurant.id)
        .first()
    )
    if not order:
        raise EntityNotFoundException("Order", order_id)

    dt = discount_type if discount_type is not None else order.discount_type
    dv = discount_value if discount_value is not None else order.discount_value

    line_totals = [item.line_total_paise for item in order.items]
    financials = calculate_order_financials(
        items_line_totals=line_totals,
        discount_type=dt,
        discount_value=dv or 0.0,
        tax_rate_percent=order.tax_rate_percent,
    )

    return BillCalculationResponse(
        subtotal_paise=financials["subtotal_paise"],
        discount_paise=financials["discount_paise"],
        cgst_paise=financials["cgst_paise"],
        sgst_paise=financials["sgst_paise"],
        total_tax_paise=financials["tax_paise"],
        grand_total_paise=financials["grand_total_paise"],
        tax_rate_percent=order.tax_rate_percent,
    )


@router.post("/{order_id}/settle", response_model=SettlementResponse)
def settle_order(
    order_id: str,
    data: SettlementRequest,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Primary POS Action: 'Generate Bill / Settle'.
    Validates payments, generates invoice, records payments (Cash, UPI, Card, Other, Split),
    closes the order when fully paid, releases the table, and returns customer receipt text.
    """
    order = (
        db.query(Order)
        .filter(Order.id == order_id, Order.restaurant_id == restaurant.id)
        .first()
    )
    if not order:
        raise EntityNotFoundException("Order", order_id)

    invoice, receipt_text, order_status, message = process_order_settlement(
        db=db,
        order=order,
        payments_input=data.payments,
        discount_type=data.discount_type,
        discount_value=data.discount_value,
    )

    return SettlementResponse(
        invoice=invoice,
        order_id=order.id,
        order_status=order_status,
        receipt_text=receipt_text,
        message=message,
    )


@router.get("/{order_id}/receipt")
def get_order_receipt_text(
    order_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    order = (
        db.query(Order)
        .filter(Order.id == order_id, Order.restaurant_id == restaurant.id)
        .first()
    )
    if not order:
        raise EntityNotFoundException("Order", order_id)

    invoice = get_or_create_invoice(db, order)
    settings = restaurant.settings
    width = settings.paper_width_mm // 2 if settings else 42

    receipt_text = format_customer_invoice(
        invoice=invoice,
        order=order,
        restaurant=restaurant,
        settings=settings,
        width=width,
    )
    return {"receipt_text": receipt_text, "invoice_number": invoice.invoice_number}
