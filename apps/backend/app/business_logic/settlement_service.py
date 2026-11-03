from typing import List, Tuple
from sqlalchemy.orm import Session
from app.models.order import Order
from app.models.table import RestaurantTable
from app.models.billing import Invoice, Payment
from app.models.restaurant import Restaurant, RestaurantSettings
from app.schemas.billing import PaymentInput
from app.core.exceptions import EntityNotFoundException, PaymentValidationException, InvalidOrderStateException
from app.business_logic.pricing_calculator import calculate_order_financials
from app.printing.escpos_formatter import format_customer_invoice
from app.core.logging import logger


def get_or_create_invoice(
    db: Session,
    order: Order,
    discount_type: str = None,
    discount_value: float = None,
) -> Invoice:
    if order.invoice:
        return order.invoice

    restaurant = db.query(Restaurant).filter(Restaurant.id == order.restaurant_id).first()
    settings = db.query(RestaurantSettings).filter(RestaurantSettings.restaurant_id == restaurant.id).first()

    prefix = settings.invoice_prefix if settings else "INV-"
    invoice_number = f"{prefix}{order.order_number:04d}"

    dt = discount_type if discount_type is not None else order.discount_type
    dv = discount_value if discount_value is not None else order.discount_value

    line_totals = [item.line_total_paise for item in order.items]
    financials = calculate_order_financials(
        items_line_totals=line_totals,
        discount_type=dt,
        discount_value=dv,
        tax_rate_percent=order.tax_rate_percent,
    )

    invoice = Invoice(
        order_id=order.id,
        invoice_number=invoice_number,
        subtotal_paise=financials["subtotal_paise"],
        discount_paise=financials["discount_paise"],
        cgst_paise=financials["cgst_paise"],
        sgst_paise=financials["sgst_paise"],
        total_tax_paise=financials["tax_paise"],
        grand_total_paise=financials["grand_total_paise"],
        rounded_paise=0,
        status="unpaid",
        paid_amount_paise=0,
        due_amount_paise=financials["grand_total_paise"],
    )
    db.add(invoice)
    db.flush()
    return invoice


def process_order_settlement(
    db: Session,
    order: Order,
    payments_input: List[PaymentInput],
    discount_type: str = None,
    discount_value: float = None,
) -> Tuple[Invoice, str, str, str]:
    """
    Processes payments for an order, updates invoice and payment records,
    closes order if fully paid, and releases table if dine-in.
    Returns (invoice, receipt_text, order_status, message).
    """
    if order.status == "completed":
        raise InvalidOrderStateException(f"Order {order.order_code} is already completed and settled.")
    if order.status == "cancelled":
        raise InvalidOrderStateException(f"Order {order.order_code} is cancelled.")

    invoice = get_or_create_invoice(db, order, discount_type, discount_value)

    total_new_payment_paise = sum(p.amount_paise for p in payments_input)
    if total_new_payment_paise <= 0:
        raise PaymentValidationException("Payment amount must be greater than zero.")

    # Record each payment
    for p_in in payments_input:
        change_due = None
        if p_in.tendered_amount_paise is not None and p_in.tendered_amount_paise > p_in.amount_paise:
            change_due = p_in.tendered_amount_paise - p_in.amount_paise

        payment = Payment(
            invoice_id=invoice.id,
            order_id=order.id,
            payment_method=p_in.payment_method,
            amount_paise=p_in.amount_paise,
            tendered_amount_paise=p_in.tendered_amount_paise,
            change_due_paise=change_due,
            reference_number=p_in.reference_number,
            notes=p_in.notes,
        )
        db.add(payment)

    new_total_paid = invoice.paid_amount_paise + total_new_payment_paise
    invoice.paid_amount_paise = new_total_paid
    invoice.due_amount_paise = max(0, invoice.grand_total_paise - new_total_paid)

    restaurant = db.query(Restaurant).filter(Restaurant.id == order.restaurant_id).first()
    settings = db.query(RestaurantSettings).filter(RestaurantSettings.restaurant_id == restaurant.id).first()

    if invoice.due_amount_paise == 0:
        invoice.status = "paid"
        order.status = "completed"

        # Release table if dine-in
        if order.table_id:
            table = db.query(RestaurantTable).filter(RestaurantTable.id == order.table_id).first()
            if table:
                table.status = "available"
                table.current_order_id = None
                logger.info(f"Released table {table.table_number} on order settlement")

        message = f"Order {order.order_code} settled successfully and marked as completed."
    else:
        invoice.status = "partially_paid"
        message = f"Partial payment received. Remaining due: INR {invoice.due_amount_paise / 100:.2f}"

    db.commit()
    db.refresh(invoice)
    db.refresh(order)

    receipt_text = format_customer_invoice(
        invoice=invoice,
        order=order,
        restaurant=restaurant,
        settings=settings,
        width=settings.paper_width_mm // 2 if settings else 42,
    )

    return invoice, receipt_text, order.status, message
