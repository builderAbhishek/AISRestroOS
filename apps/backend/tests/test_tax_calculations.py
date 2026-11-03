import pytest
from app.business_logic.tax_service import (
    calculate_tax_breakdown,
    compute_order_financials,
    calculate_discount_paise,
)
from app.models.restaurant import Restaurant, RestaurantSettings
from app.models.menu import MenuItem
from app.models.table import RestaurantTable
from app.models.order import Order


class TestTaxCalculations:
    """
    Exhaustive verification of the centralized tax calculation engine.
    Ensures correct integer paise computations across all tax modes.
    """

    def test_tax_disabled(self):
        # Tax disabled: even if rate is 18%, tax must be 0
        result = compute_order_financials(
            items_line_totals=[10000],  # ₹100.00
            discount_type=None,
            discount_value=0.0,
            tax_rate_percent=18.0,
            tax_type="CGST_SGST",
            is_tax_inclusive=False,
            is_tax_enabled=False,
        )
        assert result.tax_paise == 0
        assert result.cgst_paise == 0
        assert result.sgst_paise == 0
        assert result.taxable_amount_paise == 10000
        assert result.grand_total_paise == 10000

    def test_zero_tax(self):
        # Zero tax rate
        result = compute_order_financials(
            items_line_totals=[25000],  # ₹250.00
            discount_type=None,
            discount_value=0.0,
            tax_rate_percent=0.0,
            tax_type="CGST_SGST",
            is_tax_inclusive=False,
            is_tax_enabled=True,
        )
        assert result.tax_paise == 0
        assert result.cgst_paise == 0
        assert result.sgst_paise == 0
        assert result.taxable_amount_paise == 25000
        assert result.grand_total_paise == 25000

    def test_5_percent_exclusive(self):
        # 5% exclusive on ₹100.00 (10000 paise)
        # Tax = 10000 * 5 / 100 = 500 paise (CGST=250, SGST=250)
        # Grand Total = 10500 paise (₹105.00)
        result = compute_order_financials(
            items_line_totals=[10000],
            tax_rate_percent=5.0,
            tax_type="CGST_SGST",
            is_tax_inclusive=False,
            is_tax_enabled=True,
        )
        assert result.taxable_amount_paise == 10000
        assert result.cgst_paise == 250
        assert result.sgst_paise == 250
        assert result.tax_paise == 500
        assert result.grand_total_paise == 10500

    def test_12_percent_exclusive(self):
        # 12% exclusive on ₹100.00 (10000 paise)
        # Tax = 10000 * 12 / 100 = 1200 paise (CGST=600, SGST=600)
        # Grand Total = 11200 paise (₹112.00)
        result = compute_order_financials(
            items_line_totals=[10000],
            tax_rate_percent=12.0,
            tax_type="CGST_SGST",
            is_tax_inclusive=False,
            is_tax_enabled=True,
        )
        assert result.taxable_amount_paise == 10000
        assert result.cgst_paise == 600
        assert result.sgst_paise == 600
        assert result.tax_paise == 1200
        assert result.grand_total_paise == 11200

    def test_18_percent_exclusive(self):
        # 18% exclusive on ₹100.00 (10000 paise)
        # Tax = 10000 * 18 / 100 = 1800 paise (CGST=900, SGST=900)
        # Grand Total = 11800 paise (₹118.00)
        result = compute_order_financials(
            items_line_totals=[10000],
            tax_rate_percent=18.0,
            tax_type="CGST_SGST",
            is_tax_inclusive=False,
            is_tax_enabled=True,
        )
        assert result.taxable_amount_paise == 10000
        assert result.cgst_paise == 900
        assert result.sgst_paise == 900
        assert result.tax_paise == 1800
        assert result.grand_total_paise == 11800

    def test_5_percent_inclusive(self):
        # 5% inclusive on ₹105.00 (10500 paise)
        # Tax = round(10500 * 5 / 105) = 500 paise
        # Taxable Amount = 10500 - 500 = 10000 paise (₹100.00)
        # Grand Total = 10500 paise (₹105.00)
        result = compute_order_financials(
            items_line_totals=[10500],
            tax_rate_percent=5.0,
            tax_type="CGST_SGST",
            is_tax_inclusive=True,
            is_tax_enabled=True,
        )
        assert result.taxable_amount_paise == 10000
        assert result.tax_paise == 500
        assert result.cgst_paise + result.sgst_paise == 500
        assert result.grand_total_paise == 10500

    def test_12_percent_inclusive(self):
        # 12% inclusive on ₹112.00 (11200 paise)
        # Tax = round(11200 * 12 / 112) = 1200 paise
        # Taxable Amount = 11200 - 1200 = 10000 paise (₹100.00)
        # Grand Total = 11200 paise (₹112.00)
        result = compute_order_financials(
            items_line_totals=[11200],
            tax_rate_percent=12.0,
            tax_type="CGST_SGST",
            is_tax_inclusive=True,
            is_tax_enabled=True,
        )
        assert result.taxable_amount_paise == 10000
        assert result.tax_paise == 1200
        assert result.cgst_paise == 600
        assert result.sgst_paise == 600
        assert result.grand_total_paise == 11200

    def test_18_percent_inclusive(self):
        # 18% inclusive on ₹118.00 (11800 paise)
        # Tax = round(11800 * 18 / 118) = 1800 paise
        # Taxable Amount = 11800 - 1800 = 10000 paise (₹100.00)
        # Grand Total = 11800 paise (₹118.00)
        result = compute_order_financials(
            items_line_totals=[11800],
            tax_rate_percent=18.0,
            tax_type="CGST_SGST",
            is_tax_inclusive=True,
            is_tax_enabled=True,
        )
        assert result.taxable_amount_paise == 10000
        assert result.tax_paise == 1800
        assert result.cgst_paise == 900
        assert result.sgst_paise == 900
        assert result.grand_total_paise == 11800

    def test_rounding_edge_cases(self):
        # Odd amount ₹99.99 (9999 paise) at 5% GST exclusive
        # Taxable: 9999 paise
        # Half rate = 2.5%
        # CGST = round(9999 * 0.025) = round(249.975) = 250 paise
        # SGST = round(9999 * 0.025) = round(249.975) = 250 paise
        # Total tax = 500 paise
        # Grand total = 9999 + 500 = 10499 paise
        result = compute_order_financials(
            items_line_totals=[9999],
            tax_rate_percent=5.0,
            tax_type="CGST_SGST",
            is_tax_inclusive=False,
            is_tax_enabled=True,
        )
        assert result.cgst_paise + result.sgst_paise == result.tax_paise
        assert result.grand_total_paise == result.taxable_amount_paise + result.tax_paise

        # Odd inclusive amount ₹13.37 (1337 paise) at 18% GST inclusive
        result_inc = compute_order_financials(
            items_line_totals=[1337],
            tax_rate_percent=18.0,
            tax_type="CGST_SGST",
            is_tax_inclusive=True,
            is_tax_enabled=True,
        )
        assert result_inc.taxable_amount_paise + result_inc.tax_paise == 1337
        assert result_inc.cgst_paise + result_inc.sgst_paise == result_inc.tax_paise
        assert result_inc.grand_total_paise == 1337

    def test_historical_invoice_immutability(self, client, setup_test_restaurant):
        """
        Critical requirement: Changing restaurant tax settings later must NEVER
        change previously generated invoices or historical records.
        """
        # Fetch an existing seeded menu item
        items_res = client.get("/api/v1/menu/items")
        assert items_res.status_code == 200
        items = items_res.json()
        assert len(items) > 0
        menu_item_id = items[0]["id"]
        item_price_paise = items[0]["base_price_paise"]

        # 1. Update restaurant settings to 5.0% tax
        client.put(
            "/api/v1/restaurant/settings",
            json={
                "tax_rate_percent": 5.0,
                "tax_type": "CGST_SGST",
                "is_tax_enabled": True,
                "is_tax_inclusive": False,
                "paper_width_mm": 80,
            },
        )

        # 2. Create order with 1 item
        order_res = client.post(
            "/api/v1/orders",
            json={
                "order_type": "takeaway",
                "items": [{"menu_item_id": menu_item_id, "quantity": 1}],
            },
        )
        assert order_res.status_code == 201
        order_data = order_res.json()
        order_id = order_data["id"]
        expected_tax = int(round((item_price_paise * 5.0) / 100.0))
        expected_total = item_price_paise + expected_tax

        assert order_data["tax_rate_percent"] == 5.0
        assert order_data["tax_paise"] == expected_tax
        assert order_data["total_paise"] == expected_total

        # 3. Settle order to create Invoice
        settle_res = client.post(
            f"/api/v1/orders/{order_id}/settle",
            json={
                "payments": [{"payment_method": "cash", "amount_paise": expected_total}]
            },
        )
        assert settle_res.status_code == 200
        settle_data = settle_res.json()
        assert settle_data["invoice"]["tax_rate_percent"] == 5.0
        assert settle_data["invoice"]["total_tax_paise"] == expected_tax
        assert settle_data["invoice"]["grand_total_paise"] == expected_total

        # 4. NOW change restaurant settings to 18% tax and inclusive
        change_settings_res = client.put(
            "/api/v1/restaurant/settings",
            json={
                "tax_rate_percent": 18.0,
                "tax_type": "CGST_SGST",
                "is_tax_enabled": True,
                "is_tax_inclusive": True,
                "paper_width_mm": 80,
            },
        )
        assert change_settings_res.status_code == 200

        # 5. Fetch the old order and invoice: they MUST remain completely frozen!
        old_order_res = client.get(f"/api/v1/orders/{order_id}")
        assert old_order_res.status_code == 200
        old_order_data = old_order_res.json()
        assert old_order_data["tax_rate_percent"] == 5.0
        assert old_order_data["tax_paise"] == expected_tax
        assert old_order_data["total_paise"] == expected_total

        # Receipt must also still print 5.0%
        receipt_res = client.get(f"/api/v1/orders/{order_id}/receipt")
        assert receipt_res.status_code == 200
        receipt_text = receipt_res.json()["receipt_text"]
        assert "CGST (2.5%)" in receipt_text
        assert "SGST (2.5%)" in receipt_text
