def test_kot_incremental_and_duplicate_prevention(client, setup_test_restaurant):
    items = client.get("/api/v1/menu/items").json()
    item1 = items[0]
    item2 = items[1]

    # Create active order with item1 (qty 2)
    order_res = client.post(
        "/api/v1/orders",
        json={
            "order_type": "takeaway",
            "items": [{"menu_item_id": item1["id"], "quantity": 2, "addons": []}],
        },
    )
    assert order_res.status_code == 201
    order_id = order_res.json()["id"]

    # STEP 3: First "Add & Print KOT"
    kot1_res = client.post(f"/api/v1/orders/{order_id}/kot")
    assert kot1_res.status_code == 201
    kot1_data = kot1_res.json()
    assert kot1_data["is_new_items_printed"] is True
    assert len(kot1_data["kot"]["items"]) == 1
    assert kot1_data["kot"]["items"][0]["quantity"] == 2
    assert "KITCHEN ORDER TICKET" in kot1_data["formatted_text"]

    # Immediate second click without adding items -> Duplicate KOT prevention
    kot2_dup_res = client.post(f"/api/v1/orders/{order_id}/kot")
    assert kot2_dup_res.status_code == 201
    kot2_dup_data = kot2_dup_res.json()
    assert kot2_dup_data["is_new_items_printed"] is False
    assert "already been sent to kitchen" in kot2_dup_data["message"]

    # Now add item2 (qty 1) and increase item1 to 3
    client.put(
        f"/api/v1/orders/{order_id}/items",
        json={
            "items": [
                {"menu_item_id": item1["id"], "quantity": 3, "addons": []},
                {"menu_item_id": item2["id"], "quantity": 1, "addons": []},
            ]
        },
    )

    # Next KOT must contain ONLY the increments: 1 more of item1, and 1 of item2
    kot3_res = client.post(f"/api/v1/orders/{order_id}/kot")
    assert kot3_res.status_code == 201
    kot3_data = kot3_res.json()
    assert kot3_data["is_new_items_printed"] is True
    assert len(kot3_data["kot"]["items"]) == 2
    # Check quantities in this second KOT
    quantities = {i["item_name"]: i["quantity"] for i in kot3_data["kot"]["items"]}
    assert quantities[item1["name"]] == 1  # only the 1 additional
    assert quantities[item2["name"]] == 1

    # Reprint KOT
    reprint_res = client.get(f"/api/v1/orders/kot/{kot1_data['kot']['id']}/reprint")
    assert reprint_res.status_code == 200
    assert reprint_res.json()["kot"]["status"] == "reprinted"
