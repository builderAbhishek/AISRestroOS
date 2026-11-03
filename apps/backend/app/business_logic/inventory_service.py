from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from app.models.inventory import (
    InventoryCategory,
    Supplier,
    InventoryItem,
    Purchase,
    PurchaseItem,
    SupplierPayment,
    StockMovement,
    Recipe,
    RecipeIngredient,
    WastageRecord,
)
from app.models.order import Order
from app.core.exceptions import AISRestroException, EntityNotFoundException
from app.core.logging import logger

# Supported units definition
WEIGHT_UNITS = {
    "kg": 1000.0,
    "g": 1.0,
}
VOLUME_UNITS = {
    "l": 1000.0,
    "litre": 1000.0,
    "ml": 1.0,
}
DISCRETE_UNITS = {
    "pcs": 1.0,
    "piece": 1.0,
    "packet": 1.0,
    "bottle": 1.0,
    "box": 1.0,
}


def normalize_unit(unit_str: str) -> str:
    u = unit_str.strip().lower()
    if u in ("l", "litre", "liter"):
        return "L"
    if u in ("kg", "kilogram"):
        return "kg"
    if u in ("g", "gram", "gm"):
        return "g"
    if u in ("ml", "millilitre", "milliliter"):
        return "ml"
    if u in ("pcs", "piece", "pieces"):
        return "pcs"
    if u in ("packet", "packets", "pkt"):
        return "packet"
    if u in ("bottle", "bottles", "btl"):
        return "bottle"
    if u in ("box", "boxes"):
        return "box"
    return unit_str.strip()


def convert_quantity(quantity: float, from_unit: str, to_unit: str) -> float:
    """
    Converts a physical quantity between compatible units.
    Weights: kg <-> g
    Volumes: L <-> ml
    Discrete: pcs, packet, bottle, box
    Raises AISRestroException on dimension mismatch.
    """
    u_from = from_unit.strip().lower()
    u_to = to_unit.strip().lower()

    if u_from == u_to:
        return float(quantity)

    # Check Weight
    if u_from in WEIGHT_UNITS and u_to in WEIGHT_UNITS:
        from_factor = WEIGHT_UNITS[u_from]
        to_factor = WEIGHT_UNITS[u_to]
        return round((quantity * from_factor) / to_factor, 4)

    # Check Volume
    if u_from in VOLUME_UNITS and u_to in VOLUME_UNITS:
        from_factor = VOLUME_UNITS[u_from]
        to_factor = VOLUME_UNITS[u_to]
        return round((quantity * from_factor) / to_factor, 4)

    # Check Discrete
    if u_from in DISCRETE_UNITS and u_to in DISCRETE_UNITS:
        if u_from == u_to:
            return float(quantity)
        raise AISRestroException(
            f"Cannot automatically convert between distinct discrete units '{from_unit}' and '{to_unit}'."
        )

    raise AISRestroException(
        f"Incompatible unit conversion: Cannot convert '{from_unit}' to '{to_unit}'."
    )


def calculate_weighted_average_cost(
    current_stock: float,
    current_cost_paise: int,
    added_stock: Optional[float] = None,
    added_cost_paise: Optional[int] = None,
    incoming_quantity: Optional[float] = None,
    incoming_unit_cost_paise: Optional[int] = None,
) -> int:
    """
    Calculates weighted average purchase cost in integer paise.
    Formula: ((S_old * C_old) + (S_new * C_new)) / (S_old + S_new)
    If existing stock is <= 0, the new purchase cost becomes the new average.
    """
    added_qty = added_stock if added_stock is not None else (incoming_quantity or 0.0)
    in_cost = added_cost_paise if added_cost_paise is not None else (incoming_unit_cost_paise or 0)

    if current_stock <= 0:
        return max(0, int(in_cost))

    total_stock = current_stock + added_qty
    if total_stock <= 0:
        return max(0, int(in_cost))

    old_total_val = current_stock * current_cost_paise
    new_total_val = added_qty * in_cost
    weighted_avg = (old_total_val + new_total_val) / total_stock
    return max(0, int(round(weighted_avg)))


