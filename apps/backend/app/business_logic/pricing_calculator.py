from typing import Optional, List, Tuple, Dict, Any
from app.business_logic.tax_service import (
    calculate_discount_paise,
    calculate_tax_breakdown,
    compute_order_financials,
    TaxCalculationResult,
)


def calculate_item_price_paise(
    base_price_paise: int,
    variant_price_paise: Optional[int],
    addons_prices_paise: List[int],
) -> int:
    unit_price = variant_price_paise if variant_price_paise is not None else base_price_paise
    unit_price += sum(addons_prices_paise)
    return max(0, unit_price)


def calculate_taxes_paise(
    taxable_amount_paise: int,
    tax_rate_percent: float,
    tax_type: str = "CGST_SGST",
    is_tax_inclusive: bool = False,
    is_tax_enabled: bool = True,
) -> Tuple[int, int, int]:
    """
    Returns (cgst_paise, sgst_paise, total_tax_paise).
    """
    breakdown = calculate_tax_breakdown(
        net_amount_paise=taxable_amount_paise,
        tax_rate_percent=tax_rate_percent,
        tax_type=tax_type,
        is_tax_inclusive=is_tax_inclusive,
        is_tax_enabled=is_tax_enabled,
    )
    return breakdown["cgst_paise"], breakdown["sgst_paise"], breakdown["tax_paise"]


def calculate_order_financials(
    items_line_totals: List[int],
    discount_type: Optional[str] = None,
    discount_value: float = 0.0,
    tax_rate_percent: float = 0.0,
    tax_type: str = "CGST_SGST",
    is_tax_inclusive: bool = False,
    is_tax_enabled: bool = True,
) -> Dict[str, Any]:
    """
    Unified order financial calculation returning integer paise totals.
    """
    result = compute_order_financials(
        items_line_totals=items_line_totals,
        discount_type=discount_type,
        discount_value=discount_value,
        tax_rate_percent=tax_rate_percent,
        tax_type=tax_type,
        is_tax_inclusive=is_tax_inclusive,
        is_tax_enabled=is_tax_enabled,
    )
    return result.to_dict()
