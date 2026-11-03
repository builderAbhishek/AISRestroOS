def test_dashboard_empty_state_and_populated_metrics(client, setup_test_restaurant):
    # Empty state initially
    empty_res = client.get("/api/v1/dashboard/metrics?date_filter=today")
    assert empty_res.status_code == 200
    metrics = empty_res.json()
    assert metrics["kpis"]["total_sales_paise"] == 0
    assert metrics["kpis"]["total_orders_count"] == 0
    assert metrics["kpis"]["average_order_value_paise"] == 0
    assert metrics["kpis"]["pending_amount_paise"] == 0
    assert len(metrics["sales_trend"]) > 0  # Hourly intervals present with 0s

    # Create and settle an order
    items = client.get("/api/v1/menu/items").json()
    item = items[0]
    order_res = client.post(
        "/api/v1/orders",
        json={
            "order_type": "takeaway",
            "items": [{"menu_item_id": item["id"], "quantity": 2, "addons": []}],
        },
    )
    order = order_res.json()
    total = order["total_paise"]

    # Before settlement: pending amount should reflect this open order
    pending_res = client.get("/api/v1/dashboard/metrics?date_filter=today")
    assert pending_res.json()["kpis"]["pending_amount_paise"] == total

    # Settle order
    client.post(
        f"/api/v1/orders/{order['id']}/settle",
        json={"payments": [{"payment_method": "upi", "amount_paise": total}]},
    )

    # After settlement: today sales should match total, pending amount drops to 0
    pop_res = client.get("/api/v1/dashboard/metrics?date_filter=today")
    assert pop_res.status_code == 200
    pop_metrics = pop_res.json()
    assert pop_metrics["kpis"]["total_sales_paise"] == total
    assert pop_metrics["kpis"]["completed_orders_count"] == 1
    assert pop_metrics["kpis"]["pending_amount_paise"] == 0
    assert len(pop_metrics["recent_orders"]) == 1
    assert len(pop_metrics["top_selling_items"]) == 1
    assert pop_metrics["top_selling_items"][0]["quantity_sold"] == 2
