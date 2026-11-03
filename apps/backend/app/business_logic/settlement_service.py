from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from app.models.order import Order
from app.models.table import RestaurantTable
from app.models.billing import Invoice, Payment, Refund
from app.models.restaurant import Restaurant, RestaurantSettings
from app.schemas.billing import PaymentInput
from app.core.exceptions import (
    EntityNotFoundException,
    PaymentValidationException,
    InvalidOrderStateException,
    AISRestroException,
)
from app.business_logic.pricing_calculator import calculate_order_financials
from app.printing.escpos_formatter import format_customer_invoice
from app.core.logging import logger


def get_or_create_invoice(
    db: Session,
    order: Order,
    discount_type: str = None,
    discount_value: float = None,
) -> Invoice:
    """
    Returns the existing frozen invoice snapshot for the order or generates a new one.
    Guarantees no duplicate invoice creation.
    Transitions order to 'bill_generated' if currently active/open.
    """
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
        tax_type=order.tax_type,
        is_tax_inclusive=order.is_tax_inclusive,
        is_tax_enabled=order.tax_rate_percent > 0,
    )

    grand_total_paise = financials["grand_total_paise"]

    invoice = Invoice(
        order_id=order.id,
        invoice_number=invoice_number,
        subtotal_paise=financials["subtotal_paise"],
        discount_paise=financials["discount_paise"],
        taxable_amount_paise=financials["taxable_amount_paise"],
        tax_rate_percent=order.tax_rate_percent,
        tax_type=order.tax_type,
        is_tax_inclusive=order.is_tax_inclusive,
        cgst_paise=financials["cgst_paise"],
        sgst_paise=financials["sgst_paise"],
        igst_paise=financials.get("igst_paise", 0),
        total_tax_paise=financials["tax_paise"],
        grand_total_paise=grand_total_paise,
        rounded_paise=0,
        status="unpaid",
        paid_amount_paise=0,
        due_amount_paise=grand_total_paise,
    )
    db.add(invoice)
    db.flush()

    # Sync order status and payment status
    if order.status in ("active", "open"):
        order.status = "bill_generated"
    order.payment_status = "unpaid"
    order.paid_amount_paise = 0
    order.due_amount_paise = grand_total_paise

    # Update table status to bill_generated if dine-in
    if order.table_id:
        table = db.query(RestaurantTable).filter(RestaurantTable.id == order.table_id).first()
        if table and table.current_order_id == order.id and table.status == "occupied":
            table.status = "bill_generated"

    db.commit()
    db.refresh(invoice)
    db.refresh(order)
    logger.info(f"Generated invoice {invoice.invoice_number} for order {order.order_code}")
    return invoice


def process_order_settlement(
    db: Session,
    order: Order,
    payments_input: List[PaymentInput],
    discount_type: str = None,
    discount_value: float = None,
) -> Tuple[Invoice, str, str, str]:
    """
    Processes payments for an order, updates invoice and payment records inside a transaction,
    closes order if fully paid, releases table if settled, and returns formatted receipt text.
    """
    if order.status == "completed":
        raise InvalidOrderStateException(f"Order {order.order_code} is already completed and settled.")
    if order.status == "cancelled":
        raise InvalidOrderStateException(f"Order {order.order_code} is cancelled.")

    invoice = get_or_create_invoice(db, order, discount_type, discount_value)

    total_new_payment_paise = sum(p.amount_paise for p in payments_input)
    if total_new_payment_paise <= 0:
        raise PaymentValidationException("Payment amount must be greater than zero.")

    # Validate against overpayment (cannot exceed remaining due unless cash change returned)
    if total_new_payment_paise > invoice.due_amount_paise:
        raise PaymentValidationException(
            f"Payment amount of INR {total_new_payment_paise / 100:.2f} exceeds remaining due of "
            f"INR {invoice.due_amount_paise / 100:.2f}."
        )

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

    order.paid_amount_paise = new_total_paid
    order.due_amount_paise = invoice.due_amount_paise

    restaurant = db.query(Restaurant).filter(Restaurant.id == order.restaurant_id).first()
    settings = db.query(RestaurantSettings).filter(RestaurantSettings.restaurant_id == restaurant.id).first()

    if invoice.due_amount_paise == 0:
        invoice.status = "paid"
        order.status = "completed"
        order.payment_status = "paid"

        # Deduct stock for order recipes idempotently
        try:
            from app.business_logic.inventory_service import consume_stock_for_order
            consume_stock_for_order(db, order)
        except Exception as e:
            logger.error(f"Failed to consume stock for order {order.id}: {e}")

        # Release table if dine-in
        if order.table_id:
            table = db.query(RestaurantTable).filter(RestaurantTable.id == order.table_id).first()
            if table and table.current_order_id == order.id:
                table.status = "available"
                table.current_order_id = None
                logger.info(f"Released table {table.table_number} on order settlement")

        message = f"Order {order.order_code} fully settled and marked completed."
    else:
        invoice.status = "partially_paid"
        order.status = "bill_generated"
        order.payment_status = "partially_paid"

        # Keep table occupied or in bill_generated state
        if order.table_id:
            table = db.query(RestaurantTable).filter(RestaurantTable.id == order.table_id).first()
            if table and table.current_order_id == order.id:
                table.status = "bill_generated"

        message = f"Partial payment of INR {total_new_payment_paise / 100:.2f} received. Remaining due: INR {invoice.due_amount_paise / 100:.2f}"

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


def process_refund(
    db: Session,
    order: Order,
    amount_paise: int,
    reason: str,
    payment_method: str = "original",
    reference_number: Optional[str] = None,
) -> Tuple[Refund, Invoice]:
    """
    Records a refund for an order, reducing the net paid amount.
    Preserves original payment records immutably for financial audit.
    """
    if not order.invoice:
        raise AISRestroException("Cannot process refund: No invoice exists for this order.")

    invoice = order.invoice
    if amount_paise <= 0:
        raise PaymentValidationException("Refund amount must be greater than zero.")

    if amount_paise > invoice.paid_amount_paise:
        raise PaymentValidationException(
            f"Refund amount (INR {amount_paise / 100:.2f}) cannot exceed total paid amount (INR {invoice.paid_amount_paise / 100:.2f})."
        )

    refund = Refund(
        invoice_id=invoice.id,
        order_id=order.id,
        amount_paise=amount_paise,
        reason=reason.strip(),
        payment_method=payment_method,
        reference_number=reference_number,
    )
    db.add(refund)

    # Update invoice & order amounts
    invoice.paid_amount_paise -= amount_paise
    invoice.due_amount_paise += amount_paise
    order.paid_amount_paise = invoice.paid_amount_paise
    order.due_amount_paise = invoice.due_amount_paise

    if invoice.paid_amount_paise == 0:
        invoice.status = "refunded"
        order.payment_status = "refunded"
    else:
        invoice.status = "partially_paid"
        order.payment_status = "partially_paid"

    db.commit()
    db.refresh(refund)
    db.refresh(invoice)
    db.refresh(order)
    logger.info(f"Recorded refund of INR {amount_paise / 100:.2f} for order {order.order_code}. Reason: {reason}")
    return refund, invoice
