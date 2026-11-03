from typing import Tuple, List, Optional
from sqlalchemy.orm import Session
from app.models.order import Order, OrderItem
from app.models.kot import KOT, KOTItem
from app.core.logging import logger


def generate_incremental_kot(
    db: Session,
    order: Order,
    printer_name: Optional[str] = "Kitchen-Thermal",
) -> Tuple[Optional[KOT], bool]:
    """
    Examines all order items. Identifies any items where quantity > printed_quantity.
    Creates a new KOT containing ONLY the incremental items/quantities.
    Updates the printed_quantity on the order items.
    Returns (KOT, is_new_items_printed).
    If no new items exist, returns the most recent KOT if available, with is_new_items_printed=False.
    """
    incremental_items_data = []

    for item in order.items:
        unprinted_qty = item.quantity - item.printed_quantity
        if unprinted_qty > 0:
            addons_summary = ", ".join([a.addon_name for a in item.addons]) if item.addons else None
            incremental_items_data.append({
                "order_item": item,
                "unprinted_qty": unprinted_qty,
                "addons_summary": addons_summary,
            })

    if not incremental_items_data:
        # No new items to print
        latest_kot = (
            db.query(KOT)
            .filter(KOT.order_id == order.id)
            .order_by(KOT.kot_number.desc())
            .first()
        )
        return latest_kot, False

    # Calculate sequential KOT number for this order
    existing_kots_count = db.query(KOT).filter(KOT.order_id == order.id).count()
    new_kot_number = existing_kots_count + 1
    kot_code = f"{order.order_code}-K{new_kot_number}"

    new_kot = KOT(
        order_id=order.id,
        kot_number=new_kot_number,
        kot_code=kot_code,
        status="printed",
        printer_name=printer_name or "Kitchen-Thermal",
    )
    db.add(new_kot)
    db.flush()

    for item_data in incremental_items_data:
        order_item = item_data["order_item"]
        qty = item_data["unprinted_qty"]

        kot_item = KOTItem(
            kot_id=new_kot.id,
            order_item_id=order_item.id,
            item_name=order_item.item_name,
            variant_name=order_item.variant_name,
            addons_summary=item_data["addons_summary"],
            quantity=qty,
            notes=order_item.notes,
        )
        db.add(kot_item)

        # Update order item's printed count
        order_item.printed_quantity = order_item.quantity
        order_item.kot_status = "printed"

    db.commit()
    db.refresh(new_kot)
    logger.info(f"Generated incremental KOT {kot_code} with {len(incremental_items_data)} items for order {order.order_code}")
    return new_kot, True
