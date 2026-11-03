import pytest
from app.models.inventory import InventoryItem, StockMovement, Recipe, RecipeIngredient
from app.models.menu import MenuItem
from app.models.order import Order, OrderItem
from app.models.table import RestaurantTable
from app.business_logic.inventory_service import (
    convert_quantity,
    calculate_weighted_average_cost,
    consume_stock_for_order,
    reverse_stock_for_order,
)


def test_unit_conversions():
    # kg to g and vice-versa
    assert convert_quantity(1.5, "kg", "g") == 1500.0
    assert convert_quantity(500, "g", "kg") == 0.5

    # L to ml and vice-versa
    assert convert_quantity(2.0, "L", "ml") == 2000.0
    assert convert_quantity(250, "ml", "L") == 0.25

    # Same units
    assert convert_quantity(5.0, "pcs", "pcs") == 5.0


def test_weighted_average_cost():
    # 10 kg @ ₹50.00 (5000 paise) + 5 kg @ ₹80.00 (8000 paise)
    # Total cost = 50,000 + 40,000 = 90,000 paise for 15 kg
    # Unit cost = 90,000 / 15 = 6000 paise (₹60.00)
    new_cost = calculate_weighted_average_cost(
        current_stock=10.0,
        current_cost_paise=5000,
        incoming_quantity=5.0,
        incoming_unit_cost_paise=8000,
    )
    assert new_cost == 6000


def test_category_and_supplier_crud(client, setup_test_restaurant):
    # Create category
    res = client.post("/api/v1/inventory/categories", json={"name": "Dairy & Milk", "description": "Fresh milk and dairy products"})
    assert res.status_code == 201
    cat_id = res.json()["id"]
    assert res.json()["name"] == "Dairy & Milk"

    # List categories
    res = client.get("/api/v1/inventory/categories")
    assert res.status_code == 200
    assert any(c["id"] == cat_id for c in res.json())

    # Create supplier
    res = client.post("/api/v1/inventory/suppliers", json={
        "name": "Amul Dairy Supplies",
        "contact_person": "Ramesh Patel",
        "phone": "9876543210",
        "gst_number": "24AAAAA0000A1Z5",
    })
    assert res.status_code == 201
    sup_id = res.json()["id"]

    # List suppliers
    res = client.get("/api/v1/inventory/suppliers")
    assert res.status_code == 200
    assert any(s["id"] == sup_id for s in res.json())


def test_inventory_item_lifecycle(client, setup_test_restaurant):
    # 1. Create category & supplier
    cat_res = client.post("/api/v1/inventory/categories", json={"name": "Vegetables"})
    cat_id = cat_res.json()["id"]
    sup_res = client.post("/api/v1/inventory/suppliers", json={"name": "Farm Fresh Produce"})
    sup_id = sup_res.json()["id"]

    # 2. Create inventory item
    item_payload = {
        "name": "Fresh Paneer",
        "sku": "RAW-PAN-01",
        "category_id": cat_id,
        "supplier_id": sup_id,
        "unit": "kg",
        "current_stock": 10.0,
        "minimum_stock": 2.0,
        "reorder_level": 4.0,
        "cost_per_unit_paise": 32000,  # ₹320/kg
        "notes": "Store in refrigerator",
    }
    res = client.post("/api/v1/inventory/items", json=item_payload)
    assert res.status_code == 201
    item = res.json()
    item_id = item["id"]
    assert item["name"] == "Fresh Paneer"
    assert item["stock_value_paise"] == 320000  # 10 * 32000

    # 3. List items & verify filter
    res = client.get(f"/api/v1/inventory/items?search=Paneer")
    assert res.status_code == 200
    assert len(res.json()) >= 1

    # 4. Update item
    res = client.put(f"/api/v1/inventory/items/{item_id}", json={"reorder_level": 5.0})
    assert res.status_code == 200
    assert res.json()["reorder_level"] == 5.0


def test_purchase_flow_and_reversal(client, setup_test_restaurant):
    # Create item
    res = client.post("/api/v1/inventory/items", json={
        "name": "Basmati Rice",
        "sku": "RAW-RIC-01",
        "unit": "kg",
        "current_stock": 0.0,
        "cost_per_unit_paise": 8000,  # ₹80/kg
    })
    item_id = res.json()["id"]

    # Create purchase draft
    purchase_data = {
        "invoice_number": "INV-FARM-990",
        "items": [
            {
                "inventory_item_id": item_id,
                "quantity": 50.0,
                "unit": "kg",
                "unit_cost_paise": 8000,
            }
        ],
        "auto_receive": False,
    }
    p_res = client.post("/api/v1/inventory/purchases", json=purchase_data)
    assert p_res.status_code == 201
    purchase = p_res.json()
    purchase_id = purchase["id"]
    assert purchase["status"] == "draft"
    assert purchase["total_cost_paise"] == 400000  # ₹4,000.00

    # Item stock should still be 0 while in draft
    item_res = client.get(f"/api/v1/inventory/items/{item_id}")
    assert item_res.json()["current_stock"] == 0.0

    # Receive purchase
    rec_res = client.post(f"/api/v1/inventory/purchases/{purchase_id}/receive")
    assert rec_res.status_code == 200
    assert rec_res.json()["status"] == "received"

    # Item stock should now be 50 kg
    item_res = client.get(f"/api/v1/inventory/items/{item_id}")
    assert item_res.json()["current_stock"] == 50.0

    # Record supplier payment
    pay_res = client.post(f"/api/v1/inventory/purchases/{purchase_id}/payments", json={
        "amount_paise": 200000,
        "payment_method": "upi",
        "reference_number": "UPI-TXN-123",
    })
    assert pay_res.status_code == 200
    assert pay_res.json()["paid_amount_paise"] == 200000
    assert pay_res.json()["due_amount_paise"] == 200000

    # Cancel purchase with stock reversal
    canc_res = client.post(f"/api/v1/inventory/purchases/{purchase_id}/cancel?reason=Damaged+Goods")
    assert canc_res.status_code == 200
    assert canc_res.json()["status"] == "cancelled"

    # Stock should be reversed back to 0
    item_res = client.get(f"/api/v1/inventory/items/{item_id}")
    assert item_res.json()["current_stock"] == 0.0


