import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database.session import SessionLocal
from app.models.restaurant import Restaurant
from app.models.cash import CashRegisterShift

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup_open_shifts():
    """Ensures any open shifts are closed before/after each test."""
    db = SessionLocal()
    open_shifts = db.query(CashRegisterShift).filter(CashRegisterShift.status == "open").all()
    for s in open_shifts:
        s.status = "closed"
        s.actual_closing_cash_paise = s.current_expected_cash_paise
    db.commit()
    db.close()
    yield
    db = SessionLocal()
    open_shifts = db.query(CashRegisterShift).filter(CashRegisterShift.status == "open").all()
    for s in open_shifts:
        s.status = "closed"
        s.actual_closing_cash_paise = s.current_expected_cash_paise
    db.commit()
    db.close()


def test_open_shift_and_duplicate_prevention():
    """Verifies opening a shift and preventing duplicate open shifts."""
    # 1. Open shift
    payload = {
        "opening_cash_paise": 200000,  # ₹2000.00
        "operator_name": "Cashier Amit",
        "opening_notes": "Morning Shift Float",
    }
    res = client.post("/api/v1/cash/shifts/open", json=payload)
    assert res.status_code == 201, res.text
    shift_data = res.json()
    assert shift_data["status"] == "open"
    assert shift_data["opening_cash_paise"] == 200000
    assert shift_data["current_expected_cash_paise"] == 200000

    # 2. Attempt duplicate open
    res_dup = client.post("/api/v1/cash/shifts/open", json=payload)
    assert res_dup.status_code == 400
    assert "already open" in res_dup.text.lower()


def test_cash_in_and_cash_out():
    """Verifies cash in, cash out, and withdrawal limit validation."""
    # Open shift with ₹1000
    open_res = client.post("/api/v1/cash/shifts/open", json={"opening_cash_paise": 100000, "operator_name": "Cashier"})
    shift_id = open_res.json()["id"]

    # Cash In ₹500
    cin_res = client.post(f"/api/v1/cash/shifts/{shift_id}/cash-in", json={
        "amount_paise": 50000,
        "category": "PETTY_CASH_TOPUP",
        "notes": "Added coins and small notes",
    })
    assert cin_res.status_code == 200
    assert cin_res.json()["balance_after_paise"] == 150000

    # Cash Out ₹300
    cout_res = client.post(f"/api/v1/cash/shifts/{shift_id}/cash-out", json={
        "amount_paise": 30000,
        "category": "BANK_DEPOSIT",
        "notes": "Mid-day excess deposit",
    })
    assert cout_res.status_code == 200
    assert cout_res.json()["balance_after_paise"] == 120000

    # Attempt Cash Out exceeding available (e.g. ₹2000 when only ₹1200 available)
    cout_fail = client.post(f"/api/v1/cash/shifts/{shift_id}/cash-out", json={
        "amount_paise": 200000,
        "category": "WITHDRAWAL",
    })
    assert cout_fail.status_code == 422 or cout_fail.status_code == 400
    assert "exceeds" in cout_fail.text.lower()


def test_expenses_cash_vs_upi():
    """Verifies cash expenses reduce drawer cash, while UPI expenses do not."""
    open_res = client.post("/api/v1/cash/shifts/open", json={"opening_cash_paise": 100000, "operator_name": "Cashier"})
    shift_id = open_res.json()["id"]

    # 1. Cash expense of ₹200
    exp_cash = client.post("/api/v1/cash/expenses", json={
        "category": "Kitchen Supplies",
        "amount_paise": 20000,
        "payment_method": "cash",
        "description": "Purchased fresh coriander and lemons",
    })
    assert exp_cash.status_code == 201

    # Check shift balance: 1000 - 200 = 800 (80000 paise)
    shift_res = client.get("/api/v1/cash/shifts/active")
    assert shift_res.json()["current_expected_cash_paise"] == 80000

    # 2. UPI expense of ₹500
    exp_upi = client.post("/api/v1/cash/expenses", json={
        "category": "Gas Cylinder",
        "amount_paise": 50000,
        "payment_method": "upi",
        "description": "Commercial LPG refilled via Google Pay",
    })
    assert exp_upi.status_code == 201

    # Drawer balance must STILL be 80000 paise (unaffected by UPI)
    shift_res2 = client.get("/api/v1/cash/shifts/active")
    assert shift_res2.json()["current_expected_cash_paise"] == 80000


def test_pos_cash_settlement_and_shift_reconciliation():
    """
    Verifies:
    1. POS cash payment auto-increments shift cash sales and drawer cash.
    2. Shift closing formula:
       Expected = Opening + Cash Sales + Cash In - Cash Out - Cash Expenses - Refunds.
    3. Variance calculation and closed shift immutability.
    """
    # 1. Open shift with ₹1000 float
    open_res = client.post("/api/v1/cash/shifts/open", json={"opening_cash_paise": 100000, "operator_name": "Cashier"})
    shift_id = open_res.json()["id"]

    # 2. Create and settle POS order with cash ₹300
    items_res = client.get("/api/v1/menu/items")
    first_item = items_res.json()[0]

    order_res = client.post("/api/v1/orders", json={
        "order_type": "takeaway",
        "customer_name": "Cash Customer",
        "customer_phone": "9999999999",
        "items": [{"menu_item_id": first_item["id"], "quantity": 1}],
    })
    assert order_res.status_code == 201
    order_id = order_res.json()["id"]

    # Get bill amount
    bill_res = client.get(f"/api/v1/orders/{order_id}/calculate-bill")
    assert bill_res.status_code == 200, bill_res.text
    grand_total_paise = bill_res.json()["grand_total_paise"]

    # Settle in Cash
    settle_res = client.post(f"/api/v1/orders/{order_id}/settle", json={
        "payments": [{"payment_method": "cash", "amount_paise": grand_total_paise}],
    })
    assert settle_res.status_code == 200, settle_res.text

    # 3. Verify shift updated
    active_shift = client.get("/api/v1/cash/shifts/active").json()
    assert active_shift["cash_sales_paise"] == grand_total_paise
    expected_cash = 100000 + grand_total_paise
    assert active_shift["current_expected_cash_paise"] == expected_cash

    # 4. Close Shift with counted cash having ₹50 shortage (variance -₹50)
    actual_counted = expected_cash - 5000  # ₹50 short
    close_res = client.post(f"/api/v1/cash/shifts/{shift_id}/close", json={
        "actual_closing_cash_paise": actual_counted,
        "closing_notes": "₹50 coin discrepancy",
        "closing_operator_name": "Night Supervisor",
    })
    assert close_res.status_code == 200
    closed_data = close_res.json()
    assert closed_data["status"] == "closed"
    assert closed_data["expected_closing_cash_paise"] == expected_cash
    assert closed_data["actual_closing_cash_paise"] == actual_counted
    assert closed_data["variance_paise"] == -5000

    # 5. Immutability check: cannot add cash to a closed shift
    fail_res = client.post(f"/api/v1/cash/shifts/{shift_id}/cash-in", json={"amount_paise": 1000})
    assert fail_res.status_code == 400


def test_expenses_csv_export():
    """Verifies streaming CSV export of expenses."""
    res = client.get("/api/v1/cash/expenses/export/csv")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "Date,Category,Amount (INR)" in res.text
