import os
import io
import time
import json
import zipfile
import hashlib
import sqlite3
import shutil
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import AISRestroException
from app.models.backup import BackupRecord
from app.models.restaurant import Restaurant, RestaurantSettings


def get_sqlite_db_path() -> Path:
    """Extracts absolute SQLite file path from DATABASE_URL."""
    db_url = settings.DATABASE_URL
    if db_url.startswith("sqlite:///"):
        path_str = db_url[len("sqlite:///"):]
        if len(path_str) > 2 and path_str[0] == "/" and path_str[2] == ":":
            path_str = path_str[1:]
        return Path(path_str).resolve()
    raise AISRestroException("Backup service is only configured for SQLite offline databases.")


def get_default_backup_dir() -> Path:
    """Returns the default backups directory outside the installation folder."""
    backup_dir_env = os.getenv("BACKUP_DIR")
    if backup_dir_env:
        backup_dir = Path(backup_dir_env)
    else:
        db_path = get_sqlite_db_path()
        backup_dir = db_path.parent.parent / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    return backup_dir


def compute_sha256(file_path: Path) -> str:
    """Computes SHA-256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def inspect_sqlite_counts(sqlite_file: Path) -> Tuple[int, int]:
    """Inspects table and record counts from an offline SQLite file."""
    conn = sqlite3.connect(str(sqlite_file))
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    tables = [row[0] for row in cursor.fetchall()]
    total_records = 0
    for tbl in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM `{tbl}`;")
            total_records += cursor.fetchone()[0]
        except Exception:
            pass
    conn.close()
    return len(tables), total_records


def perform_sqlite_online_backup(src_path: Path, dst_path: Path):
    """
    Safely executes an online backup using SQLite's backup API.
    Flushes WAL transactions safely without reading corrupted partial writes.
    """
    src_conn = sqlite3.connect(str(src_path), timeout=10.0)
    # Ensure WAL is checkpointed if possible
    try:
        src_conn.execute("PRAGMA wal_checkpoint(PASSIVE);")
    except Exception as e:
        logger.warning(f"Passive WAL checkpoint notice: {e}")

    dst_conn = sqlite3.connect(str(dst_path))
    src_conn.backup(dst_conn, pages=250)
    dst_conn.close()
    src_conn.close()


def create_backup(
    db: Session,
    restaurant_id: str,
    destination_dir: Optional[str] = None,
    backup_type: str = "manual",
) -> BackupRecord:
    """
    Creates a full, standalone, timestamped .aisbackup archive containing:
      1. database.sqlite (safe online backup copy)
      2. metadata.json (restaurant, version, tables, checksum, timestamp)
    """
    start_time = time.time()
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise AISRestroException("Restaurant not found.")

    target_dir = Path(destination_dir) if destination_dir else get_default_backup_dir()
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        raise AISRestroException(f"Cannot create or access backup destination directory: {e}")

    db_path = get_sqlite_db_path()
    if not db_path.exists():
        raise AISRestroException(f"Database file not found at {db_path}")

    now_utc = datetime.now(timezone.utc)
    timestamp_str = now_utc.strftime("%Y%m%d_%H%M%S")
    safe_name = "".join(c if c.isalnum() else "_" for c in restaurant.name).lower().strip("_")
    filename = f"AISRestroOS_backup_{safe_name}_{timestamp_str}.aisbackup"
    archive_path = target_dir / filename

    temp_sqlite = target_dir / f"temp_{timestamp_str}.sqlite"

    try:
        # Step 1: Perform safe online SQLite backup to temp file
        perform_sqlite_online_backup(db_path, temp_sqlite)

        # Step 2: Calculate checksum & counts
        sha256_hash = compute_sha256(temp_sqlite)
        tables_cnt, records_cnt = inspect_sqlite_counts(temp_sqlite)

        metadata = {
            "app_name": "AISRestroOS",
            "app_version": settings.APP_VERSION,
            "created_at": now_utc.isoformat(),
            "restaurant_id": restaurant.id,
            "restaurant_name": restaurant.name,
            "tables_count": tables_cnt,
            "records_count": records_cnt,
            "sha256": sha256_hash,
            "format": "aisbackup-v1",
        }

        # Step 3: Bundle into ZIP archive
        uploads_dir_env = os.getenv("UPLOADS_DIR")
        uploads_dir = Path(uploads_dir_env) if uploads_dir_env else db_path.parent.parent / "uploads"
        with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
            zip_file.write(temp_sqlite, arcname="database.sqlite")
            zip_file.writestr("metadata.json", json.dumps(metadata, indent=2))
            if uploads_dir.exists():
                for root, _, files in os.walk(uploads_dir):
                    for file in files:
                        full_p = Path(root) / file
                        rel_p = full_p.relative_to(uploads_dir)
                        zip_file.write(full_p, arcname=f"uploads/{rel_p.as_posix()}")

        duration_ms = int((time.time() - start_time) * 1000)
        file_size_bytes = archive_path.stat().st_size

        # Step 4: Record in database
        record = BackupRecord(
            restaurant_id=restaurant.id,
            filename=filename,
            file_path=str(archive_path.resolve()),
            file_size_bytes=file_size_bytes,
            backup_type=backup_type,
            status="success",
            duration_ms=duration_ms,
            version=settings.APP_VERSION,
            tables_count=tables_cnt,
            records_count=records_cnt,
        )
        db.add(record)

        # Update last backup status in RestaurantSettings
        if restaurant.settings:
            restaurant.settings.last_backup_at = now_utc.isoformat()
            restaurant.settings.last_backup_status = "success"

        db.commit()
        db.refresh(record)

        # Clean up older backups according to retention policy
        retention = restaurant.settings.backup_retention_count if restaurant.settings else 15
        cleanup_old_backups(target_dir, retention_count=retention)

        logger.info(f"Created backup {filename} ({file_size_bytes} bytes in {duration_ms}ms)")
        return record

    except Exception as e:
        logger.error(f"Backup failed: {e}", exc_info=True)
        if archive_path.exists():
            archive_path.unlink()
        if restaurant.settings:
            restaurant.settings.last_backup_status = f"failed: {str(e)[:100]}"
            db.commit()
        raise AISRestroException(f"Failed to create backup: {e}")
    finally:
        if temp_sqlite.exists():
            temp_sqlite.unlink()


def validate_backup(archive_path: Path) -> Dict[str, Any]:
    """
    Validates backup archive integrity:
    1. Valid zip file
    2. Contains database.sqlite & metadata.json
    3. Matches SHA-256 hash
    4. Passes SQLite PRAGMA integrity_check
    """
    if not archive_path.exists():
        raise AISRestroException(f"Backup file not found: {archive_path.name}")

    if not zipfile.is_zipfile(archive_path):
        raise AISRestroException("File is not a valid AISRestroOS backup archive.")

    with zipfile.ZipFile(archive_path, "r") as zip_file:
        namelist = zip_file.namelist()
        if "database.sqlite" not in namelist or "metadata.json" not in namelist:
            raise AISRestroException("Corrupted backup: Missing required database or metadata inside archive.")

        meta_raw = zip_file.read("metadata.json")
        try:
            metadata = json.loads(meta_raw.decode("utf-8"))
        except Exception:
            raise AISRestroException("Corrupted backup: Invalid metadata JSON.")

        # Extract database to a temporary location to verify integrity
        temp_dir = archive_path.parent / f"verify_{int(time.time())}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        temp_db = temp_dir / "database.sqlite"
        try:
            with open(temp_db, "wb") as f_out:
                f_out.write(zip_file.read("database.sqlite"))

            actual_sha = compute_sha256(temp_db)
            expected_sha = metadata.get("sha256")
            if expected_sha and actual_sha != expected_sha:
                raise AISRestroException("Integrity check failed: Database checksum mismatch.")

            # Test SQLite integrity
            conn = sqlite3.connect(str(temp_db))
            cursor = conn.cursor()
            cursor.execute("PRAGMA integrity_check;")
            integrity_result = cursor.fetchone()[0]
            if integrity_result != "ok":
                conn.close()
                raise AISRestroException(f"SQLite PRAGMA integrity check failed: {integrity_result}")

            # Check if restaurant table exists
            cursor.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='restaurants';")
            if cursor.fetchone()[0] == 0:
                conn.close()
                raise AISRestroException("Invalid backup: No restaurant data schema found.")

            conn.close()
            return {
                "valid": True,
                "metadata": metadata,
                "tables_count": metadata.get("tables_count", 0),
                "records_count": metadata.get("records_count", 0),
                "integrity": "ok",
                "file_size_bytes": archive_path.stat().st_size,
            }
        finally:
            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)


def restore_backup(
    db: Session,
    restaurant_id: str,
    backup_file_path: str,
) -> Dict[str, Any]:
    """
    Executes a safe restore:
    1. Validates candidate backup integrity first.
    2. Takes a SAFETY BACKUP of current live database.
    3. Restores database from candidate backup using safe online restore.
    4. Runs PRAGMA integrity_check on live database.
    5. If any failure occurs, restores the safety backup immediately!
    """
    archive_path = Path(backup_file_path)
    if not archive_path.is_absolute():
        archive_path = get_default_backup_dir() / archive_path.name

    validation = validate_backup(archive_path)
    if not validation.get("valid"):
        raise AISRestroException("Cannot restore: Backup validation failed.")

    db_path = get_sqlite_db_path()

    # Step 1: Create SAFETY BACKUP of current database before touching anything
    logger.info("Creating safety backup before executing restore...")
    safety_record = create_backup(db, restaurant_id, backup_type="safety_pre_restore")
    safety_archive_path = Path(safety_record.file_path)

    temp_dir = get_default_backup_dir() / f"restore_{int(time.time())}"
    temp_dir.mkdir(parents=True, exist_ok=True)
    extracted_db = temp_dir / "extracted_database.sqlite"

    try:
        # Extract candidate database and uploaded assets
        uploads_dir_env = os.getenv("UPLOADS_DIR")
        uploads_dir = Path(uploads_dir_env) if uploads_dir_env else db_path.parent.parent / "uploads"
        uploads_dir.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(archive_path, "r") as z:
            with open(extracted_db, "wb") as f_out:
                f_out.write(z.read("database.sqlite"))

            # Restore uploaded files if present in archive
            for member in z.namelist():
                if member.startswith("uploads/") and not member.endswith("/"):
                    rel_member = member[len("uploads/"):]
                    target_file = uploads_dir / rel_member
                    target_file.parent.mkdir(parents=True, exist_ok=True)
                    with open(target_file, "wb") as f_up:
                        f_up.write(z.read(member))

        # Close existing session handles on live database
        db.commit()

        # Safely restore from extracted database into live database using SQLite online backup
        perform_sqlite_online_backup(extracted_db, db_path)

        # Verify live database integrity
        test_conn = sqlite3.connect(str(db_path))
        test_cur = test_conn.cursor()
        test_cur.execute("PRAGMA integrity_check;")
        res = test_cur.fetchone()[0]
        test_conn.close()

        if res != "ok":
            raise AISRestroException(f"Restored database integrity check failed with: {res}")

        logger.info(f"Database restored successfully from {archive_path.name}")
        return {
            "status": "success",
            "message": f"Database successfully restored from {archive_path.name}",
            "restored_version": validation["metadata"].get("app_version"),
            "restaurant_name": validation["metadata"].get("restaurant_name"),
            "safety_backup": safety_record.filename,
        }

    except Exception as e:
        logger.error(f"Restore failed: {e}. Initiating automatic rollback from safety backup...", exc_info=True)
        # Rollback using safety backup
        try:
            with zipfile.ZipFile(safety_archive_path, "r") as sz:
                with open(extracted_db, "wb") as f_out:
                    f_out.write(sz.read("database.sqlite"))
            perform_sqlite_online_backup(extracted_db, db_path)
            logger.info("Rollback to safety backup completed.")
        except Exception as rollback_err:
            logger.critical(f"FATAL: Rollback to safety backup also failed: {rollback_err}")

        raise AISRestroException(
            f"Restore operation failed: {e}. Previous database state has been safely preserved."
        )
    finally:
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)


def list_backups(db: Session, restaurant_id: str) -> List[Dict[str, Any]]:
    """Returns list of backups from database records and scans local backup folder."""
    records = (
        db.query(BackupRecord)
        .filter(BackupRecord.restaurant_id == restaurant_id)
        .order_by(BackupRecord.created_at.desc())
        .all()
    )

    known_paths = {r.file_path for r in records}
    backup_dir = get_default_backup_dir()

    results = []
    for r in records:
        f_exists = Path(r.file_path).exists()
        results.append({
            "id": r.id,
            "filename": r.filename,
            "file_path": r.file_path,
            "file_size_bytes": r.file_size_bytes,
            "backup_type": r.backup_type,
            "status": r.status,
            "duration_ms": r.duration_ms,
            "version": r.version,
            "tables_count": r.tables_count,
            "records_count": r.records_count,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "file_exists": f_exists,
        })

    # Pick up untracked .aisbackup files placed in directory
    if backup_dir.exists():
        for p in backup_dir.glob("*.aisbackup"):
            p_str = str(p.resolve())
            if p_str not in known_paths:
                stat = p.stat()
                results.append({
                    "id": p.name,
                    "filename": p.name,
                    "file_path": p_str,
                    "file_size_bytes": stat.st_size,
                    "backup_type": "external",
                    "status": "success",
                    "duration_ms": 0,
                    "version": "1.0.0",
                    "tables_count": 0,
                    "records_count": 0,
                    "error_message": None,
                    "created_at": datetime.fromtimestamp(stat.st_ctime, tz=timezone.utc).isoformat(),
                    "file_exists": True,
                })

    return results


def delete_backup(db: Session, backup_id: str) -> bool:
    """Deletes backup file from disk and database record."""
    record = db.query(BackupRecord).filter(BackupRecord.id == backup_id).first()
    if record:
        p = Path(record.file_path)
        if p.exists():
            p.unlink()
        db.delete(record)
        db.commit()
        return True

    # If it was an external filename
    backup_dir = get_default_backup_dir()
    p = backup_dir / backup_id
    if p.exists() and p.suffix == ".aisbackup":
        p.unlink()
        return True

    raise AISRestroException("Backup record not found.")


def cleanup_old_backups(backup_dir: Path, retention_count: int = 15):
    """Deletes older backups exceeding retention_count."""
    if retention_count <= 0 or not backup_dir.exists():
        return
    backups = sorted(
        backup_dir.glob("*.aisbackup"),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )
    # Keep the most recent `retention_count`
    for old_backup in backups[retention_count:]:
        try:
            # Do not delete safety backups
            if "safety_pre_restore" not in old_backup.name:
                old_backup.unlink()
                logger.info(f"Retention policy: removed old backup {old_backup.name}")
        except Exception as e:
            logger.warning(f"Failed to delete old backup {old_backup}: {e}")