def receive_purchase(db: Session, purchase: Purchase) -> Purchase:
    """
    Transitions purchase from 'draft' to 'received'.
    Atomically updates inventory item stocks and weighted average cost prices.
    Creates immutable StockMovement records (PURCHASE_IN).
    Idempotent: Cannot receive an already received or cancelled purchase.
    """
    if purchase.status == "received":
        raise AISRestroException(f"Purchase {purchase.purchase_number} is already marked received.")
    if purchase.status == "cancelled":
        raise AISRestroException(f"Cannot receive cancelled purchase {purchase.purchase_number}.")

    for item in purchase.items:
        inv_item = db.query(InventoryItem).filter(InventoryItem.id == item.inventory_item_id).first()
        if not inv_item:
            raise EntityNotFoundException("InventoryItem", item.inventory_item_id)

        # Convert quantity to inventory item's unit
        qty_in_inv_unit = convert_quantity(item.quantity, item.unit, inv_item.unit)

        # Calculate unit cost in inventory item's unit
        unit_cost_in_inv_unit = int(round((item.unit_cost_paise * item.quantity) / qty_in_inv_unit))

        new_avg_cost = calculate_weighted_average_cost(
            current_stock=inv_item.current_stock,
            current_cost_paise=inv_item.cost_price_paise,
            added_stock=qty_in_inv_unit,
            added_cost_paise=unit_cost_in_inv_unit,
        )

        prev_stock = inv_item.current_stock
        new_stock = round(prev_stock + qty_in_inv_unit, 4)

        inv_item.current_stock = new_stock
        inv_item.cost_price_paise = new_avg_cost

        movement = StockMovement(
            restaurant_id=purchase.restaurant_id,
            inventory_item_id=inv_item.id,
            movement_type="PURCHASE_IN",
            quantity=qty_in_inv_unit,
            unit=inv_item.unit,
            previous_stock=prev_stock,
            new_stock=new_stock,
            unit_cost_paise=unit_cost_in_inv_unit,
            total_cost_paise=item.line_total_paise,
            reference_type="purchase",
            reference_id=purchase.id,
            reference_code=purchase.purchase_number,
            reason=f"Purchase received: {purchase.purchase_number} from {purchase.supplier.name}",
        )
        db.add(movement)

    purchase.status = "received"
    purchase.received_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(purchase)
    logger.info(f"Received purchase {purchase.purchase_number} with stock updates")
    return purchase


def cancel_purchase_with_stock_reversal(
    db: Session,
    purchase: Purchase,
    reason: str,
) -> Purchase:
    """
    Cancels a purchase. If it was already received, reverses added stock
    and records PURCHASE_RETURN movements for full auditability.
    """
    if purchase.status == "cancelled":
        raise AISRestroException(f"Purchase {purchase.purchase_number} is already cancelled.")

    if purchase.status == "received":
        for item in purchase.items:
            inv_item = db.query(InventoryItem).filter(InventoryItem.id == item.inventory_item_id).first()
            if inv_item:
                qty_in_inv_unit = convert_quantity(item.quantity, item.unit, inv_item.unit)
                prev_stock = inv_item.current_stock
                new_stock = round(prev_stock - qty_in_inv_unit, 4)
                inv_item.current_stock = new_stock

                movement = StockMovement(
                    restaurant_id=purchase.restaurant_id,
                    inventory_item_id=inv_item.id,
                    movement_type="PURCHASE_RETURN",
                    quantity=-qty_in_inv_unit,
                    unit=inv_item.unit,
                    previous_stock=prev_stock,
                    new_stock=new_stock,
                    unit_cost_paise=inv_item.cost_price_paise,
                    total_cost_paise=round(qty_in_inv_unit * inv_item.cost_price_paise),
                    reference_type="purchase",
                    reference_id=purchase.id,
                    reference_code=purchase.purchase_number,
                    reason=f"Purchase cancelled: {reason}",
                )
                db.add(movement)

    purchase.status = "cancelled"
    purchase.cancelled_at = datetime.now(timezone.utc)
    purchase.cancellation_reason = reason.strip()
    db.commit()
    db.refresh(purchase)
    logger.info(f"Cancelled purchase {purchase.purchase_number}. Reason: {reason}")
    return purchase


def record_wastage(
    db: Session,
    restaurant_id: str,
    inventory_item_id: str,
    quantity: float,
    unit: str,
    reason: str,
    notes: Optional[str] = None,
) -> WastageRecord:
    """
    Records an inventory wastage event, reduces stock, and creates a ledger entry.
    """
    inv_item = (
        db.query(InventoryItem)
        .filter(InventoryItem.id == inventory_item_id, InventoryItem.restaurant_id == restaurant_id)
        .first()
    )
    if not inv_item:
        raise EntityNotFoundException("InventoryItem", inventory_item_id)

    if quantity <= 0:
        raise AISRestroException("Wastage quantity must be greater than zero.")

    qty_in_inv_unit = convert_quantity(quantity, unit, inv_item.unit)
    prev_stock = inv_item.current_stock
    new_stock = round(prev_stock - qty_in_inv_unit, 4)
    inv_item.current_stock = new_stock

    cost_paise = int(round(qty_in_inv_unit * inv_item.cost_price_paise))

    record = WastageRecord(
        restaurant_id=restaurant_id,
        inventory_item_id=inv_item.id,
        quantity=qty_in_inv_unit,
        unit=inv_item.unit,
        cost_paise=cost_paise,
        reason=reason.strip(),
        notes=notes.strip() if notes else None,
    )
    db.add(record)
    db.flush()

    movement = StockMovement(
        restaurant_id=restaurant_id,
        inventory_item_id=inv_item.id,
        movement_type="WASTAGE",
        quantity=-qty_in_inv_unit,
        unit=inv_item.unit,
        previous_stock=prev_stock,
        new_stock=new_stock,
        unit_cost_paise=inv_item.cost_price_paise,
        total_cost_paise=cost_paise,
        reference_type="wastage",
        reference_id=record.id,
        reason=f"Wastage: {reason}" + (f" ({notes})" if notes else ""),
    )
    db.add(movement)
    db.commit()
    db.refresh(record)
    logger.info(f"Recorded wastage of {qty_in_inv_unit} {inv_item.unit} for {inv_item.name}")
    return record


