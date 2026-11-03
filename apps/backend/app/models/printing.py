from typing import Optional
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import TimestampedUUIDModel


class PrintJob(TimestampedUUIDModel):
    __tablename__ = "print_jobs"

    restaurant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    invoice_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    # job_type: kot | invoice | receipt | test
    job_type: Mapped[str] = mapped_column(String(20), nullable=False)
    printer_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # paper_format: 58mm | 80mm | a4
    paper_format: Mapped[str] = mapped_column(String(20), default="80mm", nullable=False)
    # status: success | failed | pending
    status: Mapped[str] = mapped_column(String(20), default="success", nullable=False)
    content_preview: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
