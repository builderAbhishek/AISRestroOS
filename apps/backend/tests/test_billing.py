def test_billing_settlement_and_table_release(client, setup_test_restaurant):
    tables = client.get("/api/v1/tables").json()
    table = tables[1]
    items = client.get("/api/v1/menu/items").json()
    item1 = items[0]

    # Create dine-in order
    order_res = client.post(
        "/api/v1/orders",
        json={
            "order_type": "dine_in",
            "table_id": table["id"],
            "items": [{"menu_item_id": item1["id"], "quantity": 1, "addons": []}],
        },
    )
    assert order_res.status_code == 201
    order = order_res.json()
    order_id = order["id"]

    # Table is now occupied
    t_check = client.get("/api/v1/tables").json()
    t_occ = next(t for t in t_check if t["id"] == table["id"])
    assert t_occ["status"] == "occupied"

    # Preview bill calculation
    calc_res = client.get(f"/api/v1/orders/{order_id}/calculate-bill")
    assert calc_res.status_code == 200
    bill = calc_res.json()
    assert bill["subtotal_paise"] == item1["base_price_paise"]
    assert bill["grand_total_paise"] > 0

    grand_total = bill["grand_total_paise"]

    # STEP 4: Full Settlement via Cash with change tendered
    settle_payload = {
        "payments": [
            {
                "payment_method": "cash",
                "amount_paise": grand_total,
                "tendered_amount_paise": grand_total + 10000,  # ₹100 extra given
            }
        ]
    }
    settle_res = client.post(f"/api/v1/orders/{order_id}/settle", json=settle_payload)
    assert settle_res.status_code == 200
    settle_data = settle_res.json()
    assert settle_data["order_status"] == "completed"
    assert settle_data["invoice"]["status"] == "paid"
    assert settle_data["invoice"]["due_amount_paise"] == 0
    assert settle_data["invoice"]["payments"][0]["change_due_paise"] == 10000
    assert "TAX INVOICE" in settle_data["receipt_text"]

    # Table must be released back to 'available'
    t_after = client.get("/api/v1/tables").json()
    t_avail = next(t for t in t_after if t["id"] == table["id"])
    assert t_avail["status"] == "available"
    assert t_avail["current_order_id"] is None


def test_split_payment_and_partial_payment(client, setup_test_restaurant):
    items = client.get("/api/v1/menu/items").json()
    item1 = items[0]

    # Create takeaway order
    order_res = client.post(
        "/api/v1/orders",
        json={
            "order_type": "takeaway",
            "items": [{"menu_item_id": item1["id"], "quantity": 2, "addons": []}],
        },
    )
    order = order_res.json()
    order_id = order["id"]
    grand_total = order["total_paise"]
    half_payment = grand_total // 2

    # Partial payment
    part_res = client.post(
        f"/api/v1/orders/{order_id}/settle",
        json={"payments": [{"payment_method": "upi", "amount_paise": half_payment}]},
    )
    assert part_res.status_code == 200
    part_data = part_res.json()
    assert part_data["order_status"] in ("active", "bill_generated")
    assert part_data["invoice"]["status"] == "partially_paid"
    assert part_data["invoice"]["due_amount_paise"] == (grand_total - half_payment)

    # Remaining payment via Card
    rem_res = client.post(
        f"/api/v1/orders/{order_id}/settle",
        json={
            "payments": [
                {
                    "payment_method": "card",
                    "amount_paise": part_data["invoice"]["due_amount_paise"],
                    "reference_number": "TXN998877",
                }
            ]
        },
    )
    assert rem_res.status_code == 200
    assert rem_res.json()["order_status"] == "completed"
    assert rem_res.json()["invoice"]["status"] == "paid"
    assert rem_res.json()["invoice"]["due_amount_paise"] == 0
