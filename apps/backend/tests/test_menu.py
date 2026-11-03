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
        "is_available": True,
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

    # Delete item
    del_res = client.delete(f"/api/v1/menu/items/{item_id}")
    assert del_res.status_code == 204
