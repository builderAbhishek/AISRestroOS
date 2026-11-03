import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000"

def get(path):
    req = urllib.request.Request(f"{BASE_URL}{path}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def post(path, data):
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(f"{BASE_URL}{path}", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def main():
    print("--- 1. Health ---")
    print(get("/api/v1/health"))

    print("\n--- 2. System Info ---")
    info = get("/api/v1/restaurant/system-info")
    print(f"App: {info['app_name']} v{info['app_version']}")
    print(f"DB Path: {info['database_file_path']} ({info['database_size_display']})")
    print(f"Stats: {info['total_orders']} orders, {info['total_menu_items']} items, {info['total_shifts']} shifts")

    print("\n--- 3. Cash Metrics ---")
    cash_m = get("/api/v1/cash/metrics")
    print(f"Active shift: {cash_m['has_active_shift']}, Drawer cash: {cash_m['current_drawer_cash_paise']} paise")

    print("\n--- 4. Tax Calculation Preview ---")
    tax_p = post("/api/v1/restaurant/tax-preview?amount_paise=50000&tax_rate_percent=5.0&is_tax_inclusive=true", {})
    print(f"Tax breakdown: {tax_p}")

    print("\n--- 5. Backup & Validation ---")
    b = post("/api/v1/backup/create", {"notes": "Automated verification backup"})
    print(f"Backup keys: {list(b.keys())}")
    print(f"Backup created: {b['filename']} ({b['file_size_bytes']} bytes)")
    v = post("/api/v1/backup/validate", {"backup_file_path": b["filename"]})
    print(f"Validation keys: {list(v.keys())}")
    print(f"Validation result: {v}")

    print("\n--- 6. Existing Modules Check ---")
    orders = get("/api/v1/orders")
    print(f"Orders count: {len(orders)}")
    menu = get("/api/v1/menu/items")
    print(f"Menu items count: {len(menu)}")
    tables = get("/api/v1/tables")
    print(f"Tables count: {len(tables)}")
    inv = get("/api/v1/inventory/items")
    print(f"Inventory items count: {len(inv)}")

if __name__ == "__main__":
    main()
