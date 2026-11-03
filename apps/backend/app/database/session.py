import os
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from app.core.logging import logger

database_url = settings.DATABASE_URL

# Ensure SQLite directory exists
if database_url.startswith("sqlite:///"):
    sqlite_file = database_url.replace("sqlite:///", "")
    # Handle multiple slashes like sqlite:////app/data/...
    if sqlite_file.startswith("/"):
        db_path = Path(sqlite_file)
    else:
        db_path = Path(sqlite_file).resolve()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    logger.info(f"SQLite database path configured: {db_path}")

engine = create_engine(
    database_url,
    connect_args={"check_same_thread": False, "timeout": settings.SQLITE_BUSY_TIMEOUT_MS / 1000.0}
    if database_url.startswith("sqlite")
    else {},
    echo=False,
    pool_pre_ping=True,
)


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if database_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys = ON;")
        cursor.execute(f"PRAGMA busy_timeout = {settings.SQLITE_BUSY_TIMEOUT_MS};")
        if settings.SQLITE_WAL_MODE:
            cursor.execute("PRAGMA journal_mode = WAL;")
            cursor.execute("PRAGMA synchronous = NORMAL;")
        cursor.close()


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
