from typing import Optional
from sqlalchemy import String, Integer, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import TimestampedUUIDModel


class BackupRecord(TimestampedUUIDModel):
    __tablename__ = "backup_records"

    restaurant_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # backup_type: manual | automatic | safety_pre_restore
    backup_type: Mapped[str] = mapped_column(String(30), default="manual", nullable=False)
    # status: success | failed | in_progress
    status: Mapped[str] = mapped_column(String(20), default="success", nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    version: Mapped[str] = mapped_column(String(20), default="1.0.0", nullable=False)
    tables_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
