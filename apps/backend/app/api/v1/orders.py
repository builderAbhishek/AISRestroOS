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
from app.schemas.order import OrderCreate, OrderUpdateItems, OrderResponse
from app.business_logic.pricing_calculator import (
    calculate_item_price_paise,
    calculate_order_financials,
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
    tax_rate = settings.tax_rate_percent if settings else 5.0
    tax_type = settings.tax_type if settings else "CGST_SGST"

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
    )

    order.subtotal_paise = financials["subtotal_paise"]
    order.discount_paise = financials["discount_paise"]
    order.cgst_paise = financials["cgst_paise"]
    order.sgst_paise = financials["sgst_paise"]
    order.tax_paise = financials["tax_paise"]
    order.total_paise = financials["grand_total_paise"]

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

    # Keep a map of previous printed items
    previous_printed_map = {}
    for item in order.items:
        key = (item.menu_item_id, item.variant_id)
        previous_printed_map[key] = max(
            previous_printed_map.get(key, 0), item.printed_quantity
        )

    # Delete existing items and recreate
    db.query(OrderItem).filter(OrderItem.order_id == order.id).delete()
    db.flush()

    settings = restaurant.settings
    tax_rate = order.tax_rate_percent
    tax_type = settings.tax_type if settings else "CGST_SGST"

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

        key = (menu_item.id, variant.id if variant else None)
        previously_printed = previous_printed_map.get(key, 0)
        printed_qty = min(previously_printed, item_in.quantity)
        kot_status = "printed" if printed_qty >= item_in.quantity else "unprinted"

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
            kot_status=kot_status,
            printed_quantity=printed_qty,
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
        discount_type=order.discount_type,
        discount_value=order.discount_value,
        tax_rate_percent=tax_rate,
        tax_type=tax_type,
    )

    order.subtotal_paise = financials["subtotal_paise"]
    order.discount_paise = financials["discount_paise"]
    order.cgst_paise = financials["cgst_paise"]
    order.sgst_paise = financials["sgst_paise"]
    order.tax_paise = financials["tax_paise"]
    order.total_paise = financials["grand_total_paise"]

    db.commit()
    db.refresh(order)
    return order


@router.get("", response_model=List[OrderResponse])
def list_orders(
    status: Optional[str] = None,
    order_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    query = db.query(Order).filter(Order.restaurant_id == restaurant.id)

    if status:
        query = query.filter(Order.status == status)
    if order_type:
        query = query.filter(Order.order_type == order_type)

    return (
        query.order_by(Order.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


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
    if order.status == "completed":
        raise InvalidOrderStateException("Cannot cancel an already completed and settled order.")

    order.status = "cancelled"

    # Release table if dine-in
    if order.table_id:
        table = db.query(RestaurantTable).filter(RestaurantTable.id == order.table_id).first()
        if table and table.current_order_id == order.id:
            table.status = "available"
            table.current_order_id = None

    db.commit()
    db.refresh(order)
    logger.info(f"Cancelled order {order.order_code}")
    return order
