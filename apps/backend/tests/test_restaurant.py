def test_restaurant_not_configured_returns_404(client):
    res = client.get("/api/v1/restaurant/current")
    assert res.status_code == 404
    assert "not been configured" in res.json()["error"]


def test_restaurant_setup_and_profile_update(client):
    payload = {
        "name": "Delhi Darbar Restro",
        "legal_name": "Delhi Darbar LLP",
        "owner_name": "Abhishek",
        "phone": "9811122233",
        "address": "Connaught Place, New Delhi",
        "currency": "INR",
        "gst_registered": True,
        "gstin": "07AABCB1234F1Z0",
        "tax_rate_percent": 5.0,
        "seed_sample_menu": True,
    }
    setup_res = client.post("/api/v1/restaurant/setup", json=payload)
    assert setup_res.status_code == 201
    data = setup_res.json()
    assert data["name"] == "Delhi Darbar Restro"
    assert data["settings"]["tax_rate_percent"] == 5.0

    # Prevent duplicate setup
    dup_res = client.post("/api/v1/restaurant/setup", json=payload)
    assert dup_res.status_code == 400

    # Current endpoint works
    cur_res = client.get("/api/v1/restaurant/current")
    assert cur_res.status_code == 200
    assert cur_res.json()["name"] == "Delhi Darbar Restro"

    # Update profile
    update_res = client.put("/api/v1/restaurant/profile", json={"phone": "9999988888"})
    assert update_res.status_code == 200
    assert update_res.json()["phone"] == "9999988888"

    # Update settings
    settings_res = client.put(
        "/api/v1/restaurant/settings",
        json={
            "tax_rate_percent": 12.0,
            "tax_type": "CGST_SGST",
            "order_types_json": '["dine_in", "takeaway"]',
            "paper_width_mm": 58,
            "invoice_prefix": "REC-",
            "kot_prefix": "K-",
            "bill_footer_text": "Thank you!",
            "auto_cut_paper": True,
        },
    )
    assert settings_res.status_code == 200
    assert settings_res.json()["tax_rate_percent"] == 12.0
    assert settings_res.json()["paper_width_mm"] == 58
