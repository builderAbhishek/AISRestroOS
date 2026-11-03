from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_restaurant
from app.models.restaurant import Restaurant
from app.models.order import Order
from app.models.kot import KOT
from app.schemas.kot import KOTResponse, KOTPrintResult
from app.core.exceptions import EntityNotFoundException, InvalidOrderStateException
from app.business_logic.kot_manager import generate_incremental_kot
from app.printing.escpos_formatter import format_kot_receipt

router = APIRouter(prefix="/orders", tags=["Kitchen Order Tickets (KOT)"])


@router.post("/{order_id}/kot", response_model=KOTPrintResult, status_code=status.HTTP_201_CREATED)
def add_and_print_kot(
    order_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Primary POS Action: 'Add & Print KOT'.
    Validates the order, generates an incremental KOT ticket containing ONLY
    new or amended items, updates the printed quantities to avoid duplicates,
    and returns printable ESC/POS text.
    """
    order = (
        db.query(Order)
        .filter(Order.id == order_id, Order.restaurant_id == restaurant.id)
        .first()
    )
    if not order:
        raise EntityNotFoundException("Order", order_id)
    if order.status != "active":
        raise InvalidOrderStateException(f"Cannot generate KOT for order in '{order.status}' status.")

    settings = restaurant.settings
    printer_name = settings.kot_printer_name if settings else "Kitchen-Thermal"
    paper_width = settings.paper_width_mm if settings else 80
    chars_width = 42 if paper_width >= 80 else 32

    kot, is_new_items_printed = generate_incremental_kot(
        db=db,
        order=order,
        printer_name=printer_name,
    )

    if not kot:
        raise InvalidOrderStateException("No items available to generate KOT.")

    formatted_text = format_kot_receipt(kot=kot, order=order, width=chars_width)

    message = (
        f"KOT #{kot.kot_code} generated with {len(kot.items)} new items."
        if is_new_items_printed
        else f"All items in order {order.order_code} have already been sent to kitchen."
    )

    return KOTPrintResult(
        kot=kot,
        formatted_text=formatted_text,
        is_new_items_printed=is_new_items_printed,
        printer_status="success",
        message=message,
    )


@router.get("/{order_id}/kots", response_model=List[KOTResponse])
def list_kots_for_order(
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

    return (
        db.query(KOT)
        .filter(KOT.order_id == order.id)
        .order_by(KOT.kot_number.asc())
        .all()
    )


@router.get("/kot/{kot_id}/reprint", response_model=KOTPrintResult)
def reprint_kot(
    kot_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    kot = (
        db.query(KOT)
        .join(Order, KOT.order_id == Order.id)
        .filter(KOT.id == kot_id, Order.restaurant_id == restaurant.id)
        .first()
    )
    if not kot:
        raise EntityNotFoundException("KOT", kot_id)

    kot.status = "reprinted"
    db.commit()
    db.refresh(kot)

    order = kot.order
    settings = restaurant.settings
    paper_width = settings.paper_width_mm if settings else 80
    chars_width = 42 if paper_width >= 80 else 32

    formatted_text = format_kot_receipt(kot=kot, order=order, width=chars_width)

    return KOTPrintResult(
        kot=kot,
        formatted_text=formatted_text,
        is_new_items_printed=False,
        printer_status="success",
        message=f"KOT {kot.kot_code} reprinted successfully.",
    )
