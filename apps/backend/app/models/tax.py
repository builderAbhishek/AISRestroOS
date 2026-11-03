from sqlalchemy import String, Float, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import TimestampedUUIDModel


class TaxConfiguration(TimestampedUUIDModel):
    __tablename__ = "tax_configurations"

    restaurant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    rate_percent: Mapped[float] = mapped_column(Float, nullable=False)
    cgst_percent: Mapped[float] = mapped_column(Float, default=2.5, nullable=False)
    sgst_percent: Mapped[float] = mapped_column(Float, default=2.5, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="tax_configs")
