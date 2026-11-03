import pytest


def test_table_stats_and_overview(client, setup_test_restaurant):
    stats_res = client.get("/api/v1/tables/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "total_tables" in stats
    assert "available_tables" in stats
    assert "occupied_tables" in stats
    assert "bill_pending_tables" in stats
    assert stats["total_tables"] >= 1


def test_table_lifecycle_and_order_snapshots(client, setup_test_restaurant):
    tables = client.get("/api/v1/tables").json()
    t = next(tab for tab in tables if tab["status"] == "available")
    items = client.get("/api/v1/menu/items").json()

    # Create order on this table
    res = client.post(
        "/api/v1/orders",
        json={
            "order_type": "dine_in",
            "table_id": t["id"],
            "items": [{"menu_item_id": items[0]["id"], "quantity": 1, "addons": []}],
        },
    )
    assert res.status_code == 201
    order = res.json()

    # Fetch tables list and inspect active order snapshot on the table
    tabs = client.get("/api/v1/tables").json()
    tab_occ = next(x for x in tabs if x["id"] == t["id"])
    assert tab_occ["status"] == "occupied"
    assert tab_occ["current_order_id"] == order["id"]
    assert tab_occ["current_order_code"] == order["order_code"]
    assert tab_occ["current_order_total_paise"] == order["total_paise"]
    assert tab_occ["current_order_due_paise"] == order["total_paise"]
    assert tab_occ["current_order_total_inr"] > 0

    # Generate bill for this order -> Table status becomes bill_generated
    client.post(f"/api/v1/orders/{order['id']}/generate-bill")
    tabs2 = client.get("/api/v1/tables").json()
    tab_bill = next(x for x in tabs2 if x["id"] == t["id"])
    assert tab_bill["status"] == "bill_generated"

    # Settle in full -> Table released
    client.post(
        f"/api/v1/orders/{order['id']}/settle",
        json={"payments": [{"payment_method": "cash", "amount_paise": order["total_paise"]}]},
    )
    tabs3 = client.get("/api/v1/tables").json()
    tab_rel = next(x for x in tabs3 if x["id"] == t["id"])
    assert tab_rel["status"] == "available"
    assert tab_rel["current_order_id"] is None
    assert tab_rel["current_order_code"] is None


def test_table_transfer(client, setup_test_restaurant):
    tables = client.get("/api/v1/tables").json()
    available = [tab for tab in tables if tab["status"] == "available"]
    assert len(available) >= 2
    src_table = available[0]
    tgt_table = available[1]

    items = client.get("/api/v1/menu/items").json()

    # Open order on src_table
    res = client.post(
        "/api/v1/orders",
        json={
            "order_type": "dine_in",
            "table_id": src_table["id"],
            "items": [{"menu_item_id": items[0]["id"], "quantity": 1, "addons": []}],
        },
    )
    order = res.json()

    # Transfer to tgt_table
    transfer_res = client.post(
        f"/api/v1/tables/{src_table['id']}/transfer",
        json={"target_table_id": tgt_table["id"]},
    )
    assert transfer_res.status_code == 200
    updated_tgt = transfer_res.json()
    assert updated_tgt["status"] == "occupied"
    assert updated_tgt["current_order_id"] == order["id"]

    # Verify source table is released
    src_after = next(t for t in client.get("/api/v1/tables").json() if t["id"] == src_table["id"])
    assert src_after["status"] == "available"
    assert src_after["current_order_id"] is None

    # Verify order snapshot is updated
    ord_after = client.get(f"/api/v1/orders/{order['id']}").json()
    assert ord_after["table_id"] == tgt_table["id"]
    assert ord_after["table_number_snapshot"] == tgt_table["table_number"]

    # Clean up by cancelling order
    client.post(f"/api/v1/orders/{order['id']}/cancel", json={"reason": "Test done"})


def test_table_toggle_active_and_delete_protection(client, setup_test_restaurant):
    # Create a new table
    new_t = client.post(
        "/api/v1/tables",
        json={"table_number": "T-TEST-DEL", "capacity": 2, "section": "Terrace"},
    ).json()

    # Toggle active
    toggle_res = client.patch(f"/api/v1/tables/{new_t['id']}/toggle-active")
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_active"] is False

    # Enable back
    toggle_res2 = client.patch(f"/api/v1/tables/{new_t['id']}/toggle-active")
    assert toggle_res2.status_code == 200
    assert toggle_res2.json()["is_active"] is True

    # Put an order on it
    items = client.get("/api/v1/menu/items").json()
    ord_res = client.post(
        "/api/v1/orders",
        json={
            "order_type": "dine_in",
            "table_id": new_t["id"],
            "items": [{"menu_item_id": items[0]["id"], "quantity": 1, "addons": []}],
        },
    ).json()

    # Attempt to disable should fail
    bad_toggle = client.patch(f"/api/v1/tables/{new_t['id']}/toggle-active")
    assert bad_toggle.status_code == 400

    # Attempt to delete should fail
    bad_del = client.delete(f"/api/v1/tables/{new_t['id']}")
    assert bad_del.status_code == 409

    # Cancel order -> now can delete
    client.post(f"/api/v1/orders/{ord_res['id']}/cancel", json={"reason": "Clean up"})
    del_res = client.delete(f"/api/v1/tables/{new_t['id']}")
    assert del_res.status_code == 204
