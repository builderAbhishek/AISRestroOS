import pytest
import os
import tempfile
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.api.v1.restaurant import seed_sample_menu_and_tables
from app.models.restaurant import Restaurant, RestaurantSettings
from app.models.tax import TaxConfiguration


@pytest.fixture(scope="session")
def test_db_path():
    temp_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    temp_file.close()
    yield temp_file.name
    if os.path.exists(temp_file.name):
        try:
            os.remove(temp_file.name)
        except Exception:
            pass


@pytest.fixture(scope="function")
def db_session(test_db_path):
    engine = create_engine(
        f"sqlite:///{test_db_path}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def setup_test_restaurant(db_session):
    restaurant = Restaurant(
        name="Royal Spice Restaurant",
        legal_name="Royal Spice Hospitality LLP",
        owner_name="Abhishek Kumar",
        phone="9876543210",
        email="info@royalspice.in",
        address="Shop 12, Main Market, MG Road, New Delhi",
        currency="INR",
        currency_symbol="₹",
        language="en",
        gst_registered=True,
        gstin="07AAAAA0000A1Z5",
    )
    db_session.add(restaurant)
    db_session.flush()

    settings = RestaurantSettings(
        restaurant_id=restaurant.id,
        tax_rate_percent=5.0,
        tax_type="CGST_SGST",
        paper_width_mm=80,
    )
    db_session.add(settings)

    tax_config = TaxConfiguration(
        restaurant_id=restaurant.id,
        name="GST",
        rate_percent=5.0,
        cgst_percent=2.5,
        sgst_percent=2.5,
        is_active=True,
    )
    db_session.add(tax_config)
    db_session.commit()

    seed_sample_menu_and_tables(db_session, restaurant)
    db_session.refresh(restaurant)
    return restaurant
