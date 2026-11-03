import pytest
from app.models.menu import MenuItem
from app.models.order import Order


def test_reports_overview_and_date_filters(client, setup_test_restaurant):
    # Check default today overview
    res = client.get("/api/v1/reports/overview?range_type=today")
    assert res.status_code == 200
    data = res.json()
    assert "gross_sales_paise" in data
    assert "net_sales_paise" in data
    assert "total_orders_count" in data
    assert "aov_paise" in data

    # Check other range types
    for r_type in ["yesterday", "this_week", "this_month", "last_month"]:
        r = client.get(f"/api/v1/reports/overview?range_type={r_type}")
        assert r.status_code == 200


def test_full_sales_reports_workflow(client, db_session, setup_test_restaurant):
    # 1. Create a settled order
    menu_item = db_session.query(MenuItem).filter(MenuItem.restaurant_id == setup_test_restaurant.id).first()
    assert menu_item is not None

    order_res = client.post("/api/v1/orders", json={
        "order_type": "dine_in",
        "table_id": setup_test_restaurant.tables[0].id,
        "customer_name": "Vikram Singh",
        "items": [{"menu_item_id": menu_item.id, "quantity": 3}],
    })
    assert order_res.status_code == 201
    order_id = order_res.json()["id"]
    grand_total = order_res.json()["total_paise"]

    settle_res = client.post(f"/api/v1/orders/{order_id}/settle", json={
        "payments": [{"payment_method": "upi", "amount_paise": grand_total}],
    })
    assert settle_res.status_code == 200

    # 2. Check Executive Overview has updated numbers
    ov_res = client.get("/api/v1/reports/overview?range_type=today")
    assert ov_res.status_code == 200
    ov_data = ov_res.json()
    assert ov_data["total_orders_count"] >= 1
    assert ov_data["payments_collected_paise"] >= grand_total

    # 3. Check Sales Trend
    trend_res = client.get("/api/v1/reports/sales-trend?range_type=today")
    assert trend_res.status_code == 200
    assert len(trend_res.json()) >= 1

    # 4. Check Item-wise Sales
    items_res = client.get("/api/v1/reports/item-sales?range_type=today")
    assert items_res.status_code == 200
    item_rows = items_res.json()
    assert len(item_rows) >= 1
    assert any(i["menu_item_id"] == menu_item.id for i in item_rows)

    # 5. Check Category-wise Sales
    cats_res = client.get("/api/v1/reports/category-sales?range_type=today")
    assert cats_res.status_code == 200
    cat_rows = cats_res.json()
    assert len(cat_rows) >= 1
    assert sum(c["percentage"] for c in cat_rows) == pytest.approx(100.0, 0.5)

    # 6. Check Order Types Report
    types_res = client.get("/api/v1/reports/order-types?range_type=today")
    assert types_res.status_code == 200
    type_rows = types_res.json()
    dine_in_row = next((t for t in type_rows if t["order_type"] == "dine_in"), None)
    assert dine_in_row is not None
    assert dine_in_row["orders_count"] >= 1

    # 7. Check Payment Methods Report
    pay_res = client.get("/api/v1/reports/payment-methods?range_type=today")
    assert pay_res.status_code == 200
    pay_data = pay_res.json()
    upi_item = next((p for p in pay_data["breakdown"] if p["method"] == "upi"), None)
    assert upi_item is not None
    assert upi_item["amount_paise"] >= grand_total

    # 8. Check Tax Report
    tax_res = client.get("/api/v1/reports/taxes?range_type=today")
    assert tax_res.status_code == 200
    tax_data = tax_res.json()
    assert tax_data["total_tax_paise"] > 0
    assert len(tax_data["invoices"]) >= 1

    # 9. Check Profitability Report
    prof_res = client.get("/api/v1/reports/profitability?range_type=today")
    assert prof_res.status_code == 200
    prof_data = prof_res.json()
    assert "net_sales_paise" in prof_data
    assert "cogs_paise" in prof_data
    assert "gross_profit_paise" in prof_data
    assert "recipe_coverage_pct" in prof_data


def test_csv_exports(client, setup_test_restaurant):
    for r_type in ["sales", "items", "categories", "taxes", "inventory"]:
        res = client.get(f"/api/v1/reports/export-csv?report_type={r_type}&range_type=today")
        assert res.status_code == 200
        assert res.headers["content-type"].startswith("text/csv")
        assert len(res.text) > 0
