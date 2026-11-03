from typing import Optional, List, Tuple
from app.schemas.order import OrderItemInput


def calculate_item_price_paise(
    base_price_paise: int,
    variant_price_paise: Optional[int],
    addons_prices_paise: List[int],
) -> int:
    unit_price = variant_price_paise if variant_price_paise is not None else base_price_paise
    unit_price += sum(addons_prices_paise)
    return max(0, unit_price)


def calculate_discount_paise(
    subtotal_paise: int,
    discount_type: Optional[str],
    discount_value: float,
) -> int:
    if not discount_type or discount_value <= 0 or subtotal_paise <= 0:
        return 0

    if discount_type == "percentage":
        # e.g., 10% discount
        discount = int(round((subtotal_paise * discount_value) / 100.0))
    elif discount_type == "amount":
        # discount_value is in INR, convert to paise
        discount = int(round(discount_value * 100.0))
    else:
        discount = 0

    return min(subtotal_paise, max(0, discount))


def calculate_taxes_paise(
    taxable_amount_paise: int,
    tax_rate_percent: float,
    tax_type: str = "CGST_SGST",
) -> Tuple[int, int, int]:
    """
    Returns (cgst_paise, sgst_paise, total_tax_paise)
    For 5% GST in India, CGST = 2.5%, SGST = 2.5%
    """
    if taxable_amount_paise <= 0 or tax_rate_percent <= 0:
        return 0, 0, 0

    if tax_type == "CGST_SGST":
        half_rate = tax_rate_percent / 2.0
        cgst = int(round((taxable_amount_paise * half_rate) / 100.0))
        sgst = int(round((taxable_amount_paise * half_rate) / 100.0))
        return cgst, sgst, (cgst + sgst)
    else:
        total_tax = int(round((taxable_amount_paise * tax_rate_percent) / 100.0))
        return 0, 0, total_tax


def calculate_order_financials(
    items_line_totals: List[int],
    discount_type: Optional[str],
    discount_value: float,
    tax_rate_percent: float,
    tax_type: str = "CGST_SGST",
) -> dict:
    subtotal_paise = sum(items_line_totals)
    discount_paise = calculate_discount_paise(subtotal_paise, discount_type, discount_value)
    taxable_amount = max(0, subtotal_paise - discount_paise)
    cgst_paise, sgst_paise, tax_paise = calculate_taxes_paise(
        taxable_amount, tax_rate_percent, tax_type
    )
    grand_total_paise = taxable_amount + tax_paise

    return {
        "subtotal_paise": subtotal_paise,
        "discount_paise": discount_paise,
        "taxable_amount_paise": taxable_amount,
        "cgst_paise": cgst_paise,
        "sgst_paise": sgst_paise,
        "tax_paise": tax_paise,
        "grand_total_paise": grand_total_paise,
    }
