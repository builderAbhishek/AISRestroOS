import os
import zipfile
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.database.session import SessionLocal
from app.models.restaurant import Restaurant, RestaurantSettings
from app.models.backup import BackupRecord
from app.business_logic import backup_service

client = TestClient(app)


@pytest.fixture
def test_restaurant():
    db = SessionLocal()
    restaurant = db.query(Restaurant).first()
    if not restaurant:
        restaurant = Restaurant(
            name="Backup Test Grill",
            owner_name="Test Owner",
            phone="9876543210",
            address="123 Test Street",
        )
        db.add(restaurant)
        db.flush()
        settings = RestaurantSettings(restaurant_id=restaurant.id)
        db.add(settings)
        db.commit()
        db.refresh(restaurant)
    db.close()
    return restaurant


def test_manual_backup_creation_and_integrity(test_restaurant):
    """Verifies creating an online SQLite backup creates a valid .aisbackup zip with metadata and database.sqlite."""
    res = client.post("/api/v1/backup/create")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["filename"].endswith(".aisbackup")
    assert data["file_size_bytes"] > 0
    assert data["status"] == "success"
    assert data["tables_count"] > 0

    backup_path = Path(data["file_path"])
    assert backup_path.exists()

    # Validate archive contents
    assert zipfile.is_zipfile(backup_path)
    with zipfile.ZipFile(backup_path, "r") as z:
        assert "database.sqlite" in z.namelist()
        assert "metadata.json" in z.namelist()

    # Validate endpoint
    val_res = client.post("/api/v1/backup/validate", json={"backup_file_path": str(backup_path)})
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert val_data["valid"] is True
    assert val_data["integrity"] == "ok"


def test_list_and_delete_backup(test_restaurant):
    """Verifies listing backups and deleting a backup."""
    # List backups
    res = client.get("/api/v1/backup/list")
    assert res.status_code == 200
    backups = res.json()
    assert len(backups) >= 1

    target = backups[0]
    del_res = client.delete(f"/api/v1/backup/{target['id']}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True


def test_auto_backup_config():
    """Verifies updating automatic backup configuration."""
    payload = {
        "auto_backup_enabled": True,
        "auto_backup_interval": "daily",
        "auto_backup_time": "02:00",
        "auto_backup_path": "/app/data/backups",
        "backup_retention_count": 7,
    }
    res = client.post("/api/v1/backup/auto-config", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["auto_backup_enabled"] is True
    assert data["auto_backup_time"] == "02:00"
    assert data["backup_retention_count"] == 7
