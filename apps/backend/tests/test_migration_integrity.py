import os
import tempfile
import sqlite3
from pathlib import Path
import pytest
from alembic.config import Config
from alembic import command


def _get_alembic_config(db_url: str) -> Config:
    backend_dir = Path(__file__).resolve().parent.parent
    ini_path = backend_dir / "alembic.ini"
    migrations_dir = backend_dir / "migrations"
    cfg = Config(str(ini_path))
    cfg.set_main_option("script_location", str(migrations_dir))
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


def test_fresh_database_full_migration_chain():
    """Verifies that an empty database can be upgraded directly to head via Alembic."""
    tmp_db = Path(tempfile.gettempdir()) / "test_fresh_chain.db"
    if tmp_db.exists():
        tmp_db.unlink()

    try:
        db_url = f"sqlite:///{tmp_db.as_posix()}"
        cfg = _get_alembic_config(db_url)

        # Migrate directly to head
        command.upgrade(cfg, "head")

        conn = sqlite3.connect(tmp_db)
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        assert "restaurants" in tables
        assert "menu_categories" in tables
        assert "menu_items" in tables
        assert "orders" in tables
        assert "invoices" in tables
        assert "refunds" in tables
        assert "inventory_items" in tables
        assert "cash_register_shifts" in tables
        assert "backup_records" in tables

        # Revision check
        version = conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
        assert version == "20261103_004"

        # Integrity check
        res = conn.execute("PRAGMA integrity_check").fetchall()
        assert res == [("ok",)]
        conn.close()
    finally:
        if tmp_db.exists():
            tmp_db.unlink()


def test_incremental_upgrade_from_older_revision():
    """Verifies that an older revision database (e.g. at 002) upgrades safely to 004."""
    tmp_db = Path(tempfile.gettempdir()) / "test_upgrade_chain.db"
    if tmp_db.exists():
        tmp_db.unlink()

    try:
        db_url = f"sqlite:///{tmp_db.as_posix()}"
        cfg = _get_alembic_config(db_url)

        # Step 1: Upgrade to 002
        command.upgrade(cfg, "20261103_002")
        conn = sqlite3.connect(tmp_db)
        v = conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
        assert v == "20261103_002"
        conn.close()

        # Step 2: Upgrade to head
        command.upgrade(cfg, "head")
        conn = sqlite3.connect(tmp_db)
        v_head = conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
        assert v_head == "20261103_004"
        res = conn.execute("PRAGMA integrity_check").fetchall()
        assert res == [("ok",)]
        conn.close()
    finally:
        if tmp_db.exists():
            tmp_db.unlink()
