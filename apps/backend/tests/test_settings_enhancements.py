import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database.session import SessionLocal
from app.models.restaurant import Restaurant, RestaurantSettings

client = TestClient(app)


def test_restaurant_profile_fssai_and_receipt_customization():
    """Verifies updating restaurant profile with FSSAI and receipt customization toggles."""
    # Update profile
    profile_payload = {
        "name": "Royal Spice Grand POS",
        "phone": "9876543210",
        "address": "Opposite Civil Lines, Metro City",
        "owner_name": "Rajesh Kumar",
        "gst_registered": True,
        "gstin": "07AAAAA0000A1Z5",
        "fssai_number": "10019011000123",
    }
    p_res = client.put("/api/v1/restaurant/profile", json=profile_payload)
    assert p_res.status_code == 200, p_res.text
    assert p_res.json()["fssai_number"] == "10019011000123"

    # Update receipt & printer settings
    settings_payload = {
        "is_tax_enabled": True,
        "is_tax_inclusive": False,
        "tax_rate_percent": 5.0,
        "tax_type": "CGST_SGST",
        "order_types_json": '["dine_in", "takeaway", "delivery"]',
        "kot_printer_name": "Kitchen Thermal",
        "bill_printer_name": "Front Counter 80mm",
        "paper_width_mm": 80,
        "invoice_prefix": "BILL-",
        "kot_prefix": "KOT-",
        "bill_footer_text": "Thank you! Visit again soon.",
        "auto_cut_paper": True,
        "receipt_printer_type": "thermal",
        "default_print_format": "80mm",
        "show_logo_on_receipt": True,
        "show_fssai_on_receipt": True,
        "show_gstin_on_receipt": True,
        "show_customer_info_on_receipt": True,
        "show_tax_breakdown_on_receipt": True,
        "receipt_header_note": "A Unit of Grand Hospitality",
    }
    s_res = client.put("/api/v1/restaurant/settings", json=settings_payload)
    assert s_res.status_code == 200, s_res.text
    s_data = s_res.json()
    assert s_data["show_fssai_on_receipt"] is True
    assert s_data["receipt_header_note"] == "A Unit of Grand Hospitality"


def test_tax_preview_calculation():
    """Verifies that tax preview correctly calculates CGST/SGST without altering historical records."""
    # Test exclusive tax
    res_excl = client.post(
        "/api/v1/restaurant/tax-preview?amount_paise=10000&tax_rate_percent=5.0&tax_type=CGST_SGST&is_tax_inclusive=false&is_tax_enabled=true"
    )
    assert res_excl.status_code == 200
    d_excl = res_excl.json()
    assert d_excl["taxable_amount_paise"] == 10000
    assert d_excl["cgst_paise"] == 250
    assert d_excl["sgst_paise"] == 250
    assert d_excl["grand_total_paise"] == 10500

    # Test inclusive tax
    res_incl = client.post(
        "/api/v1/restaurant/tax-preview?amount_paise=10500&tax_rate_percent=5.0&tax_type=CGST_SGST&is_tax_inclusive=true&is_tax_enabled=true"
    )
    assert res_incl.status_code == 200
    d_incl = res_incl.json()
    assert d_incl["grand_total_paise"] == 10500
    assert d_incl["tax_paise"] == 500
    assert d_incl["taxable_amount_paise"] == 10000


def test_system_info_endpoint():
    """Verifies system information endpoint returns SQLite storage and stats."""
    res = client.get("/api/v1/restaurant/system-info")
    assert res.status_code == 200
    data = res.json()
    assert data["database_engine"] == "SQLite"
    assert "aisrestroos.db" in data["database_file_path"]
    assert data["database_size_bytes"] > 0
    assert "total_orders" in data
