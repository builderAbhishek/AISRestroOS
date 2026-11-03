from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_restaurant
from app.models.restaurant import Restaurant, RestaurantSettings
from app.models.table import RestaurantTable
from app.models.order import Order, OrderItem, OrderItemAddon
from app.models.menu import MenuItem, MenuVariant, Addon
from app.schemas.order import OrderCreate, OrderUpdateItems, OrderResponse, OrderCancelRequest
from app.business_logic.pricing_calculator import (
    calculate_item_price_paise,
    calculate_order_financials,
)
from app.business_logic.order_service import (
    filter_orders_query,
    cancel_order_with_audit,
)
from app.core.exceptions import (
    EntityNotFoundException,
    TableOccupiedException,
    InvalidOrderStateException,
    AISRestroException,
)
from app.core.logging import logger

router = APIRouter(prefix="/orders", tags=["Orders & POS"])


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    data: OrderCreate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    table = None
    if data.order_type == "dine_in":
        if not data.table_id:
            raise AISRestroException("Table selection is required for Dine-in orders.")
        table = (
            db.query(RestaurantTable)
            .filter(RestaurantTable.id == data.table_id, RestaurantTable.restaurant_id == restaurant.id)
            .first()
        )
        if not table:
            raise EntityNotFoundException("RestaurantTable", data.table_id)

        # Check for existing active order on this table
        existing_active = (
            db.query(Order)
            .filter(
                Order.table_id == table.id,
                Order.restaurant_id == restaurant.id,
                Order.status == "active",
            )
            .first()
        )
        if existing_active:
            raise TableOccupiedException(table.table_number, existing_active.id)

    # Calculate sequential order number
    max_order_num = (
        db.query(func.coalesce(func.max(Order.order_number), 0))
        .filter(Order.restaurant_id == restaurant.id)
        .scalar()
    )
    order_number = max_order_num + 1
    order_code = f"ORD-{order_number:04d}"

    settings = restaurant.settings
    is_tax_enabled = getattr(settings, 'is_tax_enabled', True) if settings else False
    is_tax_inclusive = getattr(settings, 'is_tax_inclusive', False) if settings else False
    tax_rate = (settings.tax_rate_percent if (settings and is_tax_enabled) else 0.0)
    tax_type = (settings.tax_type if (settings and is_tax_enabled) else "NON_GST")

    order = Order(
        restaurant_id=restaurant.id,
        order_number=order_number,
        order_code=order_code,
        order_type=data.order_type,
        table_id=table.id if table else None,
        table_number_snapshot=table.table_number if table else None,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        customer_address=data.customer_address,
        status="active",
        tax_rate_percent=tax_rate,
        tax_type=tax_type,
        is_tax_inclusive=is_tax_inclusive,
        notes=data.notes,
        discount_type=data.discount_type,
        discount_value=data.discount_value,
    )
    db.add(order)
    db.flush()

    line_totals = []

    for item_in in data.items:
        menu_item = (
            db.query(MenuItem)
            .filter(MenuItem.id == item_in.menu_item_id, MenuItem.restaurant_id == restaurant.id)
            .first()
        )
        if not menu_item:
            raise EntityNotFoundException("MenuItem", item_in.menu_item_id)

        variant = None
        variant_price = None
        if item_in.variant_id:
            variant = (
                db.query(MenuVariant)
                .filter(MenuVariant.id == item_in.variant_id, MenuVariant.item_id == menu_item.id)
                .first()
            )
            if not variant:
                raise EntityNotFoundException("MenuVariant", item_in.variant_id)
            variant_price = variant.price_paise

        addons_prices = [a.price_paise for a in item_in.addons]
        unit_price = calculate_item_price_paise(
            base_price_paise=menu_item.base_price_paise,
            variant_price_paise=variant_price,
            addons_prices_paise=addons_prices,
        )
        line_total = unit_price * item_in.quantity
        line_totals.append(line_total)

        order_item = OrderItem(
            order_id=order.id,
            menu_item_id=menu_item.id,
            variant_id=variant.id if variant else None,
            item_name=menu_item.name,
            variant_name=variant.name if variant else None,
            unit_price_paise=unit_price,
            quantity=item_in.quantity,
            line_total_paise=line_total,
            notes=item_in.notes,
            kot_status="unprinted",
            printed_quantity=0,
        )
        db.add(order_item)
        db.flush()

        for a_in in item_in.addons:
            addon_record = OrderItemAddon(
                order_item_id=order_item.id,
                addon_id=a_in.addon_id,
                addon_name=a_in.addon_name,
                price_paise=a_in.price_paise,
            )
            db.add(addon_record)

    financials = calculate_order_financials(
        items_line_totals=line_totals,
        discount_type=data.discount_type,
        discount_value=data.discount_value,
        tax_rate_percent=tax_rate,
        tax_type=tax_type,
        is_tax_inclusive=is_tax_inclusive,
        is_tax_enabled=tax_rate > 0,
    )

    order.subtotal_paise = financials["subtotal_paise"]
    order.discount_paise = financials["discount_paise"]
    order.taxable_amount_paise = financials["taxable_amount_paise"]
    order.cgst_paise = financials["cgst_paise"]
    order.sgst_paise = financials["sgst_paise"]
    order.igst_paise = financials.get("igst_paise", 0)
    order.tax_paise = financials["tax_paise"]
    order.total_paise = financials["grand_total_paise"]
    order.due_amount_paise = max(0, financials["grand_total_paise"] - (order.paid_amount_paise or 0))
    order.paid_amount_paise = 0
    order.due_amount_paise = financials["grand_total_paise"]
    order.payment_status = "unpaid"

    # If dine_in, mark table occupied and link active order
    if table:
        table.status = "occupied"
        table.current_order_id = order.id

    db.commit()
    db.refresh(order)
    logger.info(f"Created order {order.order_code} ({order.order_type}) with total ₹{order.total_paise / 100:.2f}")
    return order


