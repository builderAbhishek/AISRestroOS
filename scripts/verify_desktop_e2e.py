import sys
import json
import urllib.request
import urllib.error
import time
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"

def request(method, path, data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"} if data is not None else {}
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_content)
        except Exception:
            return e.code, {"error": err_content}

def main():
    print("=" * 70)
    print(" AISRestroOS -- DESKTOP END-TO-END VERIFICATION SUITE")
    print(" Running against live Windows Desktop application at 127.0.0.1:8000")
    print("=" * 70)

    # 1. Health check
    print("\n[Step 1] Verifying System Health...")
    status, health = request("GET", "/api/v1/health")
    assert status == 200, f"Health check failed: {health}"
    print(f"  --> Status: {health.get('status')}")
    print(f"  --> App: {health.get('app')} v{health.get('version')}")
    print(f"  --> Environment: {health.get('environment')}")
    print(f"  --> Offline Ready: {health.get('offline_ready')}")

    # 2. Restaurant Setup / Profile
    print("\n[Step 2] Verifying Restaurant Configuration & Initial Setup...")
    status, current = request("GET", "/api/v1/restaurant/current")
    if status == 200:
        print(f"  --> Restaurant already configured: {current.get('name')}")
        restaurant = current
    else:
        print("  --> Fresh database detected. Running initial restaurant setup...")
        setup_payload = {
            "name": "Bikanervala Sweets & Restaurant",
            "legal_name": "Bikanervala Foods Pvt. Ltd.",
            "owner_name": "Abhishek Kumar",
            "phone": "+91 9876543210",
            "email": "contact@bikanervala.local",
            "address": "Plot 12, Sector 18, Commercial Hub, New Delhi 110001",
            "currency": "INR",
            "currency_symbol": "₹",
            "language": "en",
            "gst_registered": True,
            "gstin": "07AAAAA0000A1Z5",
            "is_tax_enabled": True,
            "is_tax_inclusive": False,
            "tax_rate_percent": 5.0,
            "tax_type": "gst",
            "paper_width_mm": 80,
            "bill_footer_text": "Thank you for visiting Bikanervala! Please visit again.",
            "seed_sample_menu": True
        }
        status, setup_resp = request("POST", "/api/v1/restaurant/setup", setup_payload)
        assert status == 201, f"Setup failed: {setup_resp}"
        print(f"  --> Restaurant created: {setup_resp.get('name')} (ID: {setup_resp.get('id')})")
        restaurant = setup_resp

    # 3. Dashboard Metrics
    print("\n[Step 3] Loading Dashboard Metrics...")
    status, metrics = request("GET", "/api/v1/dashboard/metrics?date_filter=today")
    assert status == 200, f"Dashboard metrics failed: {metrics}"
    kpis = metrics.get("kpis", {})
    print(f"  --> Total Sales: Rs. {kpis.get('total_sales_paise', 0)/100:.2f}")
    print(f"  --> Total Orders: {kpis.get('total_orders_count', 0)}")
    print(f"  --> Pending Amount: Rs. {kpis.get('pending_amount_paise', 0)/100:.2f}")
    print(f"  --> Cash Summary: {metrics.get('cash_summary')}")

    # 4. Menu Management: Add a new special item
    print("\n[Step 4] Menu Management -- Creating Custom Menu Item...")
    status, categories = request("GET", "/api/v1/menu/categories")
    assert status == 200 and len(categories) > 0, "No menu categories found"
    cat_id = categories[0]["id"]
    print(f"  --> Selected category: {categories[0]['name']} (ID: {cat_id})")

    new_item_payload = {
        "name": "Kashmiri Kahwa Tea",
        "category_id": cat_id,
        "base_price_paise": 12000, # Rs. 120.00
        "is_veg": True,
        "is_available": True,
        "item_code": "BEV-99",
        "description": "Traditional saffron and almond infused green tea with green cardamom",
        "has_variants": False,
        "sort_order": 99
    }
    status, created_item = request("POST", "/api/v1/menu/items", new_item_payload)
    assert status == 201, f"Failed to create menu item: {created_item}"
    item_id = created_item["id"]
    print(f"  --> Created item: {created_item['name']} @ Rs. {created_item['base_price_paise']/100:.2f} (ID: {item_id})")

    # 5. Cash Register Shift Lifecycle
    print("\n[Step 5] Cash Management -- Opening Shift & Drawer Operations...")
    # Check if there is an active shift
    status, active_shift = request("GET", "/api/v1/cash/shifts/active")
    if status == 200 and active_shift:
        print(f"  --> Existing open shift found: ID {active_shift['id']}. Closing it first...")
        request("POST", f"/api/v1/cash/shifts/{active_shift['id']}/close", {
            "actual_closing_cash_paise": active_shift["current_expected_cash_paise"],
            "closing_notes": "Clean close prior to E2E verification test",
            "closing_operator_name": "Test Runner"
        })

    # Open fresh shift
    open_payload = {
        "opening_cash_paise": 150000, # Rs. 1,500.00
        "operator_name": "Lead Cashier Rajesh",
        "opening_notes": "Morning register float - Verification Run"
    }
    status, shift = request("POST", "/api/v1/cash/shifts/open", open_payload)
    assert status == 201, f"Shift opening failed: {shift}"
    shift_id = shift["id"]
    print(f"  --> Shift opened: ID {shift_id}, Opening Float: Rs. {shift['opening_cash_paise']/100:.2f}")

    # Add Cash-In
    status, cin_resp = request("POST", f"/api/v1/cash/shifts/{shift_id}/cash-in", {
        "amount_paise": 50000, # Rs. 500.00
        "category": "PETTY_CASH_TOPUP",
        "notes": "Added coins and change notes"
    })
    assert status == 200, f"Cash In failed: {cin_resp}"
    print(f"  --> Cash-In Rs. 500 recorded. Drawer balance: Rs. {cin_resp['balance_after_paise']/100:.2f}")

    # 6. Table & POS Order Lifecycle (Dine-In + Cash Settlement)
    print("\n[Step 6] POS & Table Management -- Dine-In Order, KOT & Cash Settlement...")
    status, tables = request("GET", "/api/v1/tables")
    assert status == 200 and len(tables) > 0, "No tables found"
    available_table = next((t for t in tables if t["status"] == "available"), tables[0])
    print(f"  --> Using table: {available_table['table_number']} (Capacity: {available_table['capacity']})")

    order_payload = {
        "order_type": "dine_in",
        "table_id": available_table["id"],
        "customer_name": "Vikram Malhotra",
        "customer_phone": "9811223344",
        "items": [
            {"menu_item_id": item_id, "quantity": 2, "addons": []}
        ]
    }
    status, order = request("POST", "/api/v1/orders", order_payload)
    assert status == 201, f"Order creation failed: {order}"
    order_id = order["id"]
    print(f"  --> Order created: #{order['order_number']} (ID: {order_id})")

    # Verify table is now occupied
    status, tables_now = request("GET", "/api/v1/tables")
    t_occ = next(t for t in tables_now if t["id"] == available_table["id"])
    assert t_occ["status"] == "occupied", f"Table should be occupied, got {t_occ['status']}"
    print(f"  --> Table {t_occ['table_number']} status correctly transitioned to OCCUPIED.")

    # Generate KOT
    print("  --> Generating Kitchen Order Ticket (KOT)...")
    status, kot_resp = request("POST", f"/api/v1/orders/{order_id}/kot")
    assert status == 201, f"KOT generation failed: {kot_resp}"
    assert kot_resp["is_new_items_printed"] is True
    print(f"  --> KOT #{kot_resp['kot']['kot_number']} generated with {len(kot_resp['kot']['items'])} items.")
    print("  --> Duplicate KOT prevention check...")
    status, kot_dup = request("POST", f"/api/v1/orders/{order_id}/kot")
    assert status == 201 and kot_dup["is_new_items_printed"] is False
    print("  --> Duplicate KOT successfully suppressed.")

    # Calculate Bill
    status, bill = request("GET", f"/api/v1/orders/{order_id}/calculate-bill")
    assert status == 200, f"Bill calculation failed: {bill}"
    grand_total_1 = bill["grand_total_paise"]
    print(f"  --> Bill breakdown: Subtotal: Rs. {bill['subtotal_paise']/100:.2f}, Tax: Rs. {bill.get('total_tax_paise', 0)/100:.2f}, Grand Total: Rs. {grand_total_1/100:.2f}")

    # Settle in Cash with tendered change
    print("  --> Settling Order in Cash...")
    settle_payload = {
        "payments": [
            {
                "payment_method": "cash",
                "amount_paise": grand_total_1,
                "tendered_amount_paise": grand_total_1 + 10000 # Rs. 100 extra given
            }
        ]
    }
    status, settle_resp = request("POST", f"/api/v1/orders/{order_id}/settle", settle_payload)
    assert status == 200, f"Settlement failed: {settle_resp}"
    print(f"  --> Order settled! Status: {settle_resp['order_status']}, Change due: Rs. {settle_resp['invoice']['payments'][0]['change_due_paise']/100:.2f}")
    assert "TAX INVOICE" in settle_resp["receipt_text"]
    print("  --> Professional 80mm Tax Invoice text successfully rendered.")

    # Verify table released
    status, tables_after = request("GET", "/api/v1/tables")
    t_avail = next(t for t in tables_after if t["id"] == available_table["id"])
    assert t_avail["status"] == "available", f"Table should be released, got {t_avail['status']}"
    print(f"  --> Table {t_avail['table_number']} automatically RELEASED to AVAILABLE.")

    # 7. Takeaway Order with UPI Settlement
    print("\n[Step 7] POS Takeaway Order with UPI Settlement...")
    order2_payload = {
        "order_type": "takeaway",
        "customer_name": "Pooja Sharma",
        "customer_phone": "9822334455",
        "items": [
            {"menu_item_id": item_id, "quantity": 1, "addons": []}
        ]
    }
    status, order2 = request("POST", "/api/v1/orders", order2_payload)
    assert status == 201, f"Takeaway order failed: {order2}"
    order2_id = order2["id"]

    status, bill2 = request("GET", f"/api/v1/orders/{order2_id}/calculate-bill")
    grand_total_2 = bill2["grand_total_paise"]

    # Settle via UPI
    status, settle2_resp = request("POST", f"/api/v1/orders/{order2_id}/settle", {
        "payments": [
            {"payment_method": "upi", "amount_paise": grand_total_2, "transaction_reference": "UPI9823481234"}
        ]
    })
    assert status == 200, f"UPI settlement failed: {settle2_resp}"
    print(f"  --> Order #{order2['order_number']} settled via UPI: Rs. {grand_total_2/100:.2f} (Status: {settle2_resp['order_status']})")

    # 8. Shift Closing and Cash Reconciliation
    print("\n[Step 8] Cash Register Shift Closing & Variance Reconciliation...")
    status, shift_now = request("GET", "/api/v1/cash/shifts/active")
    assert status == 200, f"Active shift lookup failed: {shift_now}"
    expected_drawer = shift_now["current_expected_cash_paise"]
    print(f"  --> Expected Cash in Drawer: Rs. {expected_drawer/100:.2f}")
    print(f"      (Opening: Rs. 1,500.00 + Cash-In: Rs. 500.00 + Cash Sales: Rs. {grand_total_1/100:.2f})")
    assert shift_now["cash_sales_paise"] == grand_total_1, "Shift cash sales do not match order cash amount"

    # Close shift with Rs. 20 coin excess
    counted_cash = expected_drawer + 2000 # Rs. 20 overage
    close_payload = {
        "actual_closing_cash_paise": counted_cash,
        "closing_notes": "Rs. 20 excess tip left in drawer",
        "closing_operator_name": "Evening Supervisor Anil"
    }
    status, closed_shift = request("POST", f"/api/v1/cash/shifts/{shift_id}/close", close_payload)
    assert status == 200, f"Shift close failed: {closed_shift}"
    print(f"  --> Shift successfully CLOSED.")
    print(f"  --> Expected: Rs. {closed_shift['expected_closing_cash_paise']/100:.2f}")
    print(f"  --> Counted: Rs. {closed_shift['actual_closing_cash_paise']/100:.2f}")
    print(f"  --> Variance: Rs. {closed_shift['variance_paise']/100:+.2f}")
    assert closed_shift["variance_paise"] == 2000

    # 9. Backup & Validation
    print("\n[Step 9] Backup & Restore System Verification...")
    status, backup_res = request("POST", "/api/v1/backup/create", {"notes": "E2E Verification Safety Backup"})
    assert status == 201 or status == 200, f"Backup creation failed: {backup_res}"
    backup_file = backup_res["filename"]
    print(f"  --> Backup created successfully: {backup_file} ({backup_res['file_size_bytes']} bytes)")

    status, val_res = request("POST", "/api/v1/backup/validate", {"backup_file_path": backup_file})
    assert status == 200, f"Backup validation failed: {val_res}"
    print(f"  --> Backup validation: Valid={val_res.get('valid')}, Integrity={val_res.get('integrity')}")
    print(f"  --> Tables present: {val_res.get('tables_count')}, Records: {val_res.get('records_count')}")
    sha256_hash = val_res.get('metadata', {}).get('sha256', '')
    print(f"  --> SHA-256 Checksum: {sha256_hash[:16]}...")

    # 10. Dashboard final state check
    print("\n[Step 10] Checking Updated Dashboard KPI Aggregation...")
    status, final_metrics = request("GET", "/api/v1/dashboard/metrics?date_filter=today")
    assert status == 200
    final_kpis = final_metrics["kpis"]
    print(f"  --> Total Sales Today: Rs. {final_kpis['total_sales_paise']/100:.2f}")
    print(f"  --> Completed Orders: {final_kpis['completed_orders_count']}")
    print(f"  --> Average Order Value: Rs. {final_kpis['average_order_value_paise']/100:.2f}")
    print(f"  --> Pending Amount: Rs. {final_kpis['pending_amount_paise']/100:.2f}")

    print("\n" + "=" * 70)
    print(" ALL 10 DESKTOP END-TO-END VERIFICATION CHECKS PASSED PERFECTLY!")
    print("=" * 70)

if __name__ == "__main__":
    main()
