from datetime import datetime, timezone
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from app.models.order import Order
from app.models.table import RestaurantTable
from app.models.billing import Invoice
from app.core.exceptions import InvalidOrderStateException, AISRestroException
from app.core.logging import logger

VALID_ORDER_STATUSES = {"open", "active", "bill_generated", "completed", "cancelled"}
VALID_PAYMENT_STATUSES = {"unpaid", "partially_paid", "paid", "refunded"}

ALLOWED_TRANSITIONS = {
    "open": {"bill_generated", "completed", "cancelled"},
    "active": {"bill_generated", "completed", "cancelled"},
    "bill_generated": {"open", "active", "completed", "cancelled"},
    "completed": set(),  # Terminal state: settled orders cannot be edited or cancelled
    "cancelled": set(),  # Terminal state: cancelled orders cannot be reopened
}


def validate_status_transition(current_status: str, target_status: str) -> None:
    current = current_status.lower()
    target = target_status.lower()

    if current == target:
        return

    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise InvalidOrderStateException(
            f"Invalid order status transition from '{current}' to '{target}'. "
            f"Allowed next states: {', '.join(sorted(allowed)) if allowed else 'None (terminal state)'}."
        )


def cancel_order_with_audit(
    db: Session,
    order: Order,
    reason: str,
) -> Order:
    """
    Cancels an active or bill_generated order with cancellation audit records.
    Settled orders (completed) cannot be cancelled.
    Releases table if dine-in.
    """
    if order.status == "completed":
        raise InvalidOrderStateException(
            f"Cannot cancel settled/completed order {order.order_code}. "
            "Financial transactions are permanently locked."
        )
    if order.status == "cancelled":
        raise InvalidOrderStateException(f"Order {order.order_code} is already cancelled.")

    validate_status_transition(order.status, "cancelled")

    order.status = "cancelled"
    order.cancellation_reason = reason.strip()
    order.cancelled_at = datetime.now(timezone.utc)

    # Release table if dine-in and table currently occupied by this order
    if order.table_id:
        table = db.query(RestaurantTable).filter(RestaurantTable.id == order.table_id).first()
        if table and table.current_order_id == order.id:
            table.status = "available"
            table.current_order_id = None
            logger.info(f"Released table {table.table_number} on order cancellation")

    # If invoice exists and was unpaid, mark invoice cancelled
    if order.invoice and order.invoice.status == "unpaid":
        order.invoice.status = "cancelled"

    db.commit()
    db.refresh(order)
    logger.info(f"Order {order.order_code} cancelled. Reason: {reason}")
    return order


def filter_orders_query(
    db: Session,
    restaurant_id: str,
    search: Optional[str] = None,
    table_number: Optional[str] = None,
    order_type: Optional[str] = None,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    quick_filter: Optional[str] = None,
):
    """
    Builds a flexible SQLAlchemy query for orders with comprehensive filters.
    """
    query = db.query(Order).filter(Order.restaurant_id == restaurant_id)

    # Quick filters
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    if quick_filter == "today":
        query = query.filter(Order.created_at >= today_start)
    elif quick_filter == "active":
        query = query.filter(Order.status.in_(["open", "active"]))
    elif quick_filter == "completed":
        query = query.filter(Order.status == "completed")
    elif quick_filter == "cancelled":
        query = query.filter(Order.status == "cancelled")
    elif quick_filter == "unpaid":
        query = query.filter(Order.payment_status.in_(["unpaid", "partially_paid"]))

    # Explicit filters
    if status and status != "all":
        if status in ("active", "open"):
            query = query.filter(Order.status.in_(["active", "open"]))
        else:
            query = query.filter(Order.status == status)

    if payment_status and payment_status != "all":
        query = query.filter(Order.payment_status == payment_status)

    if order_type and order_type != "all":
        query = query.filter(Order.order_type == order_type)

    if table_number and table_number.strip():
        tn = f"%{table_number.strip().lower()}%"
        query = query.filter(Order.table_number_snapshot.ilike(tn))

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                Order.order_code.ilike(term),
                Order.customer_name.ilike(term),
                Order.customer_phone.ilike(term),
                Order.table_number_snapshot.ilike(term),
            )
        )

    if start_date:
        try:
            s_dt = datetime.fromisoformat(start_date)
            query = query.filter(Order.created_at >= s_dt)
        except Exception:
            pass

    if end_date:
        try:
            e_dt = datetime.fromisoformat(end_date)
            query = query.filter(Order.created_at <= e_dt)
        except Exception:
            pass

    return query.order_by(Order.created_at.desc())