def record_stock_adjustment(
    db: Session,
    inventory_item_id: str,
    adjustment_type: str,  # add | subtract | set | increase | decrease
    quantity: float,
    reason: str,
    unit: Optional[str] = None,
    restaurant_id: Optional[str] = None,
    notes: Optional[str] = None,
) -> StockMovement:
    """
    Records a manual inventory stock adjustment (audit correction) with mandatory reason.
    Supports add/increase, subtract/decrease, or set to target value.
    """
    query = db.query(InventoryItem).filter(InventoryItem.id == inventory_item_id)
    if restaurant_id:
        query = query.filter(InventoryItem.restaurant_id == restaurant_id)
    inv_item = query.first()
    if not inv_item:
        raise EntityNotFoundException("InventoryItem", inventory_item_id)

    if not reason or not reason.strip():
        raise AISRestroException("Mandatory reason required for manual stock adjustments.")

    effective_unit = unit or inv_item.unit
    prev_stock = inv_item.current_stock

    adj_type = adjustment_type.lower()
    if adj_type in ("increase", "add"):
        if quantity <= 0:
            raise AISRestroException("Adjustment quantity must be greater than zero.")
        qty_in_inv_unit = convert_quantity(quantity, effective_unit, inv_item.unit)
        new_stock = round(prev_stock + qty_in_inv_unit, 4)
        m_type = "MANUAL_ADJUSTMENT_IN"
        delta = qty_in_inv_unit
    elif adj_type in ("decrease", "subtract"):
        if quantity <= 0:
            raise AISRestroException("Adjustment quantity must be greater than zero.")
        qty_in_inv_unit = convert_quantity(quantity, effective_unit, inv_item.unit)
        new_stock = round(prev_stock - qty_in_inv_unit, 4)
        m_type = "MANUAL_ADJUSTMENT_OUT"
        delta = -qty_in_inv_unit
    elif adj_type == "set":
        qty_in_inv_unit = convert_quantity(quantity, effective_unit, inv_item.unit)
        diff = round(qty_in_inv_unit - prev_stock, 4)
        new_stock = round(qty_in_inv_unit, 4)
        if diff >= 0:
            m_type = "MANUAL_ADJUSTMENT_IN"
            delta = diff
        else:
            m_type = "MANUAL_ADJUSTMENT_OUT"
            delta = diff
    else:
        raise AISRestroException(f"Invalid adjustment type '{adjustment_type}'. Must be 'add', 'subtract', or 'set'.")

    inv_item.current_stock = new_stock
    total_cost = int(round(abs(delta) * inv_item.cost_price_paise))

    movement = StockMovement(
        restaurant_id=inv_item.restaurant_id,
        inventory_item_id=inv_item.id,
        movement_type=m_type,
        quantity=delta,
        unit=inv_item.unit,
        previous_stock=prev_stock,
        new_stock=new_stock,
        unit_cost_paise=inv_item.cost_price_paise,
        total_cost_paise=total_cost,
        reference_type="manual_adjustment",
        reason=reason.strip() + (f" ({notes.strip()})" if notes and notes.strip() else ""),
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    logger.info(f"Adjusted stock for {inv_item.name}: {prev_stock} -> {new_stock} ({m_type})")
    return movement


def consume_stock_for_order(db: Session, order: Order) -> List[StockMovement]:
    """
    Calculates ingredient consumption for a settled/completed POS order using saved Recipes.
    Deducts stock transactionally and records SALE_CONSUMPTION movements.
    IDEMPOTENCY GUARANTEE: Checks if consumption movements for this order already exist.
    """
    # Check if stock has already been consumed for this order
    existing_movement = (
        db.query(StockMovement)
        .filter(
            StockMovement.reference_type == "order",
            StockMovement.reference_id == order.id,
            StockMovement.movement_type == "SALE_CONSUMPTION",
        )
        .first()
    )
    if existing_movement:
        logger.info(f"Stock already consumed for order {order.order_code}. Skipping duplicate consumption.")
        return []

    movements = []

    for item in order.items:
        # 1. Look for variant-specific recipe first
        recipe = None
        if item.variant_id:
            recipe = (
                db.query(Recipe)
                .filter(
                    Recipe.menu_item_id == item.menu_item_id,
                    Recipe.variant_id == item.variant_id,
                    Recipe.restaurant_id == order.restaurant_id,
                )
                .first()
            )

        # 2. Fallback to generic item recipe
        if not recipe:
            recipe = (
                db.query(Recipe)
                .filter(
                    Recipe.menu_item_id == item.menu_item_id,
                    Recipe.variant_id.is_(None),
                    Recipe.restaurant_id == order.restaurant_id,
                )
                .first()
            )

        if not recipe or not recipe.ingredients:
            continue

        for ingredient in recipe.ingredients:
            inv_item = (
                db.query(InventoryItem)
                .filter(InventoryItem.id == ingredient.inventory_item_id)
                .first()
            )
            if not inv_item:
                continue

            total_ingredient_needed = ingredient.quantity * item.quantity
            qty_in_inv_unit = convert_quantity(
                total_ingredient_needed, ingredient.unit, inv_item.unit
            )

            prev_stock = inv_item.current_stock
            new_stock = round(prev_stock - qty_in_inv_unit, 4)
            inv_item.current_stock = new_stock

            cost_paise = int(round(qty_in_inv_unit * inv_item.cost_price_paise))

            movement = StockMovement(
                restaurant_id=order.restaurant_id,
                inventory_item_id=inv_item.id,
                movement_type="SALE_CONSUMPTION",
                quantity=-qty_in_inv_unit,
                unit=inv_item.unit,
                previous_stock=prev_stock,
                new_stock=new_stock,
                unit_cost_paise=inv_item.cost_price_paise,
                total_cost_paise=cost_paise,
                reference_type="order",
                reference_id=order.id,
                reference_code=order.order_code,
                reason=f"POS Sale: {item.quantity}x {item.item_name}"
                + (f" ({item.variant_name})" if item.variant_name else ""),
            )
            db.add(movement)
            movements.append(movement)

    if movements:
        db.commit()
        logger.info(f"Consumed stock for {len(movements)} ingredients for order {order.order_code}")

    return movements


def reverse_stock_for_order(
    db: Session,
    order: Order,
    reason: str,
) -> List[StockMovement]:
    """
    Reverses previously deducted stock for a cancelled or refunded order.
    Creates SALE_REVERSAL movements. Idempotent: will not reverse twice.
    """
    # Locate all SALE_CONSUMPTION movements for this order
    consumptions = (
        db.query(StockMovement)
        .filter(
            StockMovement.reference_type == "order",
            StockMovement.reference_id == order.id,
            StockMovement.movement_type == "SALE_CONSUMPTION",
        )
        .all()
    )
    if not consumptions:
        return []

    # Check if already reversed
    existing_reversal = (
        db.query(StockMovement)
        .filter(
            StockMovement.reference_type == "order",
            StockMovement.reference_id == order.id,
            StockMovement.movement_type == "SALE_REVERSAL",
        )
        .first()
    )
    if existing_reversal:
        logger.info(f"Stock already reversed for order {order.order_code}. Skipping duplicate reversal.")
        return []

    reversals = []
    for c in consumptions:
        inv_item = db.query(InventoryItem).filter(InventoryItem.id == c.inventory_item_id).first()
        if not inv_item:
            continue

        restore_qty = abs(c.quantity)
        prev_stock = inv_item.current_stock
        new_stock = round(prev_stock + restore_qty, 4)
        inv_item.current_stock = new_stock

        movement = StockMovement(
            restaurant_id=order.restaurant_id,
            inventory_item_id=inv_item.id,
            movement_type="SALE_REVERSAL",
            quantity=restore_qty,
            unit=c.unit,
            previous_stock=prev_stock,
            new_stock=new_stock,
            unit_cost_paise=c.unit_cost_paise,
            total_cost_paise=c.total_cost_paise,
            reference_type="order",
            reference_id=order.id,
            reference_code=order.order_code,
            reason=f"Order cancellation stock reversal: {reason}",
        )
        db.add(movement)
        reversals.append(movement)

    if reversals:
        db.commit()
        logger.info(f"Reversed stock for {len(reversals)} ingredients for order {order.order_code}")

    return reversals
