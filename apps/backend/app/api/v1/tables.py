from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_restaurant
from app.models.restaurant import Restaurant
from app.models.table import RestaurantTable
from app.models.order import Order
from app.schemas.table import TableCreate, TableUpdate, TableResponse
from app.schemas.order import OrderResponse
from app.core.exceptions import EntityNotFoundException, TableOccupiedException

router = APIRouter(prefix="/tables", tags=["Tables Management"])


@router.get("", response_model=List[TableResponse])
def list_tables(
    section: Optional[str] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    query = db.query(RestaurantTable).filter(RestaurantTable.restaurant_id == restaurant.id)
    if section:
        query = query.filter(RestaurantTable.section == section)
    return query.order_by(RestaurantTable.section, RestaurantTable.table_number).all()


@router.post("", response_model=TableResponse, status_code=status.HTTP_201_CREATED)
def create_table(
    data: TableCreate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    table = RestaurantTable(
        restaurant_id=restaurant.id,
        table_number=data.table_number,
        capacity=data.capacity,
        section=data.section,
        status="available",
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

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(table, field, val)

    db.commit()
    db.refresh(table)
    return table


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

    if table.status == "occupied" or table.current_order_id:
        raise TableOccupiedException(table.table_number, table.current_order_id or "unknown")

    db.delete(table)
    db.commit()
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

    if not table.current_order_id:
        # Also check orders table for any active order linked to this table
        active_order = (
            db.query(Order)
            .filter(
                Order.table_id == table.id,
                Order.restaurant_id == restaurant.id,
                Order.status == "active",
            )
            .first()
        )
        if active_order:
            table.current_order_id = active_order.id
            table.status = "occupied"
            db.commit()
            return active_order
        return None

    order = (
        db.query(Order)
        .filter(Order.id == table.current_order_id, Order.restaurant_id == restaurant.id)
        .first()
    )
    return order
