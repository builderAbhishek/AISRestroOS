from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status, Response
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_restaurant
from app.models.restaurant import Restaurant, RestaurantSettings
from app.models.order import Order
from app.models.billing import Invoice, Payment, Refund
from app.models.printing import PrintJob
from app.schemas.billing import (
    SettlementRequest,
    SettlementResponse,
    BillCalculationResponse,
    InvoiceResponse,
    RefundRequest,
    RefundResponse,
    PrintJobResponse,
    TestPrintRequest,
)
from app.core.exceptions import EntityNotFoundException, InvalidOrderStateException, AISRestroException
from app.business_logic.pricing_calculator import calculate_order_financials
from app.business_logic.settlement_service import (
    get_or_create_invoice,
    process_order_settlement,
    process_refund,
)
from app.printing.escpos_formatter import format_customer_invoice, format_test_print_receipt
from app.printing.a4_formatter import format_a4_invoice_html
from app.core.logging import logger

router = APIRouter(prefix="/orders", tags=["Billing & Settlement"])
printing_router = APIRouter(prefix="/printing", tags=["Printing"])


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
        tax_type=order.tax_type,
        is_tax_inclusive=order.is_tax_inclusive,
        is_tax_enabled=order.tax_rate_percent > 0,
    )

    return BillCalculationResponse(
        subtotal_paise=financials["subtotal_paise"],
        discount_paise=financials["discount_paise"],
        taxable_amount_paise=financials["taxable_amount_paise"],
        cgst_paise=financials["cgst_paise"],
        sgst_paise=financials["sgst_paise"],
        igst_paise=financials.get("igst_paise", 0),
        total_tax_paise=financials["tax_paise"],
        grand_total_paise=financials["grand_total_paise"],
        tax_rate_percent=order.tax_rate_percent,
        tax_type=order.tax_type,
        is_tax_inclusive=order.is_tax_inclusive,
    )


