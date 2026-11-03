from typing import List, Dict, Any, Optional
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_restaurant
from app.models.restaurant import Restaurant, RestaurantSettings
from app.schemas.backup import (
    BackupCreateRequest,
    BackupRestoreRequest,
    BackupValidationResponse,
    BackupRecordResponse,
    AutoBackupConfigRequest,
)
from app.business_logic import backup_service
from app.core.exceptions import AISRestroException
from app.core.logging import logger

router = APIRouter(prefix="/backup", tags=["Backup & Restore"])


@router.post("/create", response_model=BackupRecordResponse)
def create_backup_endpoint(
    data: Optional[BackupCreateRequest] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Generates a standalone SQLite backup archive (.aisbackup) with metadata and SHA-256."""
    dest_dir = data.destination_dir if data else None
    record = backup_service.create_backup(db, restaurant.id, destination_dir=dest_dir, backup_type="manual")
    return record


@router.post("/validate", response_model=BackupValidationResponse)
def validate_backup_endpoint(
    data: BackupRestoreRequest,
    restaurant: Restaurant = Depends(require_restaurant),
):
    """Validates archive integrity and compatibility before restore."""
    archive_path = Path(data.backup_file_path)
    if not archive_path.is_absolute():
        archive_path = backup_service.get_default_backup_dir() / archive_path.name

    result = backup_service.validate_backup(archive_path)
    return BackupValidationResponse(**result)


@router.post("/restore")
def restore_backup_endpoint(
    data: BackupRestoreRequest,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """
    Safely restores database from candidate backup.
    Creates a safety backup of current data first.
    Rolls back automatically if restore fails.
    """
    res = backup_service.restore_backup(db, restaurant.id, data.backup_file_path)
    return res


@router.get("/list", response_model=List[BackupRecordResponse])
def list_backups_endpoint(
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Lists backup history and locally discovered .aisbackup archives."""
    return backup_service.list_backups(db, restaurant.id)


@router.delete("/{backup_id}")
def delete_backup_endpoint(
    backup_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Deletes a backup file and its record."""
    success = backup_service.delete_backup(db, backup_id)
    return {"message": "Backup deleted successfully.", "success": success}


@router.get("/download/{backup_id}")
def download_backup_endpoint(
    backup_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Streams a backup archive file for download."""
    from app.models.backup import BackupRecord
    record = db.query(BackupRecord).filter(BackupRecord.id == backup_id).first()
    if record and Path(record.file_path).exists():
        p = Path(record.file_path)
    else:
        # Check default folder
        p = backup_service.get_default_backup_dir() / backup_id
        if not p.exists() or p.suffix != ".aisbackup":
            raise HTTPException(status_code=404, detail="Backup file not found on disk.")

    return FileResponse(
        path=str(p),
        filename=p.name,
        media_type="application/octet-stream",
    )


@router.post("/auto-config")
def update_auto_backup_config_endpoint(
    data: AutoBackupConfigRequest,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Updates automated backup schedule and destination folder."""
    settings = restaurant.settings
    if not settings:
        settings = RestaurantSettings(restaurant_id=restaurant.id)
        db.add(settings)

    settings.auto_backup_enabled = data.auto_backup_enabled
    settings.auto_backup_interval = data.auto_backup_interval
    settings.auto_backup_time = data.auto_backup_time
    settings.auto_backup_path = data.auto_backup_path
    settings.backup_retention_count = max(1, data.backup_retention_count)

    db.commit()
    db.refresh(settings)
    return {
        "message": "Auto-backup configuration updated.",
        "auto_backup_enabled": settings.auto_backup_enabled,
        "auto_backup_interval": settings.auto_backup_interval,
        "auto_backup_time": settings.auto_backup_time,
        "auto_backup_path": settings.auto_backup_path,
        "backup_retention_count": settings.backup_retention_count,
    }
