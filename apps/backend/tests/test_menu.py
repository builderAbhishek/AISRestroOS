import pytest


def test_menu_categories_crud(client, setup_test_restaurant):
    # List pre-seeded categories
    res = client.get("/api/v1/menu/categories")
    assert res.status_code == 200
    cats = res.json()
    assert len(cats) >= 5

    # Create category
    create_res = client.post(
        "/api/v1/menu/categories",
        json={"name": "Desserts & Shakes", "description": "Sweet treats", "sort_order": 10},
    )
    assert create_res.status_code == 201
    cat_id = create_res.json()["id"]

    # Update category
    up_res = client.put(f"/api/v1/menu/categories/{cat_id}", json={"name": "Beverages & Shakes"})
    assert up_res.status_code == 200
    assert up_res.json()["name"] == "Beverages & Shakes"

    # Delete category
    del_res = client.delete(f"/api/v1/menu/categories/{cat_id}")
    assert del_res.status_code == 204


def test_menu_items_crud_with_variants(client, setup_test_restaurant):
    cats = client.get("/api/v1/menu/categories").json()
    starter_cat_id = cats[0]["id"]

    # Create item with variants
    item_payload = {
        "category_id": starter_cat_id,
        "name": "Chicken Tikka Kebab",
        "item_code": "CK-01",
        "description": "Charcoal grilled chicken",
        "base_price_paise": 25000,
        "is_veg": False,
        "item_type": "non_veg",
        "is_available": True,
        "is_recommended": True,
        "is_bestseller": False,
        "variants": [
            {"name": "Half", "price_paise": 16000, "is_default": False},
            {"name": "Full", "price_paise": 28000, "is_default": True},
        ],
    }
    create_res = client.post("/api/v1/menu/items", json=item_payload)
    assert create_res.status_code == 201
    item_data = create_res.json()
    assert item_data["name"] == "Chicken Tikka Kebab"
    assert len(item_data["variants"]) == 2
    assert item_data["base_price_inr"] == 250.0
    assert item_data["item_type"] == "non_veg"
    assert item_data["is_recommended"] is True

    item_id = item_data["id"]

    # Toggle availability
    tog_res = client.patch(f"/api/v1/menu/items/{item_id}/toggle-availability")
    assert tog_res.status_code == 200
    assert tog_res.json()["is_available"] is False

    # Search item
    search_res = client.get("/api/v1/menu/items?search=Tikka")
    assert search_res.status_code == 200
    results = search_res.json()
    assert any(i["id"] == item_id for i in results)

    # Delete item (soft delete)
    del_res = client.delete(f"/api/v1/menu/items/{item_id}")
    assert del_res.status_code == 204

    # Verify not returned in active items list
    active_items = client.get("/api/v1/menu/items").json()
    assert not any(i["id"] == item_id for i in active_items)


def test_variants_small_medium_large(client, setup_test_restaurant):
    cats = client.get("/api/v1/menu/categories").json()
    cat_id = cats[0]["id"]

    item_payload = {
        "category_id": cat_id,
        "name": "Farmhouse Pizza",
        "item_code": "PZ-01",
        "base_price_paise": 19900,
        "item_type": "veg",
        "is_available": True,
        "variants": [
            {"name": "Small (7 inch)", "price_paise": 19900, "is_default": True},
            {"name": "Medium (10 inch)", "price_paise": 34900, "is_default": False},
            {"name": "Large (12 inch)", "price_paise": 49900, "is_default": False},
        ],
    }
    res = client.post("/api/v1/menu/items", json=item_payload)
    assert res.status_code == 201
    data = res.json()
    assert len(data["variants"]) == 3
    names = [v["name"] for v in data["variants"]]
    assert "Small (7 inch)" in names
    assert "Medium (10 inch)" in names
    assert "Large (12 inch)" in names


def test_addon_groups_required_and_optional(client, setup_test_restaurant):
    # 1. Create Required Addon Group (e.g. Choose Crust: min 1, max 1)
    res_crust = client.post(
        "/api/v1/menu/addon-groups",
        json={
            "name": "Choose Crust",
            "is_required": True,
            "min_selection": 1,
            "max_selection": 1,
            "addons": [
                {"name": "Pan Crust", "price_paise": 0},
                {"name": "Cheese Burst", "price_paise": 7500},
            ],
        },
    )
    assert res_crust.status_code == 201
    crust_data = res_crust.json()
    assert crust_data["is_required"] is True
    assert len(crust_data["addons"]) == 2

    # 2. Create Optional Addon Group (e.g. Extra Toppings: min 0, max 4)
    res_toppings = client.post(
        "/api/v1/menu/addon-groups",
        json={
            "name": "Extra Toppings",
            "is_required": False,
            "min_selection": 0,
            "max_selection": 4,
            "addons": [
                {"name": "Black Olives", "price_paise": 3000},
                {"name": "Jalapenos", "price_paise": 3000},
                {"name": "Extra Mozzarella", "price_paise": 5000},
            ],
        },
    )
    assert res_toppings.status_code == 201
    toppings_data = res_toppings.json()
    assert toppings_data["is_required"] is False
    assert len(toppings_data["addons"]) == 3


def test_duplicate_item(client, setup_test_restaurant):
    cats = client.get("/api/v1/menu/categories").json()
    cat_id = cats[0]["id"]

    res = client.post(
        "/api/v1/menu/items",
        json={
            "category_id": cat_id,
            "name": "Classic Cold Coffee",
            "base_price_paise": 12000,
            "item_type": "veg",
            "variants": [
                {"name": "Regular", "price_paise": 12000, "is_default": True},
                {"name": "Thick Shake", "price_paise": 16000, "is_default": False},
            ],
        },
    )
    assert res.status_code == 201
    original_id = res.json()["id"]

    # Duplicate
    dup_res = client.post(f"/api/v1/menu/items/{original_id}/duplicate")
    assert dup_res.status_code == 201
    dup_data = dup_res.json()
    assert dup_data["id"] != original_id
    assert "Copy" in dup_data["name"]
    assert len(dup_data["variants"]) == 2


def test_soft_delete_preserves_historical_orders(client, setup_test_restaurant):
    cats = client.get("/api/v1/menu/categories").json()
    cat_id = cats[0]["id"]

    # Create item
    res = client.post(
        "/api/v1/menu/items",
        json={
            "category_id": cat_id,
            "name": "Limited Edition Burger",
            "base_price_paise": 18000,
            "item_type": "veg",
        },
    )
    item_id = res.json()["id"]

    # Order this item
    order_res = client.post(
        "/api/v1/orders",
        json={
            "order_type": "takeaway",
            "items": [{"menu_item_id": item_id, "quantity": 2}],
        },
    )
    assert order_res.status_code == 201
    order_id = order_res.json()["id"]

    # Now delete the item
    del_res = client.delete(f"/api/v1/menu/items/{item_id}")
    assert del_res.status_code == 204

    # Fetch the order: it MUST still load cleanly and display the item!
    get_order_res = client.get(f"/api/v1/orders/{order_id}")
    assert get_order_res.status_code == 200
    order_data = get_order_res.json()
    assert len(order_data["items"]) == 1
    assert order_data["items"][0]["item_name"] == "Limited Edition Burger"
