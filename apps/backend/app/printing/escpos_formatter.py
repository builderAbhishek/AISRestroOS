from datetime import datetime
from typing import Optional
from app.models.kot import KOT
from app.models.order import Order
from app.models.billing import Invoice
from app.models.restaurant import Restaurant, RestaurantSettings


def format_kot_receipt(
    kot: KOT,
    order: Order,
    width: int = 42,  # 42 chars for 80mm thermal, 32 for 58mm
) -> str:
    lines = []
    divider = "=" * width
    thin_divider = "-" * width

    lines.append(divider)
    lines.append("KITCHEN ORDER TICKET".center(width))
    lines.append(divider)
    lines.append(f"KOT #: {kot.kot_code}".ljust(width // 2) + f"Order: {order.order_code}".rjust(width // 2))
    
    order_type_display = order.order_type.replace("_", " ").upper()
    table_info = f"Table: {order.table_number_snapshot or 'N/A'}"
    lines.append(f"Type: {order_type_display}".ljust(width // 2) + table_info.rjust(width // 2))

    created_time_str = kot.created_at.strftime("%d-%b-%Y %I:%M %p")
    lines.append(f"Time: {created_time_str}")
    lines.append(thin_divider)
    lines.append(f"{'QTY':<5} {'ITEM NAME':<{width - 6}}")
    lines.append(thin_divider)

    for item in kot.items:
        item_title = item.item_name
        if item.variant_name:
            item_title += f" ({item.variant_name})"
        lines.append(f"{item.quantity:<5} {item_title:<{width - 6}}")

        if item.addons_summary:
            lines.append(f"      + {item.addons_summary}")
        if item.notes:
            lines.append(f"      * NOTE: {item.notes}")

    lines.append(divider)
    lines.append(f"Total Unique Items: {len(kot.items)}".center(width))
    lines.append(divider)
    lines.append("\n\n")

    return "\n".join(lines)


def format_customer_invoice(
    invoice: Invoice,
    order: Order,
    restaurant: Restaurant,
    settings: Optional[RestaurantSettings] = None,
    width: int = 42,
) -> str:
    lines = []
    divider = "=" * width
    thin_divider = "-" * width

    # Header
    lines.append(restaurant.name.center(width))
    if restaurant.legal_name and restaurant.legal_name != restaurant.name:
        lines.append(restaurant.legal_name.center(width))
    lines.append(restaurant.address.center(width))
    lines.append(f"Phone: {restaurant.phone}".center(width))
    if restaurant.gst_registered and restaurant.gstin:
        lines.append(f"GSTIN: {restaurant.gstin}".center(width))

    lines.append(divider)
    lines.append("TAX INVOICE".center(width))
    lines.append(divider)

    lines.append(f"Inv #: {invoice.invoice_number}".ljust(width // 2) + f"Ord: {order.order_code}".rjust(width // 2))
    date_str = invoice.created_at.strftime("%d-%b-%Y %I:%M %p")
    lines.append(f"Date: {date_str}")
    
    order_type_display = order.order_type.replace("_", " ").upper()
    table_str = f"Table: {order.table_number_snapshot or 'N/A'}"
    lines.append(f"Type: {order_type_display}".ljust(width // 2) + table_str.rjust(width // 2))

    if order.customer_name:
        lines.append(f"Customer: {order.customer_name}")
    if order.customer_phone:
        lines.append(f"Phone: {order.customer_phone}")

    # Column headers
    lines.append(thin_divider)
    lines.append(f"{'Item':<22}{'Qty':<4}{'Price':>8}{'Total':>8}")
    lines.append(thin_divider)

    for item in order.items:
        name = item.item_name
        if item.variant_name:
            name += f" ({item.variant_name})"
        if len(name) > 21:
            name = name[:20] + "."

        price_str = f"{(item.unit_price_paise / 100):.2f}"
        total_str = f"{(item.line_total_paise / 100):.2f}"
        lines.append(f"{name:<22}{item.quantity:<4}{price_str:>8}{total_str:>8}")

        for addon in item.addons:
            addon_price = f"{(addon.price_paise / 100):.2f}"
            lines.append(f"  +{addon.addon_name[:18]:<18} {'':<4}{addon_price:>8}")

    lines.append(thin_divider)

    # Subtotals & Discounts
    subtotal_str = f"INR {(invoice.subtotal_paise / 100):.2f}"
    lines.append(f"Subtotal:".ljust(24) + subtotal_str.rjust(width - 24))

    if invoice.discount_paise > 0:
        disc_str = f"-INR {(invoice.discount_paise / 100):.2f}"
        lines.append(f"Discount:".ljust(24) + disc_str.rjust(width - 24))

    # Taxes
    if invoice.cgst_paise > 0 or invoice.sgst_paise > 0:
        cgst_str = f"INR {(invoice.cgst_paise / 100):.2f}"
        sgst_str = f"INR {(invoice.sgst_paise / 100):.2f}"
        lines.append(f"CGST ({order.tax_rate_percent / 2:.1f}%):".ljust(24) + cgst_str.rjust(width - 24))
        lines.append(f"SGST ({order.tax_rate_percent / 2:.1f}%):".ljust(24) + sgst_str.rjust(width - 24))
    elif invoice.total_tax_paise > 0:
        tax_str = f"INR {(invoice.total_tax_paise / 100):.2f}"
        lines.append(f"Tax ({order.tax_rate_percent:.1f}%):".ljust(24) + tax_str.rjust(width - 24))

    lines.append(divider)
    grand_total_str = f"INR {(invoice.grand_total_paise / 100):.2f}"
    lines.append(f"GRAND TOTAL:".ljust(24) + grand_total_str.rjust(width - 24))
    lines.append(divider)

    # Payments summary
    if invoice.payments:
        lines.append("PAYMENT DETAILS:")
        for p in invoice.payments:
            pm_str = f"INR {(p.amount_paise / 100):.2f}"
            lines.append(f"  {p.payment_method.upper()}:".ljust(24) + pm_str.rjust(width - 24))
            if p.change_due_paise and p.change_due_paise > 0:
                change_str = f"INR {(p.change_due_paise / 100):.2f}"
                lines.append(f"  Change Returned:".ljust(24) + change_str.rjust(width - 24))

    lines.append(thin_divider)
    footer_text = settings.bill_footer_text if settings else "Thank you! Visit again."
    lines.append(footer_text.center(width))
    lines.append(divider)
    lines.append("\n\n")

    return "\n".join(lines)
