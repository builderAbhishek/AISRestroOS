from contextlib import asynccontextmanager
from pathlib import Path
import os
import asyncio
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from app.business_logic.auto_backup_worker import auto_backup_loop
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.core.exceptions import AISRestroException
from app.database.session import engine
from app.database.base import Base
import app.models  # Ensure all SQLAlchemy models are imported for metadata
from app.api.v1.router import api_v1_router

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing AISRestroOS Offline POS Backend...")
    # Start offline automated backup worker
    worker_task = asyncio.create_task(auto_backup_loop())
    yield
    worker_task.cancel()
    logger.info("Shutting down AISRestroOS Backend cleanly.")


app = FastAPI(
    title="AISRestroOS API",
    description="Commercial Offline-First Restaurant POS & Management System",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS configuration for Vite frontend and Electron
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global domain exception handler
@app.exception_handler(AISRestroException)
async def ais_restro_exception_handler(request: Request, exc: AISRestroException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message, "details": exc.details},
    )


# Mount API V1
app.include_router(api_v1_router)

# Mount local uploads directory for stored logos and assets
uploads_dir_env = os.getenv("UPLOADS_DIR")
if uploads_dir_env:
    uploads_dir = Path(uploads_dir_env)
elif os.path.exists("/app/data"):
    uploads_dir = Path("/app/data/uploads")
elif os.getenv("APPDATA"):
    uploads_dir = Path(os.getenv("APPDATA")) / "AISRestroOS" / "uploads"
else:
    uploads_dir = Path(__file__).resolve().parents[2] / "data" / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")