@router.put("/{order_id}/items", response_model=OrderResponse)
def update_order_items(
    order_id: str,
    data: OrderUpdateItems,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Updates or appends items to an existing active order.
    Preserves existing printed quantities where items match.
    Does NOT delete existing items or their linked KOT items.
    """
    order = (
        db.query(Order)
        .filter(Order.id == order_id, Order.restaurant_id == restaurant.id)
        .first()
    )
    if not order:
        raise EntityNotFoundException("Order", order_id)
    if order.status != "active":
        raise InvalidOrderStateException(f"Cannot update order in '{order.status}' status.")

    if data.discount_type is not None:
        order.discount_type = data.discount_type
    if data.discount_value is not None:
        order.discount_value = data.discount_value
    if data.notes is not None:
        order.notes = data.notes

    # Index existing order items
    existing_items_by_key = {}
    for item in order.items:
        addon_key = tuple(sorted([a.addon_id or a.addon_name for a in item.addons]))
        key = (item.menu_item_id, item.variant_id, addon_key, item.notes or "")
        existing_items_by_key[key] = item

    processed_item_ids = set()
    line_totals = []

    for item_in in data.items:
        menu_item = (
            db.query(MenuItem)
            .filter(MenuItem.id == item_in.menu_item_id, MenuItem.restaurant_id == restaurant.id)
            .first()
        )
        if not menu_item:
            raise EntityNotFoundException("MenuItem", item_in.menu_item_id)

        variant = None
        variant_price = None
        if item_in.variant_id:
            variant = (
                db.query(MenuVariant)
                .filter(MenuVariant.id == item_in.variant_id, MenuVariant.item_id == menu_item.id)
                .first()
            )
            variant_price = variant.price_paise if variant else None

        addons_prices = [a.price_paise for a in item_in.addons]
        unit_price = calculate_item_price_paise(
            base_price_paise=menu_item.base_price_paise,
            variant_price_paise=variant_price,
            addons_prices_paise=addons_prices,
        )
        line_total = unit_price * item_in.quantity
        line_totals.append(line_total)

        addon_key = tuple(sorted([a.addon_id or a.addon_name for a in item_in.addons]))
        key = (menu_item.id, variant.id if variant else None, addon_key, item_in.notes or "")

        if key in existing_items_by_key:
            # Update existing item in place
            existing_item = existing_items_by_key[key]
            existing_item.quantity = item_in.quantity
            existing_item.unit_price_paise = unit_price
            existing_item.line_total_paise = line_total
            if item_in.quantity > existing_item.printed_quantity:
                existing_item.kot_status = "unprinted"
            processed_item_ids.add(existing_item.id)
        else:
            # Add new item
            new_item = OrderItem(
                order_id=order.id,
                menu_item_id=menu_item.id,
                variant_id=variant.id if variant else None,
                item_name=menu_item.name,
                variant_name=variant.name if variant else None,
                unit_price_paise=unit_price,
                quantity=item_in.quantity,
                line_total_paise=line_total,
                notes=item_in.notes,
                kot_status="unprinted",
                printed_quantity=0,
            )
            db.add(new_item)
            db.flush()

            for a_in in item_in.addons:
                addon_record = OrderItemAddon(
                    order_item_id=new_item.id,
                    addon_id=a_in.addon_id,
                    addon_name=a_in.addon_name,
                    price_paise=a_in.price_paise,
                )
                db.add(addon_record)

            processed_item_ids.add(new_item.id)

    # Clean up any removed items that were never printed to kitchen
    for item in list(order.items):
        if item.id not in processed_item_ids:
            if item.printed_quantity == 0:
                db.delete(item)

    financials = calculate_order_financials(
        items_line_totals=line_totals,
        discount_type=order.discount_type,
        discount_value=order.discount_value,
        tax_rate_percent=order.tax_rate_percent,
        tax_type=order.tax_type,
        is_tax_inclusive=order.is_tax_inclusive,
        is_tax_enabled=order.tax_rate_percent > 0,
    )

    order.subtotal_paise = financials["subtotal_paise"]
    order.discount_paise = financials["discount_paise"]
    order.taxable_amount_paise = financials["taxable_amount_paise"]
    order.cgst_paise = financials["cgst_paise"]
    order.sgst_paise = financials["sgst_paise"]
    order.igst_paise = financials.get("igst_paise", 0)
    order.tax_paise = financials["tax_paise"]
    order.total_paise = financials["grand_total_paise"]
    order.due_amount_paise = max(0, financials["grand_total_paise"] - (order.paid_amount_paise or 0))

    db.commit()
    db.refresh(order)
    return order


@router.get("", response_model=List[OrderResponse])
def list_orders(
    search: Optional[str] = None,
    table_number: Optional[str] = None,
    order_type: Optional[str] = None,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    quick_filter: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Retrieves filtered orders list with full support for:
    - Search (order code, customer name/phone, table number)
    - Specific table number
    - Order type (dine_in, takeaway, delivery)
    - Order status (open, bill_generated, completed, cancelled)
    - Payment status (unpaid, partially_paid, paid, refunded)
    - Date ranges (start_date, end_date)
    - Quick filters (today, active, completed, cancelled, unpaid)
    """
    query = filter_orders_query(
        db=db,
        restaurant_id=restaurant.id,
        search=search,
        table_number=table_number,
        order_type=order_type,
        status=status,
        payment_status=payment_status,
        start_date=start_date,
        end_date=end_date,
        quick_filter=quick_filter,
    )

    return query.offset(offset).limit(limit).all()


@router.get("/{order_id}", response_model=OrderResponse)
def get_order_details(
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
    return order


@router.post("/{order_id}/cancel", response_model=OrderResponse)
def cancel_order(
    order_id: str,
    data: Optional[OrderCancelRequest] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Cancels an active or bill-generated order with mandatory or default audit reason.
    Releases any occupied table back to available.
    Settled orders (completed) cannot be cancelled.
    """
    order = (
        db.query(Order)
        .filter(Order.id == order_id, Order.restaurant_id == restaurant.id)
        .first()
    )
    if not order:
        raise EntityNotFoundException("Order", order_id)

    reason = data.reason if data and data.reason else "Cancelled by operator"
    return cancel_order_with_audit(db=db, order=order, reason=reason)