@router.post("/{order_id}/generate-bill", response_model=InvoiceResponse)
def generate_bill_action(
    order_id: str,
    discount_type: Optional[str] = None,
    discount_value: Optional[float] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Generates or returns existing invoice snapshot for an order.
    Transitions order to 'bill_generated' and table status to 'bill_generated'.
    """
    order = (
        db.query(Order)
        .filter(Order.id == order_id, Order.restaurant_id == restaurant.id)
        .first()
    )
    if not order:
        raise EntityNotFoundException("Order", order_id)

    if order.status == "cancelled":
        raise InvalidOrderStateException(f"Cannot generate bill for cancelled order {order.order_code}.")

    invoice = get_or_create_invoice(
        db=db,
        order=order,
        discount_type=discount_type,
        discount_value=discount_value,
    )
    return invoice


@router.get("/{order_id}/invoice", response_model=InvoiceResponse)
def get_order_invoice(
    order_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Retrieves the invoice record for an order.
    Generates it if it does not yet exist.
    """
    order = (
        db.query(Order)
        .filter(Order.id == order_id, Order.restaurant_id == restaurant.id)
        .first()
    )
    if not order:
        raise EntityNotFoundException("Order", order_id)

    invoice = get_or_create_invoice(db=db, order=order)
    return invoice


@router.get("/{order_id}/invoice/a4")
def get_order_invoice_a4_html(
    order_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Returns a beautifully styled, print-ready A4 HTML invoice.
    """
    order = (
        db.query(Order)
        .filter(Order.id == order_id, Order.restaurant_id == restaurant.id)
        .first()
    )
    if not order:
        raise EntityNotFoundException("Order", order_id)

    invoice = get_or_create_invoice(db=db, order=order)
    html_content = format_a4_invoice_html(
        invoice=invoice,
        order=order,
        restaurant=restaurant,
        settings=restaurant.settings,
    )

    # Record print job
    try:
        job = PrintJob(
            restaurant_id=restaurant.id,
            order_id=order.id,
            invoice_id=invoice.id,
            job_type="invoice",
            paper_format="a4",
            status="success",
            content_preview=f"A4 Invoice {invoice.invoice_number}",
        )
        db.add(job)
        db.commit()
    except Exception as e:
        logger.warning(f"Could not log PrintJob for A4 invoice: {e}")

    return Response(content=html_content, media_type="text/html")


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

    # Record print job for receipt
    try:
        job = PrintJob(
            restaurant_id=restaurant.id,
            order_id=order.id,
            invoice_id=invoice.id,
            job_type="receipt",
            paper_format="80mm",
            status="success",
            content_preview=receipt_text[:200] if receipt_text else None,
        )
        db.add(job)
        db.commit()
    except Exception as e:
        logger.warning(f"Could not log PrintJob: {e}")

    return SettlementResponse(
        invoice=invoice,
        order_id=order.id,
        order_status=order_status,
        receipt_text=receipt_text,
        message=message,
    )


@router.post("/{order_id}/refund", response_model=RefundResponse)
def refund_order(
    order_id: str,
    data: RefundRequest,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Processes a refund for a previously paid or partially paid order.
    Leaves original payment records intact for financial audit trail.
    """
    order = (
        db.query(Order)
        .filter(Order.id == order_id, Order.restaurant_id == restaurant.id)
        .first()
    )
    if not order:
        raise EntityNotFoundException("Order", order_id)

    refund, invoice = process_refund(
        db=db,
        order=order,
        amount_paise=data.amount_paise,
        reason=data.reason,
        payment_method=data.payment_method,
        reference_number=data.reference_number,
    )
    return refund


@router.get("/{order_id}/receipt")
def get_order_receipt_text(
    order_id: str,
    format: str = Query("80mm", pattern="^(58mm|80mm)$"),
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Returns thermal receipt formatted text for 58mm or 80mm ESC/POS printers.
    """
    order = (
        db.query(Order)
        .filter(Order.id == order_id, Order.restaurant_id == restaurant.id)
        .first()
    )
    if not order:
        raise EntityNotFoundException("Order", order_id)

    invoice = get_or_create_invoice(db, order)
    settings = restaurant.settings
    width = 32 if format == "58mm" else (settings.paper_width_mm // 2 if settings else 42)

    receipt_text = format_customer_invoice(
        invoice=invoice,
        order=order,
        restaurant=restaurant,
        settings=settings,
        width=width,
    )

    try:
        job = PrintJob(
            restaurant_id=restaurant.id,
            order_id=order.id,
            invoice_id=invoice.id,
            job_type="receipt",
            paper_format=format,
            status="success",
            content_preview=receipt_text[:200] if receipt_text else None,
        )
        db.add(job)
        db.commit()
    except Exception as e:
        logger.warning(f"Could not log PrintJob: {e}")

    return {
        "receipt_text": receipt_text,
        "invoice_number": invoice.invoice_number,
        "format": format,
    }


# ==============================================================================
# Printing Management Endpoints (/api/v1/printing)
# ==============================================================================

@printing_router.post("/test-print")
def test_print(
    data: TestPrintRequest,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Generates a test print sample and logs a print job to verify printer setup.
    """
    receipt_text = format_test_print_receipt(
        restaurant=restaurant,
        settings=restaurant.settings,
        paper_format=data.paper_format,
    )

    try:
        job = PrintJob(
            restaurant_id=restaurant.id,
            job_type="test",
            printer_name=data.printer_name,
            paper_format=data.paper_format,
            status="success",
            content_preview=receipt_text[:200],
        )
        db.add(job)
        db.commit()
    except Exception as e:
        logger.warning(f"Could not log test PrintJob: {e}")

    return {
        "status": "success",
        "message": f"Test print generated successfully for {data.paper_format}",
        "receipt_text": receipt_text,
        "paper_format": data.paper_format,
    }


@printing_router.get("/jobs", response_model=List[PrintJobResponse])
def list_print_jobs(
    limit: int = 20,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Returns recent print jobs for audit and diagnostic verification.
    """
    return (
        db.query(PrintJob)
        .filter(PrintJob.restaurant_id == restaurant.id)
        .order_by(PrintJob.created_at.desc())
        .limit(limit)
        .all()
    )
