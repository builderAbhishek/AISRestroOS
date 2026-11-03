from typing import Optional, Dict, Any, List
from dataclasses import dataclass


@dataclass
class TaxCalculationResult:
    subtotal_paise: int
    discount_paise: int
    taxable_amount_paise: int
    tax_rate_percent: float
    tax_type: str
    is_tax_inclusive: bool
    cgst_paise: int
    sgst_paise: int
    igst_paise: int
    tax_paise: int
    grand_total_paise: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "subtotal_paise": self.subtotal_paise,
            "discount_paise": self.discount_paise,
            "taxable_amount_paise": self.taxable_amount_paise,
            "tax_rate_percent": self.tax_rate_percent,
            "tax_type": self.tax_type,
            "is_tax_inclusive": self.is_tax_inclusive,
            "cgst_paise": self.cgst_paise,
            "sgst_paise": self.sgst_paise,
            "igst_paise": self.igst_paise,
            "tax_paise": self.tax_paise,
            "grand_total_paise": self.grand_total_paise,
        }


def calculate_discount_paise(
    subtotal_paise: int,
    discount_type: Optional[str],
    discount_value: float,
) -> int:
    """
    Calculate discount in paise from percentage or direct amount.
    """
    if not discount_type or discount_value <= 0 or subtotal_paise <= 0:
        return 0

    if discount_type == "percentage":
        discount = int(round((subtotal_paise * discount_value) / 100.0))
    elif discount_type == "amount":
        # discount_value is given in INR, convert to paise
        discount = int(round(discount_value * 100.0))
    else:
        discount = 0

    return min(subtotal_paise, max(0, discount))


def calculate_tax_breakdown(
    net_amount_paise: int,
    tax_rate_percent: float,
    tax_type: str = "CGST_SGST",
    is_tax_inclusive: bool = False,
    is_tax_enabled: bool = True,
) -> Dict[str, int]:
    """
    Calculates tax components based on tax type and inclusive/exclusive rules.
    Returns:
        taxable_amount_paise, cgst_paise, sgst_paise, igst_paise, total_tax_paise, grand_total_paise
    """
    if not is_tax_enabled or tax_rate_percent <= 0 or net_amount_paise <= 0:
        return {
            "taxable_amount_paise": net_amount_paise,
            "cgst_paise": 0,
            "sgst_paise": 0,
            "igst_paise": 0,
            "tax_paise": 0,
            "grand_total_paise": net_amount_paise,
        }

    normalized_tax_type = (tax_type or "CGST_SGST").upper()

    if is_tax_inclusive:
        # Inclusive Formula:
        # Tax = Inclusive Amount * Rate / (100 + Rate)
        # Taxable Amount = Inclusive Amount - Tax
        # Grand Total = Inclusive Amount
        total_tax = int(round((net_amount_paise * tax_rate_percent) / (100.0 + tax_rate_percent)))
        taxable_amount = net_amount_paise - total_tax
        grand_total = net_amount_paise

        if normalized_tax_type == "CGST_SGST":
            half_tax = int(round(total_tax / 2.0))
            cgst = half_tax
            sgst = total_tax - half_tax  # Prevents 1-paise split rounding discrepancy
            igst = 0
        elif normalized_tax_type == "IGST":
            cgst = 0
            sgst = 0
            igst = total_tax
        else:
            # NON_GST / VAT / Flat
            cgst = 0
            sgst = 0
            igst = 0
    else:
        # Exclusive Formula:
        # Tax = Taxable Amount * Rate / 100
        # Grand Total = Taxable Amount + Tax
        taxable_amount = net_amount_paise

        if normalized_tax_type == "CGST_SGST":
            half_rate = tax_rate_percent / 2.0
            cgst = int(round((taxable_amount * half_rate) / 100.0))
            sgst = int(round((taxable_amount * half_rate) / 100.0))
            total_tax = cgst + sgst
            igst = 0
        elif normalized_tax_type == "IGST":
            total_tax = int(round((taxable_amount * tax_rate_percent) / 100.0))
            cgst = 0
            sgst = 0
            igst = total_tax
        else:
            # NON_GST / VAT / Flat
            total_tax = int(round((taxable_amount * tax_rate_percent) / 100.0))
            cgst = 0
            sgst = 0
            igst = 0

        grand_total = taxable_amount + total_tax

    return {
        "taxable_amount_paise": taxable_amount,
        "cgst_paise": cgst,
        "sgst_paise": sgst,
        "igst_paise": igst,
        "tax_paise": total_tax,
        "grand_total_paise": grand_total,
    }


def compute_order_financials(
    items_line_totals: List[int],
    discount_type: Optional[str] = None,
    discount_value: float = 0.0,
    tax_rate_percent: float = 0.0,
    tax_type: str = "CGST_SGST",
    is_tax_inclusive: bool = False,
    is_tax_enabled: bool = True,
) -> TaxCalculationResult:
    """
    Central financial calculation service for POS, Orders, and Invoices.
    Ensures 100% consistent integer paise calculations everywhere.
    """
    subtotal_paise = sum(items_line_totals)
    discount_paise = calculate_discount_paise(subtotal_paise, discount_type, discount_value)
    net_amount = max(0, subtotal_paise - discount_paise)

    effective_rate = tax_rate_percent if is_tax_enabled else 0.0
    effective_type = tax_type if is_tax_enabled else "NON_GST"

    breakdown = calculate_tax_breakdown(
        net_amount_paise=net_amount,
        tax_rate_percent=effective_rate,
        tax_type=effective_type,
        is_tax_inclusive=is_tax_inclusive,
        is_tax_enabled=is_tax_enabled,
    )

    return TaxCalculationResult(
        subtotal_paise=subtotal_paise,
        discount_paise=discount_paise,
        taxable_amount_paise=breakdown["taxable_amount_paise"],
        tax_rate_percent=effective_rate,
        tax_type=effective_type,
        is_tax_inclusive=is_tax_inclusive,
        cgst_paise=breakdown["cgst_paise"],
        sgst_paise=breakdown["sgst_paise"],
        igst_paise=breakdown["igst_paise"],
        tax_paise=breakdown["tax_paise"],
        grand_total_paise=breakdown["grand_total_paise"],
    )
