from typing import Optional, Dict, Any, List, Union
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class BackupCreateRequest(BaseModel):
    destination_dir: Optional[str] = None


class BackupRestoreRequest(BaseModel):
    backup_file_path: str


class BackupValidationResponse(BaseModel):
    valid: bool
    metadata: Dict[str, Any]
    tables_count: int
    records_count: int
    integrity: str
    file_size_bytes: int


class BackupRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    file_path: str
    file_size_bytes: int
    backup_type: str
    status: str
    duration_ms: int
    version: str
    tables_count: int
    records_count: int
    error_message: Optional[str] = None
    created_at: Optional[Union[datetime, str]] = None
    file_exists: bool = True


class AutoBackupConfigRequest(BaseModel):
    auto_backup_enabled: bool
    auto_backup_interval: str = "daily"  # daily | weekly
    auto_backup_time: str = "23:00"
    auto_backup_path: Optional[str] = None
    backup_retention_count: int = 15
