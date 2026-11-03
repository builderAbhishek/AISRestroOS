from typing import Optional
from sqlalchemy import String, Integer, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import TimestampedUUIDModel


class RestaurantTable(TimestampedUUIDModel):
    __tablename__ = "restaurant_tables"

    restaurant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    table_number: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    capacity: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    section: Mapped[str] = mapped_column(String(50), default="Main Hall", nullable=False)
    # Status: available | occupied | reserved
    status: Mapped[str] = mapped_column(String(20), default="available", nullable=False, index=True)
    current_order_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="tables")
