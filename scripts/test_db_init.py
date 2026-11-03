import sys
from pathlib import Path
import os
import tempfile

sys.path.insert(0, str(Path("apps/backend").resolve()))

from sqlalchemy import create_engine, inspect
from app.database.base import Base
import app.models
from alembic.config import Config
from alembic import command

test_db = Path(tempfile.gettempdir()) / "test_fresh_pos.db"
if test_db.exists():
    os.remove(test_db)

db_url = f"sqlite:///{test_db.as_posix()}"
eng = create_engine(db_url)
print("1. Creating all tables via Base.metadata.create_all...")
Base.metadata.create_all(bind=eng)

cfg = Config("apps/backend/alembic.ini")
cfg.set_main_option("script_location", "apps/backend/migrations")
cfg.set_main_option("sqlalchemy.url", db_url)
print("2. Stamping alembic to head...")
command.stamp(cfg, "head")

insp = inspect(eng)
tables = insp.get_table_names()
print(f"3. Table count: {len(tables)} tables")
print(f"   alembic_version present: {'alembic_version' in tables}")
print(f"   backup_records present: {'backup_records' in tables}")
print(f"   cash_register_shifts present: {'cash_register_shifts' in tables}")

print("4. Testing subsequent upgrade head (should be no-op)...")
command.upgrade(cfg, "head")
print("All passed cleanly!")
eng.dispose()
if test_db.exists():
    os.remove(test_db)
