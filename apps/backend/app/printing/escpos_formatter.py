from datetime import datetime, timezone
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
    
    show_gstin = getattr(settings, 'show_gstin_on_receipt', True) if settings else True
    if show_gstin and restaurant.gst_registered and restaurant.gstin:
        lines.append(f"GSTIN: {restaurant.gstin}".center(width))

    show_fssai = getattr(settings, 'show_fssai_on_receipt', True) if settings else True
    if show_fssai and getattr(restaurant, 'fssai_number', None):
        lines.append(f"FSSAI Lic: {restaurant.fssai_number}".center(width))

    if settings and getattr(settings, 'receipt_header_note', None):
        lines.append(settings.receipt_header_note.center(width))

    lines.append(divider)
    lines.append("TAX INVOICE".center(width))
    lines.append(divider)

    half = width // 2
    lines.append(f"Inv #: {invoice.invoice_number}".ljust(half) + f"Ord: {order.order_code}".rjust(width - half))
    date_str = invoice.created_at.strftime("%d-%b-%Y %I:%M %p")
    lines.append(f"Date: {date_str}")
    
    order_type_display = order.order_type.replace("_", " ").upper()
    table_str = f"Table: {order.table_number_snapshot or 'N/A'}"
    lines.append(f"Type: {order_type_display}".ljust(half) + table_str.rjust(width - half))

    show_customer = getattr(settings, 'show_customer_info_on_receipt', True) if settings else True
    if show_customer:
        if order.customer_name:
            lines.append(f"Customer: {order.customer_name}")
        if order.customer_phone:
            lines.append(f"Phone: {order.customer_phone}")

    # Column headers
    lines.append(thin_divider)
    if width <= 34:
        # 58mm thermal layout (32 chars)
        # Item: 14, Qty: 3, Price: 7, Total: 8
        lines.append(f"{'Item':<14}{'Qty':<3}{'Price':>7}{'Total':>8}")
        name_max = 13
        price_w = 7
        total_w = 8
        lbl_w = 18
    else:
        # 80mm thermal layout (42-48 chars)
        lines.append(f"{'Item':<22}{'Qty':<4}{'Price':>8}{'Total':>8}")
        name_max = 21
        price_w = 8
        total_w = 8
        lbl_w = 24

    lines.append(thin_divider)

    for item in order.items:
        name = item.item_name
        if item.variant_name:
            name += f" ({item.variant_name})"
        if len(name) > name_max:
            name = name[:name_max - 1] + "."
        
        price_str = f"{(item.unit_price_paise / 100):.2f}"
        total_str = f"{(item.line_total_paise / 100):.2f}"
        
        if width <= 34:
            lines.append(f"{name:<14}{item.quantity:<3}{price_str:>{price_w}}{total_str:>{total_w}}")
            for addon in item.addons:
                addon_price = f"{(addon.price_paise / 100):.2f}"
                lines.append(f" +{addon.addon_name[:11]:<11} {'':<3}{addon_price:>{price_w}}")
        else:
            lines.append(f"{name:<22}{item.quantity:<4}{price_str:>{price_w}}{total_str:>{total_w}}")
            for addon in item.addons:
                addon_price = f"{(addon.price_paise / 100):.2f}"
                lines.append(f"  +{addon.addon_name[:18]:<18} {'':<4}{addon_price:>{price_w}}")

    lines.append(thin_divider)

    # Subtotals & Discounts
    subtotal_str = f"INR {(invoice.subtotal_paise / 100):.2f}"
    lines.append(f"Subtotal:".ljust(lbl_w) + subtotal_str.rjust(width - lbl_w))

    if invoice.discount_paise > 0:
        disc_str = f"-INR {(invoice.discount_paise / 100):.2f}"
        lines.append(f"Discount:".ljust(lbl_w) + disc_str.rjust(width - lbl_w))

    # Taxes
    rate = getattr(invoice, 'tax_rate_percent', None)
    if rate is None:
        rate = getattr(order, 'tax_rate_percent', 0.0)

    is_inclusive = getattr(invoice, 'is_tax_inclusive', False)
    tax_label_suffix = " (Incl.)" if is_inclusive else ""

    show_breakdown = getattr(settings, 'show_tax_breakdown_on_receipt', True) if settings else True
    if show_breakdown and (getattr(invoice, 'cgst_paise', 0) > 0 or getattr(invoice, 'sgst_paise', 0) > 0) and rate > 0:
        cgst_str = f"INR {(invoice.cgst_paise / 100):.2f}"
        sgst_str = f"INR {(invoice.sgst_paise / 100):.2f}"
        lines.append(f"CGST ({rate / 2:.1f}%){tax_label_suffix}:".ljust(lbl_w) + cgst_str.rjust(width - lbl_w))
        lines.append(f"SGST ({rate / 2:.1f}%){tax_label_suffix}:".ljust(lbl_w) + sgst_str.rjust(width - lbl_w))
    elif show_breakdown and getattr(invoice, 'igst_paise', 0) > 0 and rate > 0:
        igst_str = f"INR {(invoice.igst_paise / 100):.2f}"
        lines.append(f"IGST ({rate:.1f}%){tax_label_suffix}:".ljust(lbl_w) + igst_str.rjust(width - lbl_w))
    elif invoice.total_tax_paise > 0 and rate > 0:
        tax_str = f"INR {(invoice.total_tax_paise / 100):.2f}"
        lines.append(f"Tax ({rate:.1f}%){tax_label_suffix}:".ljust(lbl_w) + tax_str.rjust(width - lbl_w))

    lines.append(divider)
    grand_total_str = f"INR {(invoice.grand_total_paise / 100):.2f}"
    lines.append(f"GRAND TOTAL:".ljust(lbl_w) + grand_total_str.rjust(width - lbl_w))
    lines.append(divider)

    paid_str = f"INR {(invoice.paid_amount_paise / 100):.2f}"
    lines.append(f"Paid Amount:".ljust(lbl_w) + paid_str.rjust(width - lbl_w))

    if invoice.due_amount_paise > 0:
        due_str = f"INR {(invoice.due_amount_paise / 100):.2f}"
        lines.append(f"Balance Due:".ljust(lbl_w) + due_str.rjust(width - lbl_w))

    # Payments summary
    if invoice.payments:
        lines.append("PAYMENTS:")
        for p in invoice.payments:
            pm_str = f"INR {(p.amount_paise / 100):.2f}"
            lines.append(f"  {p.payment_method.upper()}:".ljust(lbl_w) + pm_str.rjust(width - lbl_w))
            if p.change_due_paise and p.change_due_paise > 0:
                change_str = f"INR {(p.change_due_paise / 100):.2f}"
                lines.append(f"  Change:".ljust(lbl_w) + change_str.rjust(width - lbl_w))

    lines.append(thin_divider)
    footer_text = settings.bill_footer_text if settings else "Thank you! Visit again."
    lines.append(footer_text.center(width))
    lines.append(divider)
    lines.append("\n\n")

    return "\n".join(lines)


def format_test_print_receipt(
    restaurant: Restaurant,
    settings: Optional[RestaurantSettings] = None,
    paper_format: str = "80mm",
) -> str:
    """Generates a test print receipt verifying printer configuration."""
    width = 32 if paper_format == "58mm" else 42
    divider = "=" * width
    thin_divider = "-" * width
    lines = []

    lines.append(divider)
    lines.append("AISRestroOS TEST PRINT".center(width))
    lines.append(divider)
    lines.append(restaurant.name.center(width))
    lines.append(f"Format: {paper_format.upper()} Thermal".center(width))
    now_str = datetime.now(timezone.utc).strftime("%d-%b-%Y %I:%M:%S %p")
    lines.append(f"Time: {now_str}".center(width))
    lines.append(thin_divider)
    lines.append("Printer Connection: SUCCESSFUL")
    lines.append(f"Printer Width: {width} characters")
    lines.append(f"Receipt Mode: ESC/POS Virtual")
    lines.append(thin_divider)
    lines.append("If this text is clearly visible,")
    lines.append("your printer is configured properly!")
    lines.append(divider)
    lines.append("AISRestroOS Commercial POS".center(width))
    lines.append(divider)
    lines.append("\n\n")

    return "\n".join(lines)
