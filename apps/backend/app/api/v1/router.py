import os
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.core.config import settings
from app.api.v1.restaurant import router as restaurant_router
from app.api.v1.menu import router as menu_router
from app.api.v1.tables import router as tables_router
from app.api.v1.orders import router as orders_router
from app.api.v1.kot import router as kot_router
from app.api.v1.billing import router as billing_router, printing_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.inventory import router as inventory_router
from app.api.v1.reports import router as reports_router
from app.api.v1.backup import router as backup_router
from app.api.v1.cash import router as cash_router

api_v1_router = APIRouter(prefix="/api/v1")


@api_v1_router.get("/health", tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "offline_ready": True,
    }


@api_v1_router.get("/system/backup", tags=["System & Backup"])
def download_database_backup():
    """
    Creates a safe point-in-time copy of the SQLite database and returns it as a downloadable file.
    Works in both Docker and host Windows environments.
    """
    db_url = settings.DATABASE_URL
    if not db_url.startswith("sqlite:///"):
        raise HTTPException(status_code=400, detail="Backup only supported for SQLite databases.")

    sqlite_file = db_url.replace("sqlite:///", "")
    if sqlite_file.startswith("/"):
        source_path = sqlite_file
    else:
        source_path = str(Path(sqlite_file).resolve())

    if not os.path.exists(source_path):
        raise HTTPException(status_code=404, detail="Database file not found.")

    temp_backup = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
    temp_backup.close()
    shutil.copy2(source_path, temp_backup.name)

    filename = f"AISRestroOS_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    return FileResponse(
        path=temp_backup.name,
        filename=filename,
        media_type="application/x-sqlite3",
    )


# Mount feature modules
api_v1_router.include_router(restaurant_router)
api_v1_router.include_router(menu_router)
api_v1_router.include_router(tables_router)
api_v1_router.include_router(orders_router)
api_v1_router.include_router(kot_router)
api_v1_router.include_router(billing_router)
api_v1_router.include_router(printing_router)
api_v1_router.include_router(dashboard_router)
api_v1_router.include_router(inventory_router)
api_v1_router.include_router(reports_router)
api_v1_router.include_router(backup_router)
api_v1_router.include_router(cash_router)
