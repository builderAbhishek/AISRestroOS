from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
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
    # Initialize SQLite database schema
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created successfully.")
    except Exception as e:
        logger.error(f"Error initializing database schema: {e}", exc_info=True)
    yield
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


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")
