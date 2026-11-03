import pytest


def test_order_rich_filtering_and_quick_filters(client, setup_test_restaurant):
    items = client.get("/api/v1/menu/items").json()
    item1 = items[0]

    # Create 3 distinct orders: 1 dine-in, 1 takeaway, 1 delivery
    tables = client.get("/api/v1/tables").json()
    t1 = tables[0]

    res1 = client.post(
        "/api/v1/orders",
        json={
            "order_type": "dine_in",
            "table_id": t1["id"],
            "customer_name": "Ramesh Kumar",
            "customer_phone": "9876543210",
            "items": [{"menu_item_id": item1["id"], "quantity": 1, "addons": []}],
        },
    )
    assert res1.status_code == 201
    ord1 = res1.json()

    res2 = client.post(
        "/api/v1/orders",
        json={
            "order_type": "takeaway",
            "customer_name": "Priya Sharma",
            "customer_phone": "9123456780",
            "items": [{"menu_item_id": item1["id"], "quantity": 2, "addons": []}],
        },
    )
    assert res2.status_code == 201
    ord2 = res2.json()

    # Settle ord2 completely
    client.post(
        f"/api/v1/orders/{ord2['id']}/settle",
        json={"payments": [{"payment_method": "cash", "amount_paise": ord2["total_paise"]}]},
    )

    # Cancel ord1 with reason
    cancel_res = client.post(
        f"/api/v1/orders/{ord1['id']}/cancel",
        json={"reason": "Customer left without ordering"},
    )
    assert cancel_res.status_code == 200
    cancelled_ord = cancel_res.json()
    assert cancelled_ord["status"] == "cancelled"
    assert cancelled_ord["cancellation_reason"] == "Customer left without ordering"
    assert cancelled_ord["cancelled_at"] is not None

    # Test quick filters
    all_orders = client.get("/api/v1/orders").json()
    assert len(all_orders) >= 2

    today_orders = client.get("/api/v1/orders?quick_filter=today").json()
    assert len(today_orders) >= 2

    comp_orders = client.get("/api/v1/orders?quick_filter=completed").json()
    assert any(o["id"] == ord2["id"] for o in comp_orders)

    canc_orders = client.get("/api/v1/orders?quick_filter=cancelled").json()
    assert any(o["id"] == ord1["id"] for o in canc_orders)

    # Search filter by name
    priya_orders = client.get("/api/v1/orders?search=Priya").json()
    assert len(priya_orders) >= 1
    assert any(o["id"] == ord2["id"] for o in priya_orders)

    # Search filter by phone
    phone_orders = client.get("/api/v1/orders?search=9876543210").json()
    assert any(o["id"] == ord1["id"] for o in phone_orders)


def test_order_cancellation_rules_and_table_release(client, setup_test_restaurant):
    tables = client.get("/api/v1/tables").json()
    avail_table = next(t for t in tables if t["status"] == "available")
    items = client.get("/api/v1/menu/items").json()

    # Create dine-in order
    ord_res = client.post(
        "/api/v1/orders",
        json={
            "order_type": "dine_in",
            "table_id": avail_table["id"],
            "items": [{"menu_item_id": items[0]["id"], "quantity": 1, "addons": []}],
        },
    )
    order = ord_res.json()

    # Table is occupied
    t_occ = client.get(f"/api/v1/tables/{avail_table['id']}/active-order").json()
    assert t_occ["id"] == order["id"]

    # Cancel order
    client.post(f"/api/v1/orders/{order['id']}/cancel", json={"reason": "Changed mind"})

    # Table is released to available
    t_after = next(t for t in client.get("/api/v1/tables").json() if t["id"] == avail_table["id"])
    assert t_after["status"] == "available"
    assert t_after["current_order_id"] is None

    # Cannot cancel already cancelled order
    re_cancel = client.post(f"/api/v1/orders/{order['id']}/cancel", json={"reason": "Again"})
    assert re_cancel.status_code == 422


def test_generate_bill_and_a4_invoice(client, setup_test_restaurant):
    items = client.get("/api/v1/menu/items").json()
    ord_res = client.post(
        "/api/v1/orders",
        json={
            "order_type": "takeaway",
            "customer_name": "Aakash Gupta",
            "items": [{"menu_item_id": items[0]["id"], "quantity": 1, "addons": []}],
        },
    )
    order = ord_res.json()

    # Generate bill
    bill_res = client.post(f"/api/v1/orders/{order['id']}/generate-bill")
    assert bill_res.status_code == 200
    inv = bill_res.json()
    assert inv["invoice_number"].startswith("INV-")
    assert inv["grand_total_paise"] == order["total_paise"]

    # Order status is bill_generated
    order_check = client.get(f"/api/v1/orders/{order['id']}").json()
    assert order_check["status"] == "bill_generated"

    # Second call returns same invoice without duplicating
    bill_res2 = client.post(f"/api/v1/orders/{order['id']}/generate-bill")
    assert bill_res2.status_code == 200
    assert bill_res2.json()["id"] == inv["id"]

    # Get A4 HTML
    a4_res = client.get(f"/api/v1/orders/{order['id']}/invoice/a4")
    assert a4_res.status_code == 200
    assert "text/html" in a4_res.headers["content-type"]
    assert "TAX INVOICE" in a4_res.text
    assert inv["invoice_number"] in a4_res.text


def test_refund_processing_and_audit(client, setup_test_restaurant):
    items = client.get("/api/v1/menu/items").json()
    ord_res = client.post(
        "/api/v1/orders",
        json={
            "order_type": "takeaway",
            "customer_name": "Neha Verma",
            "items": [{"menu_item_id": items[0]["id"], "quantity": 2, "addons": []}],
        },
    )
    order = ord_res.json()
    total = order["total_paise"]

    # Settle in full
    settle_res = client.post(
        f"/api/v1/orders/{order['id']}/settle",
        json={"payments": [{"payment_method": "upi", "amount_paise": total}]},
    )
    assert settle_res.status_code == 200

    # Over-refund attempt should fail
    bad_ref = client.post(
        f"/api/v1/orders/{order['id']}/refund",
        json={"amount_paise": total + 5000, "reason": "Accidental double charge"},
    )
    assert bad_ref.status_code == 400

    # Valid partial refund
    refund_amount = total // 2
    ref_res = client.post(
        f"/api/v1/orders/{order['id']}/refund",
        json={
            "amount_paise": refund_amount,
            "reason": "1 item was cold",
            "payment_method": "upi",
            "reference_number": "REF-UPI-12345",
        },
    )
    assert ref_res.status_code == 200
    ref_data = ref_res.json()
    assert ref_data["amount_paise"] == refund_amount
    assert ref_data["reason"] == "1 item was cold"

    # Verify order and invoice financial states
    ord_after = client.get(f"/api/v1/orders/{order['id']}").json()
    assert ord_after["paid_amount_paise"] == (total - refund_amount)
    assert ord_after["payment_status"] == "partially_paid"


def test_printing_routes_and_job_logging(client, setup_test_restaurant):
    # Test print endpoint
    test_res = client.post(
        "/api/v1/printing/test-print",
        json={"printer_name": "Kitchen Thermal", "paper_format": "80mm"},
    )
    assert test_res.status_code == 200
    assert test_res.json()["status"] == "success"
    assert "AISRestroOS TEST PRINT" in test_res.json()["receipt_text"]

    # Verify jobs listing
    jobs_res = client.get("/api/v1/printing/jobs")
    assert jobs_res.status_code == 200
    jobs = jobs_res.json()
    assert len(jobs) >= 1
    assert any(j["job_type"] == "test" for j in jobs)