def test_wastage_and_adjustments(client, setup_test_restaurant):
    # Create item
    res = client.post("/api/v1/inventory/items", json={
        "name": "Tomatoes",
        "unit": "kg",
        "current_stock": 20.0,
        "cost_per_unit_paise": 4000,  # ₹40/kg
    })
    item_id = res.json()["id"]

    # Record wastage of 2 kg
    w_res = client.post("/api/v1/inventory/wastage", json={
        "inventory_item_id": item_id,
        "quantity": 2.0,
        "reason": "Spoiled / Rotten",
    })
    assert w_res.status_code == 201
    assert w_res.json()["quantity"] == 2.0
    assert w_res.json()["cost_paise"] == 8000

    # Current stock should be 18 kg
    item_res = client.get(f"/api/v1/inventory/items/{item_id}")
    assert item_res.json()["current_stock"] == 18.0

    # Manual adjustment: set stock to 15 kg
    adj_res = client.post("/api/v1/inventory/adjustments", json={
        "inventory_item_id": item_id,
        "adjustment_type": "set",
        "quantity": 15.0,
        "reason": "Weekly physical audit correction",
    })
    assert adj_res.status_code == 201
    assert adj_res.json()["quantity_after"] == 15.0

    # Check stock movements ledger
    mov_res = client.get(f"/api/v1/inventory/movements?inventory_item_id={item_id}")
    assert mov_res.status_code == 200
    assert len(mov_res.json()) >= 3


def test_recipe_creation_and_pos_stock_deduction(client, db_session, setup_test_restaurant):
    # 1. Create inventory items: Flour (kg) and Cheese (kg)
    flour_res = client.post("/api/v1/inventory/items", json={
        "name": "Refined Flour (Maida)",
        "unit": "kg",
        "current_stock": 10.0,
        "cost_per_unit_paise": 4000,  # ₹40/kg
    })
    flour_id = flour_res.json()["id"]

    cheese_res = client.post("/api/v1/inventory/items", json={
        "name": "Mozzarella Cheese",
        "unit": "kg",
        "current_stock": 5.0,
        "cost_per_unit_paise": 50000,  # ₹500/kg
    })
    cheese_id = cheese_res.json()["id"]

    # 2. Get a menu item from seeded menu
    menu_item = db_session.query(MenuItem).filter(MenuItem.restaurant_id == setup_test_restaurant.id).first()
    assert menu_item is not None

    # 3. Create recipe for menu item: 200g flour + 100g cheese per portion
    recipe_res = client.post("/api/v1/inventory/recipes", json={
        "menu_item_id": menu_item.id,
        "notes": "Standard recipe portion",
        "ingredients": [
            {"inventory_item_id": flour_id, "quantity": 0.2, "unit": "kg"},
            {"inventory_item_id": cheese_id, "quantity": 0.1, "unit": "kg"},
        ],
    })
    assert recipe_res.status_code == 201
    recipe = recipe_res.json()
    assert len(recipe["ingredients"]) == 2
    # 0.2 * 4000 (800) + 0.1 * 50000 (5000) = 5800 paise (₹58.00)
    assert recipe["total_cost_paise"] == 5800

    # 4. Place a POS order for 2 portions of this menu item
    order_res = client.post("/api/v1/orders", json={
        "order_type": "takeaway",
        "customer_name": "Rohan Sharma",
        "items": [
            {"menu_item_id": menu_item.id, "quantity": 2}
        ],
    })
    assert order_res.status_code == 201
    order_id = order_res.json()["id"]

    # Calculate bill & settle order
    settle_res = client.post(f"/api/v1/orders/{order_id}/settle", json={
        "payments": [{"payment_method": "cash", "amount_paise": order_res.json()["total_paise"]}],
    })
    assert settle_res.status_code == 200

    # 5. Verify stock was consumed: 2 * 0.2 = 0.4 kg flour consumed -> 10 - 0.4 = 9.6 kg
    # 2 * 0.1 = 0.2 kg cheese consumed -> 5 - 0.2 = 4.8 kg
    flour_after = client.get(f"/api/v1/inventory/items/{flour_id}").json()["current_stock"]
    cheese_after = client.get(f"/api/v1/inventory/items/{cheese_id}").json()["current_stock"]
    assert pytest.approx(flour_after, 0.001) == 9.6
    assert pytest.approx(cheese_after, 0.001) == 4.8

    # 6. Idempotency test: calling consume_stock_for_order again should NOT deduct stock again
    db_order = db_session.query(Order).filter(Order.id == order_id).first()
    movements_again = consume_stock_for_order(db_session, db_order)
    assert len(movements_again) == 0

    flour_still = client.get(f"/api/v1/inventory/items/{flour_id}").json()["current_stock"]
    assert pytest.approx(flour_still, 0.001) == 9.6


def test_inventory_dashboard_stats(client, setup_test_restaurant):
    res = client.get("/api/v1/inventory/dashboard")
    assert res.status_code == 200
    data = res.json()
    assert "total_items" in data
    assert "total_stock_value_paise" in data
    assert "low_stock_count" in data
    assert "recent_movements" in data
