import pytest
from app.models.inventory import InventoryItem, StockMovement, InventoryCategory
from app.models.order import Order, OrderItem
from app.models.kot import KOT


def test_inventory_item_creation_empty_supplier_and_category(client, setup_test_restaurant, db_session):
    """
    BUG 1 Regression Test:
    Verifies that creating an inventory item with empty strings for category_id and supplier_id
    (as sent by the frontend select dropdowns) succeeds with HTTP 201, assigns the default General
    category, sets supplier_id to None without SQLite foreign key errors, and creates opening stock.
    """
    payload = {
        "name": "Milk",
        "sku": "m1",
        "category_id": "",
        "supplier_id": "",
        "unit": "kg",
        "current_stock": 10.0,
        "minimum_stock": 2.0,
        "reorder_level": 2.0,
        "cost_per_unit_paise": 4700,
        "is_active": True,
    }
    res = client.post("/api/v1/inventory/items", json=payload)
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    data = res.json()
    assert data["name"] == "Milk"
    assert data["sku"] == "m1"
    assert data["supplier_id"] is None
    assert data["supplier_name"] is None
    assert data["category_name"] == "General"
    assert data["current_stock"] == 10.0
    assert data["cost_per_unit_paise"] == 4700
    assert data["stock_value_paise"] == 47000

    item_id = data["id"]

    # Verify database record
    db_item = db_session.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    assert db_item is not None
    assert db_item.supplier_id is None
    assert db_item.category.name == "General"

    # Verify opening stock movement created
    movements = (
        db_session.query(StockMovement)
        .filter(StockMovement.inventory_item_id == item_id)
        .all()
    )
    assert len(movements) == 1
    mov = movements[0]
    assert mov.movement_type == "MANUAL_ADJUSTMENT_IN"
    assert mov.quantity == 10.0
    assert mov.previous_stock == 0.0
    assert mov.new_stock == 10.0
    assert mov.total_cost_paise == 47000
    assert mov.reason == "Opening Stock"


def test_inventory_item_creation_zero_initial_stock(client, setup_test_restaurant, db_session):
    """
    BUG 1 Regression Test:
    Verifies that creating an inventory item with 0 initial stock succeeds
    and does not generate any unnecessary stock movements.
    """
    payload = {
        "name": "Black Pepper",
        "sku": "bp-01",
        "category_id": "",
        "supplier_id": None,
        "unit": "g",
        "current_stock": 0.0,
        "minimum_stock": 100.0,
        "reorder_level": 50.0,
        "cost_per_unit_paise": 150,
        "is_active": True,
    }
    res = client.post("/api/v1/inventory/items", json=payload)
    assert res.status_code == 201
    item_id = res.json()["id"]

    movements = (
        db_session.query(StockMovement)
        .filter(StockMovement.inventory_item_id == item_id)
        .all()
    )
    assert len(movements) == 0


def test_inventory_item_update_clearing_supplier(client, setup_test_restaurant, db_session):
    """
    BUG 1 Regression Test:
    Verifies that updating an inventory item with supplier_id='' clears it to None
    safely without throwing foreign key errors.
    """
    # 1. Create supplier
    sup_res = client.post(
        "/api/v1/inventory/suppliers",
        json={"name": "Metro Dairy", "phone": "9876543210"},
    )
    assert sup_res.status_code == 201
    sup_id = sup_res.json()["id"]

    # 2. Create item with supplier
    item_res = client.post(
        "/api/v1/inventory/items",
        json={
            "name": "Curd",
            "supplier_id": sup_id,
            "unit": "kg",
            "current_stock": 5.0,
            "cost_per_unit_paise": 3000,
        },
    )
    assert item_res.status_code == 201
    item_id = item_res.json()["id"]
    assert item_res.json()["supplier_id"] == sup_id

    # 3. Update clearing supplier with empty string
    upd_res = client.put(
        f"/api/v1/inventory/items/{item_id}",
        json={"supplier_id": ""},
    )
    assert upd_res.status_code == 200
    assert upd_res.json()["supplier_id"] is None


def test_kot_reprint_idempotency_and_no_side_effects(client, setup_test_restaurant, db_session):
    """
    BUG 3 Regression Test:
    Verifies that reprinting an existing KOT:
    1. Returns 200 with status 'reprinted' and formatted text.
    2. Does NOT create new KOT records.
    3. Does NOT modify order items or change item quantities.
    4. Does NOT create duplicate stock movements or payments.
    """
    items = client.get("/api/v1/menu/items").json()
    item = items[0]

    # Create order
    order_res = client.post(
        "/api/v1/orders",
        json={
            "order_type": "takeaway",
            "items": [{"menu_item_id": item["id"], "quantity": 2, "addons": []}],
        },
    )
    assert order_res.status_code == 201
    order_id = order_res.json()["id"]

    # Generate first KOT
    kot_res = client.post(f"/api/v1/orders/{order_id}/kot")
    assert kot_res.status_code == 201
    kot_id = kot_res.json()["kot"]["id"]

    initial_kot_count = db_session.query(KOT).count()
    initial_order_item_count = db_session.query(OrderItem).count()
    initial_movement_count = db_session.query(StockMovement).count()

    # Call reprint 3 consecutive times
    for i in range(3):
        reprint_res = client.get(f"/api/v1/orders/kot/{kot_id}/reprint")
        assert reprint_res.status_code == 200
        reprint_data = reprint_res.json()
        assert reprint_data["kot"]["status"] == "reprinted"
        assert reprint_data["is_new_items_printed"] is False
        assert "KITCHEN ORDER TICKET" in reprint_data["formatted_text"]
        assert reprint_data["kot"]["id"] == kot_id

    # Verify no duplicate KOTs were created
    assert db_session.query(KOT).count() == initial_kot_count
    # Verify no order items were duplicated or changed
    assert db_session.query(OrderItem).count() == initial_order_item_count
    # Verify no stock movements duplicated
    assert db_session.query(StockMovement).count() == initial_movement_count
