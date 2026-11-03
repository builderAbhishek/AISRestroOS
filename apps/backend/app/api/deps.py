from typing import Generator, Optional
from fastapi import Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.restaurant import Restaurant


def get_current_restaurant(db: Session = Depends(get_db)) -> Optional[Restaurant]:
    """Retrieves the active restaurant entity (single-tenant local offline DB)."""
    return db.query(Restaurant).first()


def require_restaurant(
    restaurant: Optional[Restaurant] = Depends(get_current_restaurant),
) -> Restaurant:
    from app.core.exceptions import RestaurantNotConfiguredException

    if not restaurant:
        raise RestaurantNotConfiguredException()
    return restaurant
