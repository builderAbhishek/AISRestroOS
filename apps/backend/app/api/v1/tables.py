from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_restaurant
from app.models.restaurant import Restaurant
from app.models.table import RestaurantTable
from app.models.order import Order
from app.schemas.table import (
    TableCreate,
    TableUpdate,
    TableResponse,
    TableTransferRequest,
    TableStatsResponse,
)
from app.schemas.order import OrderResponse
from app.core.exceptions import (
    EntityNotFoundException,
    TableOccupiedException,
    AISRestroException,
)
from app.core.logging import logger

router = APIRouter(prefix="/tables", tags=["Tables Management"])


@router.get("/stats", response_model=TableStatsResponse)
def get_tables_stats(
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Returns aggregated table status counts for dashboard and table management bar.
    """
    tables = (
        db.query(RestaurantTable)
        .filter(RestaurantTable.restaurant_id == restaurant.id)
        .all()
    )

    total = len(tables)
    available = sum(1 for t in tables if t.status == "available" and t.is_active)
    occupied = sum(1 for t in tables if t.status == "occupied" and t.is_active)
    bill_pending = sum(1 for t in tables if t.status == "bill_generated" and t.is_active)

    return TableStatsResponse(
        total_tables=total,
        available_tables=available,
        occupied_tables=occupied,
        bill_pending_tables=bill_pending,
    )


@router.get("", response_model=List[TableResponse])
def list_tables(
    section: Optional[str] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Lists tables sorted by section, display_order, and table_number.
    Populates active order snapshot attributes (order code, total, due, elapsed time).
    """
    query = db.query(RestaurantTable).filter(RestaurantTable.restaurant_id == restaurant.id)
    if section:
        query = query.filter(RestaurantTable.section == section)

    tables = query.order_by(
        RestaurantTable.section,
        RestaurantTable.display_order,
        RestaurantTable.table_number,
    ).all()

    # Pre-fetch all active/bill_generated orders for this restaurant to avoid N+1 queries
    active_orders = (
        db.query(Order)
        .filter(
            Order.restaurant_id == restaurant.id,
            Order.status.in_(["open", "active", "bill_generated"]),
        )
        .all()
    )
    orders_by_id = {o.id: o for o in active_orders}
    orders_by_table_id = {o.table_id: o for o in active_orders if o.table_id}

    for table in tables:
        matched_order = None
        if table.current_order_id and table.current_order_id in orders_by_id:
            matched_order = orders_by_id[table.current_order_id]
        elif table.id in orders_by_table_id:
            matched_order = orders_by_table_id[table.id]
            # Self-healing sync if table reference was missing
            table.current_order_id = matched_order.id
            if table.status == "available":
                table.status = "bill_generated" if matched_order.status == "bill_generated" else "occupied"

        if matched_order:
            table.current_order_code = matched_order.order_code
            table.current_order_total_paise = matched_order.total_paise
            table.current_order_paid_paise = matched_order.paid_amount_paise or 0
            table.current_order_due_paise = (
                matched_order.due_amount_paise
                if matched_order.due_amount_paise is not None
                else matched_order.total_paise
            )
            table.current_order_created_at = matched_order.created_at
        else:
            table.current_order_code = None
            table.current_order_total_paise = None
            table.current_order_paid_paise = None
            table.current_order_due_paise = None
            table.current_order_created_at = None

    return tables


@router.post("", response_model=TableResponse, status_code=status.HTTP_201_CREATED)
def create_table(
    data: TableCreate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    # Check duplicate table_number within restaurant
    existing = (
        db.query(RestaurantTable)
        .filter(
            RestaurantTable.restaurant_id == restaurant.id,
            RestaurantTable.table_number == data.table_number.strip(),
        )
        .first()
    )
    if existing:
        raise AISRestroException(f"Table '{data.table_number}' already exists in this restaurant.")

    table = RestaurantTable(
        restaurant_id=restaurant.id,
        table_number=data.table_number.strip(),
        capacity=data.capacity,
        section=data.section.strip(),
        display_order=data.display_order,
        status="available",
        is_active=True,
    )
    db.add(table)
    db.commit()
    db.refresh(table)
    return table


@router.put("/{table_id}", response_model=TableResponse)
def update_table(
    table_id: str,
    data: TableUpdate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    table = (
        db.query(RestaurantTable)
        .filter(RestaurantTable.id == table_id, RestaurantTable.restaurant_id == restaurant.id)
        .first()
    )
    if not table:
        raise EntityNotFoundException("RestaurantTable", table_id)

    # If updating table number, check for duplicates
    if data.table_number and data.table_number.strip() != table.table_number:
        dup = (
            db.query(RestaurantTable)
            .filter(
                RestaurantTable.restaurant_id == restaurant.id,
                RestaurantTable.table_number == data.table_number.strip(),
                RestaurantTable.id != table.id,
            )
            .first()
        )
        if dup:
            raise AISRestroException(f"Table '{data.table_number}' already exists.")

    for field, val in data.model_dump(exclude_unset=True).items():
        if val is not None and isinstance(val, str):
            setattr(table, field, val.strip())
        else:
            setattr(table, field, val)

    db.commit()
    db.refresh(table)
    return table


@router.patch("/{table_id}/toggle-active", response_model=TableResponse)
def toggle_table_active(
    table_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Toggles is_active on a table. Blocks deactivation if table is currently occupied.
    """
    table = (
        db.query(RestaurantTable)
        .filter(RestaurantTable.id == table_id, RestaurantTable.restaurant_id == restaurant.id)
        .first()
    )
    if not table:
        raise EntityNotFoundException("RestaurantTable", table_id)

    if table.is_active and (table.status in ("occupied", "bill_generated") or table.current_order_id):
        raise AISRestroException(f"Cannot disable table {table.table_number} while it has an active order.")

    table.is_active = not table.is_active
    db.commit()
    db.refresh(table)
    logger.info(f"Toggled active state for table {table.table_number} to {table.is_active}")
    return table


@router.post("/{table_id}/transfer", response_model=TableResponse)
def transfer_table(
    table_id: str,
    data: TableTransferRequest,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Transfers an ongoing dine-in order from source table to a target available table transactionally.
    """
    if table_id == data.target_table_id:
        raise AISRestroException("Source and target table cannot be the same.")

    source = (
        db.query(RestaurantTable)
        .filter(RestaurantTable.id == table_id, RestaurantTable.restaurant_id == restaurant.id)
        .first()
    )
    if not source:
        raise EntityNotFoundException("RestaurantTable (Source)", table_id)

    target = (
        db.query(RestaurantTable)
        .filter(RestaurantTable.id == data.target_table_id, RestaurantTable.restaurant_id == restaurant.id)
        .first()
    )
    if not target:
        raise EntityNotFoundException("RestaurantTable (Target)", data.target_table_id)

    if not target.is_active:
        raise AISRestroException(f"Target table {target.table_number} is disabled.")

    if target.status != "available" or target.current_order_id:
        raise TableOccupiedException(target.table_number, target.current_order_id or "occupied")

    # Locate order
    order = None
    if source.current_order_id:
        order = db.query(Order).filter(Order.id == source.current_order_id).first()
    if not order:
        order = (
            db.query(Order)
            .filter(
                Order.table_id == source.id,
                Order.restaurant_id == restaurant.id,
                Order.status.in_(["open", "active", "bill_generated"]),
            )
            .first()
        )

    if not order:
        raise AISRestroException(f"No active order found on table {source.table_number} to transfer.")

    # Execute transactional transfer
    old_table_num = source.table_number
    new_table_num = target.table_number

    order.table_id = target.id
    order.table_number_snapshot = new_table_num

    target.current_order_id = order.id
    target.status = source.status if source.status in ("occupied", "bill_generated") else "occupied"

    source.current_order_id = None
    source.status = "available"

    db.commit()
    db.refresh(target)
    db.refresh(source)
    db.refresh(order)

    # Populate target snapshot fields for response
    target.current_order_code = order.order_code
    target.current_order_total_paise = order.total_paise
    target.current_order_paid_paise = order.paid_amount_paise or 0
    target.current_order_due_paise = order.due_amount_paise if order.due_amount_paise is not None else order.total_paise
    target.current_order_created_at = order.created_at

    logger.info(f"Transferred order {order.order_code} from Table {old_table_num} to Table {new_table_num}")
    return target


@router.delete("/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_table(
    table_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    table = (
        db.query(RestaurantTable)
        .filter(RestaurantTable.id == table_id, RestaurantTable.restaurant_id == restaurant.id)
        .first()
    )
    if not table:
        raise EntityNotFoundException("RestaurantTable", table_id)

    if table.status in ("occupied", "bill_generated") or table.current_order_id:
        raise TableOccupiedException(table.table_number, table.current_order_id or "occupied")

    # Also verify there are no active orders referencing this table
    active_linked_order = (
        db.query(Order)
        .filter(
            Order.table_id == table.id,
            Order.status.in_(["open", "active", "bill_generated"]),
        )
        .first()
    )
    if active_linked_order:
        raise TableOccupiedException(table.table_number, active_linked_order.order_code)

    db.delete(table)
    db.commit()
    logger.info(f"Deleted table {table.table_number}")
    return None


@router.get("/{table_id}/active-order", response_model=Optional[OrderResponse])
def get_table_active_order(
    table_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    table = (
        db.query(RestaurantTable)
        .filter(RestaurantTable.id == table_id, RestaurantTable.restaurant_id == restaurant.id)
        .first()
    )
    if not table:
        raise EntityNotFoundException("RestaurantTable", table_id)

    # Find active order
    order = None
    if table.current_order_id:
        order = (
            db.query(Order)
            .filter(
                Order.id == table.current_order_id,
                Order.restaurant_id == restaurant.id,
                Order.status.in_(["open", "active", "bill_generated"]),
            )
            .first()
        )

    if not order:
        order = (
            db.query(Order)
            .filter(
                Order.table_id == table.id,
                Order.restaurant_id == restaurant.id,
                Order.status.in_(["open", "active", "bill_generated"]),
            )
            .first()
        )
        if order:
            table.current_order_id = order.id
            if table.status == "available":
                table.status = "bill_generated" if order.status == "bill_generated" else "occupied"
            db.commit()

    return order
