def test_create_dine_in_order_and_table_status(client, setup_test_restaurant):
    tables = client.get("/api/v1/tables").json()
    t1 = tables[0]
    items = client.get("/api/v1/menu/items").json()
    item1 = items[0]

    order_payload = {
        "order_type": "dine_in",
        "table_id": t1["id"],
        "customer_name": "Rohan Sharma",
        "customer_phone": "9876501234",
        "discount_type": "percentage",
        "discount_value": 10.0,  # 10% discount
        "items": [
            {
                "menu_item_id": item1["id"],
                "quantity": 2,
                "notes": "Extra crispy",
                "addons": [],
            }
        ],
    }

    res = client.post("/api/v1/orders", json=order_payload)
    assert res.status_code == 201
    order_data = res.json()
    assert order_data["status"] == "active"
    assert order_data["order_type"] == "dine_in"
    assert order_data["table_id"] == t1["id"]
    assert order_data["subtotal_paise"] == item1["base_price_paise"] * 2
    # Verify 10% discount
    expected_disc = int(round((order_data["subtotal_paise"] * 10.0) / 100.0))
    assert order_data["discount_paise"] == expected_disc

    # Table status must be occupied
    t_res = client.get("/api/v1/tables")
    updated_t1 = next(t for t in t_res.json() if t["id"] == t1["id"])
    assert updated_t1["status"] == "occupied"
    assert updated_t1["current_order_id"] == order_data["id"]

    # Prevent duplicate active order on same occupied table
    dup_res = client.post("/api/v1/orders", json=order_payload)
    assert dup_res.status_code == 409
    assert "already has an active order" in dup_res.json()["error"]


def test_takeaway_order_and_update_items(client, setup_test_restaurant):
    items = client.get("/api/v1/menu/items").json()
    item1 = items[0]
    item2 = items[1]

    order_payload = {
        "order_type": "takeaway",
        "customer_name": "Priya Singh",
        "items": [
            {
                "menu_item_id": item1["id"],
                "quantity": 1,
                "addons": [],
            }
        ],
    }
    create_res = client.post("/api/v1/orders", json=order_payload)
    assert create_res.status_code == 201
    order = create_res.json()
    assert order["table_id"] is None

    # Update order: Add item2 and increase item1
    update_payload = {
        "items": [
            {
                "menu_item_id": item1["id"],
                "quantity": 2,
                "addons": [],
            },
            {
                "menu_item_id": item2["id"],
                "quantity": 1,
                "addons": [],
            },
        ]
    }
    up_res = client.put(f"/api/v1/orders/{order['id']}/items", json=update_payload)
    assert up_res.status_code == 200
    updated_order = up_res.json()
    assert len(updated_order["items"]) == 2
    expected_subtotal = (item1["base_price_paise"] * 2) + item2["base_price_paise"]
    assert updated_order["subtotal_paise"] == expected_subtotal
