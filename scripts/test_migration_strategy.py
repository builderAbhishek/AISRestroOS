import sys
import tempfile
import sqlite3
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "apps" / "backend"
sys.path.insert(0, str(backend_dir))

from alembic.config import Config
from alembic import command

def test_fresh_database_migration():
    print("--- 1. Testing Fresh Database Migration from Scratch ---")
    tmp_db = Path(tempfile.gettempdir()) / "test_fresh_aisrestro.db"
    if tmp_db.exists():
        tmp_db.unlink()

    db_url = f"sqlite:///{tmp_db.as_posix()}"
    cfg = Config("apps/backend/alembic.ini")
    cfg.set_main_option("script_location", "apps/backend/migrations")
    cfg.set_main_option("sqlalchemy.url", db_url)

    # Run upgrade head on clean empty file
    command.upgrade(cfg, "head")

    conn = sqlite3.connect(tmp_db)
    tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    print(f"Tables created: {len(tables)}")
    assert "restaurants" in tables
    assert "orders" in tables
    assert "cash_register_shifts" in tables
    assert "backup_records" in tables
    assert "inventory_items" in tables
    assert "alembic_version" in tables

    version = conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
    print(f"Alembic version at head: {version}")
    assert version == "20261103_004"

    # Integrity check
    res = conn.execute("PRAGMA integrity_check").fetchall()
    print(f"Integrity check: {res}")
    assert res == [("ok",)]

    conn.close()
    tmp_db.unlink()
    print("--> Fresh Database Migration PASSED!")

def test_upgrade_from_older_revision():
    print("\n--- 2. Testing Upgrade from Older Revision (002 -> 004) ---")
    tmp_db = Path(tempfile.gettempdir()) / "test_upgrade_aisrestro.db"
    if tmp_db.exists():
        tmp_db.unlink()

    db_url = f"sqlite:///{tmp_db.as_posix()}"
    cfg = Config("apps/backend/alembic.ini")
    cfg.set_main_option("script_location", "apps/backend/migrations")
    cfg.set_main_option("sqlalchemy.url", db_url)

    # 1. Upgrade only to 20261103_002
    print("Upgrading to 20261103_002...")
    command.upgrade(cfg, "20261103_002")

    conn = sqlite3.connect(tmp_db)
    v2 = conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
    assert v2 == "20261103_002"
    tables_at_002 = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    assert "inventory_items" not in tables_at_002
    assert "cash_register_shifts" not in tables_at_002
    conn.close()

    # 2. Now upgrade to head
    print("Upgrading from 20261103_002 to head...")
    command.upgrade(cfg, "head")

    conn = sqlite3.connect(tmp_db)
    v_head = conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
    assert v_head == "20261103_004"
    tables_at_head = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    assert "inventory_items" in tables_at_head
    assert "cash_register_shifts" in tables_at_head
    print(f"Total tables after full upgrade: {len(tables_at_head)}")

    res = conn.execute("PRAGMA integrity_check").fetchall()
    assert res == [("ok",)]
    conn.close()
    tmp_db.unlink()
    print("--> Upgrade from Older Revision PASSED!")

if __name__ == "__main__":
    test_fresh_database_migration()
    test_upgrade_from_older_revision()
