import os
import sys
import time
import socket
import shutil
import logging
from pathlib import Path

# When running frozen under PyInstaller, sys._MEIPASS holds bundled files
if getattr(sys, "frozen", False):
    BUNDLE_DIR = Path(sys._MEIPASS)
else:
    BUNDLE_DIR = Path(__file__).resolve().parent

# Ensure backend root is in sys.path
sys.path.insert(0, str(BUNDLE_DIR))

# Determine application data directory (%APPDATA%\AISRestroOS on Windows)
if os.getenv("AISRESTRO_DATA_DIR"):
    DATA_DIR = Path(os.environ["AISRESTRO_DATA_DIR"])
    APPDATA_DIR = DATA_DIR.parent
elif os.getenv("APPDATA"):
    APPDATA_DIR = Path(os.environ["APPDATA"]) / "AISRestroOS"
    DATA_DIR = APPDATA_DIR / "data"
else:
    APPDATA_DIR = BUNDLE_DIR.parent.parent / "data"
    DATA_DIR = APPDATA_DIR / "db"

LOGS_DIR = APPDATA_DIR / "logs"
UPLOADS_DIR = APPDATA_DIR / "uploads"
BACKUPS_DIR = APPDATA_DIR / "backups"

DATA_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
BACKUPS_DIR.mkdir(parents=True, exist_ok=True)

# Set runtime environment variables
DB_FILE = DATA_DIR / "aisrestroos.db"
os.environ["DATABASE_URL"] = f"sqlite:///{DB_FILE.as_posix()}"
os.environ["ENVIRONMENT"] = os.getenv("ENVIRONMENT", "production")
os.environ["UPLOADS_DIR"] = str(UPLOADS_DIR)
os.environ["BACKUP_DIR"] = str(BACKUPS_DIR)
os.environ["LOGS_DIR"] = str(LOGS_DIR)
os.environ["SQLITE_WAL_MODE"] = "true"

# Configure logging to console and local file
log_file = LOGS_DIR / "backend.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(str(log_file), encoding="utf-8"),
    ],
)
logger = logging.getLogger("AISRestroOS.Desktop")


def run_database_migrations():
    """Applies all pending Alembic migrations safely to head revision for both fresh and existing databases."""
    logger.info(f"Target SQLite database: {DB_FILE}")
    db_url = os.environ["DATABASE_URL"]

    from alembic.config import Config
    from alembic import command

    ini_path = BUNDLE_DIR / "alembic.ini"
    migrations_path = BUNDLE_DIR / "migrations"

    if not ini_path.exists():
        ini_path = BUNDLE_DIR / "app" / "alembic.ini"

    alembic_cfg = Config(str(ini_path))
    alembic_cfg.set_main_option("script_location", str(migrations_path))
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    # Existing database: create pre-upgrade safety backup before migrating
    if DB_FILE.exists() and DB_FILE.stat().st_size > 0:
        ts = time.strftime("%Y%m%d_%H%M%S")
        backup_copy = DATA_DIR / f"aisrestroos_pre_upgrade_{ts}.bak"
        try:
            shutil.copy2(DB_FILE, backup_copy)
            logger.info(f"Created pre-migration safety database snapshot: {backup_copy.name}")
        except Exception as e:
            logger.warning(f"Failed to create pre-migration snapshot: {e}")

    logger.info("Executing database migrations (upgrade head)...")
    command.upgrade(alembic_cfg, "head")
    logger.info("Database migrations applied and verified at head revision.")


def check_port_in_use(port: int) -> bool:
    """Checks whether the backend port is already open."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def main():
    port = int(os.getenv("BACKEND_PORT", "8000"))
    logger.info(f"Starting AISRestroOS Desktop Backend on port {port}...")

    # Check for duplicate running backend
    if check_port_in_use(port):
        logger.warning(f"Port {port} is already in use. Checking if AISRestroOS is already running...")
        import urllib.request
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/v1/health", timeout=1.0) as resp:
                if resp.status == 200:
                    logger.info("An instance of AISRestroOS backend is already running and healthy.")
                    return
        except Exception:
            logger.warning("Port 8000 occupied by another service or shutting down process. Continuing...")

    # Run database initialization and migrations
    run_database_migrations()

    # Import and launch FastAPI via Uvicorn
    from app.main import app
    import uvicorn

    logger.info(f"Uvicorn serving AISRestroOS on http://127.0.0.1:{port}")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info", access_log=True)


if __name__ == "__main__":
    main()
