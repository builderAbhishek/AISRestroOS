import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "AISRestroOS"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:////app/data/aisrestroos.db"
        if os.path.exists("/app/data")
        else f"sqlite:///{Path(__file__).resolve().parents[3]}/data/db/aisrestroos.db",
    )

    SQLITE_BUSY_TIMEOUT_MS: int = int(os.getenv("SQLITE_BUSY_TIMEOUT_MS", "5000"))
    SQLITE_WAL_MODE: bool = os.getenv("SQLITE_WAL_MODE", "true").lower() in ("true", "1", "yes")

    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    FRONTEND_PORT: int = int(os.getenv("FRONTEND_PORT", "5173"))

    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost",
        "http://127.0.0.1",
        "app://.",
    ]

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="allow",
    )


settings = Settings()
